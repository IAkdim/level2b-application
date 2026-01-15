// Create Checkout Session - Supabase Edge Function
// Generates a Stripe Checkout session for subscription signup

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.14.0"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface CheckoutRequest {
  priceId: string
  successUrl?: string
  cancelUrl?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Initialize Supabase client with the user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get request body
    const { priceId, successUrl, cancelUrl }: CheckoutRequest = await req.json()

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "Missing priceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get the user's current organization
    const { data: userOrg, error: orgError } = await supabase
      .from("user_orgs")
      .select("org_id, organization:organizations(id, name)")
      .eq("user_id", user.id)
      .single()

    if (orgError || !userOrg) {
      return new Response(
        JSON.stringify({ error: "User must belong to an organization" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const orgId = userOrg.org_id
    const orgName = (userOrg.organization as any)?.name || "Organization"

    // Check if org already has an active subscription
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id, subscription_status, stripe_subscription_id")
      .eq("org_id", orgId)
      .in("subscription_status", ["active", "trialing"])
      .single()

    if (existingSub) {
      return new Response(
        JSON.stringify({ 
          error: "Organization already has an active subscription",
          subscription_id: existingSub.stripe_subscription_id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if org already has a Stripe customer
    const { data: existingCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .single()

    let customerId: string | undefined

    if (existingCustomer) {
      customerId = existingCustomer.stripe_customer_id
    }

    // Create checkout session
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173"

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      // IMPORTANT: client_reference_id links the checkout to the organization
      client_reference_id: orgId,
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      // Allow promotion codes for discounts
      allow_promotion_codes: true,
      // Billing address collection
      billing_address_collection: "required",
      // Tax collection (enable if using Stripe Tax)
      // automatic_tax: { enabled: true },
      // Success and cancel URLs
      success_url: successUrl || `${appUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${appUrl}/subscribe?canceled=true`,
      // Subscription metadata
      subscription_data: {
        metadata: {
          org_id: orgId,
          org_name: orgName,
          created_by_user_id: user.id,
        },
      },
      // Customer creation behavior
      customer_creation: customerId ? undefined : "always",
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Error creating checkout session:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
