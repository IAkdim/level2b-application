// Create Checkout Session - Supabase Edge Function
// Generates a Stripe Checkout session for subscription signup
// Subscriptions are per-user (account), not per-organization

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
  console.log("=== create-checkout-session called ===")
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.log("ERROR: Missing authorization header")
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
      console.log("ERROR: Unauthorized -", userError?.message)
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    console.log("User authenticated:", user.id, user.email)

    // Get request body
    const { priceId, successUrl, cancelUrl }: CheckoutRequest = await req.json()
    console.log("Request priceId:", priceId)

    if (!priceId) {
      console.log("ERROR: Missing priceId")
      return new Response(
        JSON.stringify({ error: "Missing priceId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if user already has an active subscription
    let existingSub = null
    try {
      const { data, error: subError } = await supabase
        .from("subscriptions")
        .select("id, subscription_status, stripe_subscription_id")
        .eq("user_id", user.id)
        .in("subscription_status", ["active", "trialing"])
        .single()
      
      if (!subError) {
        existingSub = data
      }
      console.log("Subscription check result:", existingSub ? "found" : "none", subError?.message || "")
    } catch (e) {
      console.log("Subscription check skipped (table may not exist)")
    }

    if (existingSub) {
      console.log("ERROR: User already has an active subscription")
      return new Response(
        JSON.stringify({ 
          error: "You already have an active subscription",
          subscription_id: existingSub.stripe_subscription_id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if user already has a Stripe customer
    const { data: existingCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()

    let customerId: string | undefined

    if (existingCustomer) {
      // Verify the customer still exists in Stripe
      try {
        await stripe.customers.retrieve(existingCustomer.stripe_customer_id)
        customerId = existingCustomer.stripe_customer_id
        console.log("Existing Stripe customer verified:", customerId)
      } catch (stripeErr: any) {
        // Customer doesn't exist in Stripe anymore - delete the stale record
        if (stripeErr.code === "resource_missing") {
          console.log("Stale Stripe customer detected, removing from database:", existingCustomer.stripe_customer_id)
          await supabase
            .from("stripe_customers")
            .delete()
            .eq("user_id", user.id)
          customerId = undefined // Will let Stripe create a new customer
        } else {
          throw stripeErr // Re-throw other errors
        }
      }
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
      // IMPORTANT: client_reference_id links the checkout to the user
      client_reference_id: user.id,
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      // Allow promotion codes for discounts
      allow_promotion_codes: true,
      // Billing address collection
      billing_address_collection: "required",
      // Success and cancel URLs
      success_url: successUrl || `${appUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${appUrl}/subscribe?canceled=true`,
      // Subscription metadata
      subscription_data: {
        metadata: {
          user_id: user.id,
          user_email: user.email || "",
        },
      },
      // Note: customer_creation is not allowed in subscription mode
      // Stripe automatically creates a customer for subscriptions
    }

    console.log("Creating Stripe checkout session...")
    const session = await stripe.checkout.sessions.create(sessionParams)
    console.log("Checkout session created:", session.id)

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("ERROR creating checkout session:", error.message, error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
