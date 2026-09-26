// Starts a Stripe Checkout session for an organization to subscribe to the
// Team plan, billed per member (quantity = current member count; kept in
// step afterwards by sync-billing-seats). Called by the dashboard's Billing page
// (web/src/pages/BillingPage.tsx) with the signed-in user's own Supabase
// session — `verify_jwt` is left at its default (true, see
// supabase/config.toml), so the platform has already rejected the request
// by the time this code runs if the JWT isn't valid.
//
// Returns `{ error: "billing_not_configured" }` (501) rather than failing
// weirdly when STRIPE_SECRET_KEY/STRIPE_PRICE_ID_TEAM aren't set yet — the
// expected state until a real Stripe account exists. See
// supabase/functions/_shared/stripe.ts.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, notConfigured } from "../_shared/http.ts";
import { countSeats, getStripe, getTeamPriceId } from "../_shared/stripe.ts";

interface RequestBody {
  organization_id: string;
  success_url: string;
  cancel_url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!body.organization_id || !body.success_url || !body.cancel_url) {
    return json({ error: "missing required fields" }, 400);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing Authorization header" }, 401);

  // Scoped to the caller via their own JWT, not service role — RLS decides
  // whether they can actually see this organization, the same way the
  // dashboard's own queries are scoped. Nothing here duplicates that check
  // in application code (see CLAUDE.md's note on RLS-vs-app-code checks).
  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: org, error: orgError } = await callerClient
    .from("organizations")
    .select("id")
    .eq("id", body.organization_id)
    .single();
  if (orgError || !org) {
    return json({ error: "unknown organization, or you're not a member of it" }, 403);
  }

  // Subscribing commits the whole organization to paying, so it's an owner's call.
  const { data: isOwner } = await callerClient.rpc("is_org_owner", { p_org_id: body.organization_id });
  if (!isOwner) {
    return json({ error: "only an owner can change the plan", message: "Only an owner can change the plan." }, 403);
  }

  const stripe = getStripe();
  const priceId = getTeamPriceId();
  if (!stripe || !priceId) {
    return notConfigured("Billing isn't set up yet — check back soon.");
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: billing, error: billingError } = await admin
    .from("organization_billing")
    .select("stripe_customer_id")
    .eq("organization_id", body.organization_id)
    .single();
  if (billingError) {
    return json({ error: "failed to load billing account", detail: billingError.message }, 500);
  }

  let customerId = billing.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { organization_id: body.organization_id },
    });
    customerId = customer.id;
    const { error: updateError } = await admin
      .from("organization_billing")
      .update({ stripe_customer_id: customerId })
      .eq("organization_id", body.organization_id);
    if (updateError) {
      return json({ error: "failed to save Stripe customer", detail: updateError.message }, 500);
    }
  }

  const seats = await countSeats(admin, body.organization_id);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: seats }],
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    metadata: { organization_id: body.organization_id },
    subscription_data: { metadata: { organization_id: body.organization_id } },
  });

  return json({ url: session.url }, 200);
});
