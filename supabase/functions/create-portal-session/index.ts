// Starts a Stripe Billing Portal session so a subscribed organization can
// update payment details, change plans, or cancel — the dashboard just
// redirects to whatever URL this returns. Same auth shape as
// create-checkout-session (see that function's comment).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, notConfigured } from "../_shared/http.ts";
import { getStripe } from "../_shared/stripe.ts";

interface RequestBody {
  organization_id: string;
  return_url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!body.organization_id || !body.return_url) {
    return json({ error: "missing required fields" }, 400);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing Authorization header" }, 401);

  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: billing, error: billingError } = await callerClient
    .from("organization_billing")
    .select("stripe_customer_id")
    .eq("organization_id", body.organization_id)
    .single();
  if (billingError || !billing) {
    return json({ error: "unknown organization, or you're not a member of it" }, 403);
  }

  const stripe = getStripe();
  if (!stripe) {
    return notConfigured("Billing isn't set up yet — check back soon.");
  }

  if (!billing.stripe_customer_id) {
    return json({ error: "no_billing_account", message: "Subscribe to a plan first." }, 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: body.return_url,
  });

  return json({ url: session.url }, 200);
});
