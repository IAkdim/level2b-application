// Stripe Webhook Handler for Supabase Edge Functions
// This handles all Stripe webhook events and syncs data to Supabase
// Subscriptions are per-user (account), not per-organization

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.14.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// ============================================================================
// CRITICAL: Price ID to Plan Tier mapping
// ============================================================================
// These MUST be set as Supabase secrets. Without them, subscriptions will fail.
// Set via: supabase secrets set STRIPE_PRICE_STARTER=price_xxx STRIPE_PRICE_PRO=price_xxx

const STRIPE_PRICE_STARTER = Deno.env.get("STRIPE_PRICE_STARTER")
const STRIPE_PRICE_PRO = Deno.env.get("STRIPE_PRICE_PRO")

// Validate required environment variables at startup
if (!STRIPE_PRICE_STARTER || !STRIPE_PRICE_PRO) {
  console.error("CRITICAL: Missing required Stripe price ID environment variables!")
  console.error("STRIPE_PRICE_STARTER:", STRIPE_PRICE_STARTER ? "SET" : "MISSING")
  console.error("STRIPE_PRICE_PRO:", STRIPE_PRICE_PRO ? "SET" : "MISSING")
}

interface PlanConfig {
  tier: "starter" | "pro" | "enterprise"
  leadsLimit: number
  emailDomainsLimit: number
}

// Build the price mapping only if env vars are set
const PRICE_TO_TIER: Record<string, PlanConfig> = {}

if (STRIPE_PRICE_STARTER) {
  PRICE_TO_TIER[STRIPE_PRICE_STARTER] = {
    tier: "starter",
    leadsLimit: 1000,
    emailDomainsLimit: 1,
  }
}

if (STRIPE_PRICE_PRO) {
  PRICE_TO_TIER[STRIPE_PRICE_PRO] = {
    tier: "pro",
    leadsLimit: -1, // Unlimited
    emailDomainsLimit: -1, // Unlimited
  }
}

/**
 * Get plan configuration for a Stripe price ID.
 * CRITICAL: Returns null for unknown prices - callers MUST handle this.
 * Never silently default to starter - that's the bug we're fixing!
 */
function getPlanConfigForPrice(priceId: string | undefined): PlanConfig | null {
  if (!priceId) {
    console.error("getPlanConfigForPrice: No price ID provided")
    return null
  }
  
  const config = PRICE_TO_TIER[priceId]
  
  if (!config) {
    console.error(`CRITICAL: Unknown Stripe price ID: ${priceId}`)
    console.error("Known price IDs:", Object.keys(PRICE_TO_TIER))
    console.error("This subscription will NOT be processed until the price ID is configured.")
    return null
  }
  
  console.log(`Price ID ${priceId} mapped to tier: ${config.tier}`)
  return config
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature")
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 })
  }

  let event: Stripe.Event

  try {
    const body = await req.text()
    // Use constructEventAsync for Deno/Edge runtime (async crypto)
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Initialize Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check for duplicate events (idempotency)
  const { data: existingEvent } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .single()

  if (existingEvent) {
    console.log(`Event ${event.id} already processed, skipping`)
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Store the event for idempotency tracking
  await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event.data.object,
  })

  console.log(`Processing webhook event: ${event.type}`)

  try {
    switch (event.type) {
      // ========================================
      // CHECKOUT COMPLETED
      // ========================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session

        // Only handle subscription checkouts
        if (session.mode !== "subscription") {
          console.log("Not a subscription checkout, skipping")
          break
        }

        const userId = session.client_reference_id
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (!userId) {
          console.error("No client_reference_id (user_id) in session")
          break
        }

        // Fetch the full subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id
        
        // CRITICAL: Use safe lookup - do NOT default to starter
        const planConfig = getPlanConfigForPrice(priceId)
        
        if (!planConfig) {
          console.error(`CRITICAL: Cannot process checkout - unknown price ID: ${priceId}`)
          console.error(`User ${userId} paid but subscription cannot be created until price mapping is fixed.`)
          // Store the raw subscription data so we can fix it later
          await supabase.from("stripe_webhook_events").update({
            processing_error: `Unknown price ID: ${priceId}. Subscription created in Stripe but not synced to app.`
          }).eq("stripe_event_id", event.id)
          
          // Still return 200 to Stripe - we logged the error and will fix manually
          // But do NOT create a subscription with wrong tier
          break
        }

        // Create or update customer record
        await supabase.from("stripe_customers").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          email: session.customer_email,
        }, { onConflict: "user_id" })

        // Create subscription record
        await supabase.from("subscriptions").upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: subscription.status,
          price_id: priceId,
          plan_tier: planConfig.tier,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          leads_per_week_limit: planConfig.leadsLimit,
          email_domains_limit: planConfig.emailDomainsLimit,
          is_enterprise: false,
        }, { onConflict: "user_id" })

        console.log(`Created subscription for user ${userId}: ${planConfig.tier}`)
        break
      }

      // ========================================
      // SUBSCRIPTION CREATED
      // ========================================
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(supabase, subscription)
        break
      }

      // ========================================
      // SUBSCRIPTION UPDATED (upgrades, downgrades, renewals)
      // ========================================
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionChange(supabase, subscription)
        break
      }

      // ========================================
      // SUBSCRIPTION DELETED (canceled and ended)
      // ========================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Find the subscription by Stripe subscription ID
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id, user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single()

        if (existingSub) {
          await supabase
            .from("subscriptions")
            .update({
              subscription_status: "canceled",
              canceled_at: new Date().toISOString(),
            })
            .eq("id", existingSub.id)

          console.log(`Subscription canceled for user ${existingSub.user_id}`)
        }
        break
      }

      // ========================================
      // INVOICE PAID (successful payment)
      // ========================================
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice

        // Find the user by customer ID
        const { data: customer } = await supabase
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", invoice.customer as string)
          .single()

        if (customer) {
          // Store billing history
          await supabase.from("billing_history").upsert({
            user_id: customer.user_id,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription as string,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
            status: "paid",
            invoice_pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            paid_at: new Date().toISOString(),
          }, { onConflict: "stripe_invoice_id" })

          console.log(`Invoice paid for user ${customer.user_id}: €${invoice.amount_paid / 100}`)
        }
        break
      }

      // ========================================
      // INVOICE PAYMENT FAILED
      // ========================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice

        // Find the user by customer ID
        const { data: customer } = await supabase
          .from("stripe_customers")
          .select("user_id")
          .eq("stripe_customer_id", invoice.customer as string)
          .single()

        if (customer) {
          // The subscription status will be updated by customer.subscription.updated
          // But we can log this for monitoring
          console.log(`Payment failed for user ${customer.user_id}`)

          // Update billing history
          await supabase.from("billing_history").upsert({
            user_id: customer.user_id,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: invoice.subscription as string,
            amount_paid: 0,
            currency: invoice.currency,
            status: "open",
            invoice_pdf_url: invoice.invoice_pdf,
            hosted_invoice_url: invoice.hosted_invoice_url,
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
          }, { onConflict: "stripe_invoice_id" })
        }
        break
      }

      // ========================================
      // CUSTOMER UPDATED
      // ========================================
      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer

        await supabase
          .from("stripe_customers")
          .update({
            email: customer.email,
            name: customer.name,
          })
          .eq("stripe_customer_id", customer.id)

        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error(`Error processing webhook: ${error.message}`)

    // Update the event record with the error
    await supabase
      .from("stripe_webhook_events")
      .update({ processing_error: error.message })
      .eq("stripe_event_id", event.id)

    // Return 200 to prevent Stripe from retrying
    // (we've logged the error and can investigate)
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }
})

// ========================================
// HELPER: Handle subscription changes
// ========================================
async function handleSubscriptionChange(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id
  
  // CRITICAL: Use safe lookup - do NOT default to starter
  const planConfig = getPlanConfigForPrice(priceId)

  if (!planConfig) {
    console.error(`CRITICAL: Cannot update subscription - unknown price ID: ${priceId}`)
    console.error(`Stripe subscription ${subscription.id} has price ${priceId} which is not mapped.`)
    console.error("This subscription will NOT be updated until the price mapping is fixed.")
    // Do NOT update with wrong tier - fail explicitly
    return
  }

  // Find the user by customer ID
  const { data: customer } = await supabase
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!customer) {
    console.error(`No customer found for Stripe customer ${customerId}`)
    return
  }

  // IMPORTANT: Check if user already has a higher tier (prevent downgrades from race conditions)
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("plan_tier, stripe_subscription_id")
    .eq("user_id", customer.user_id)
    .single()

  // If this is a different subscription event for the same user, 
  // only process if it's for their current subscription or an upgrade
  if (existingSub && existingSub.stripe_subscription_id !== subscription.id) {
    console.log(`Subscription ${subscription.id} is not the active subscription for user ${customer.user_id}`)
    console.log(`Active subscription is ${existingSub.stripe_subscription_id}`)
    // This could be an old subscription event - skip to prevent overwriting
    return
  }

  // Update the subscription
  await supabase.from("subscriptions").upsert({
    user_id: customer.user_id,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    price_id: priceId,
    plan_tier: planConfig.tier,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    leads_per_week_limit: planConfig.leadsLimit,
    email_domains_limit: planConfig.emailDomainsLimit,
  }, { onConflict: "user_id" })

  console.log(`Updated subscription for user ${customer.user_id}: ${subscription.status} - ${planConfig.tier}`)
}
