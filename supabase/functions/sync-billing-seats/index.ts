// Keeps a Team subscription's quantity equal to the organization's member
// count. The dashboard and Portal call it (best effort) right after someone
// joins, leaves or is removed, with the caller's own Supabase session —
// `verify_jwt` stays at its default (true), and RLS decides whether the
// caller can see the organization, as in create-checkout-session.
//
// Answers 501 `billing_not_configured` until Stripe is set up (the expected
// state for now), and `{ synced: false }` for an organization without a
// subscription. Stripe prorates the change onto the next invoice.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, json, notConfigured } from "../_shared/http.ts";
import { countSeats, getStripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let organizationId: string | undefined;
  try {
    organizationId = (await req.json()).organization_id;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!organizationId) return json({ error: "missing organization_id" }, 400);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing Authorization header" }, 401);

  const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  // A member who just left can no longer see the organization, so this also
  // accepts the call when the caller *was* removed: the seat count comes from
  // the service-role client below either way, and syncing can only ever make
  // Stripe match the truth.
  const { data: org } = await callerClient.from("organizations").select("id").eq("id", organizationId).maybeSingle();

  const stripe = getStripe();
  if (!stripe) return notConfigured("Billing isn't set up yet — check back soon.");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: billing, error } = await admin
    .from("organization_billing")
    .select("stripe_subscription_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return json({ error: "failed to load billing account", detail: error.message }, 500);
  if (!org && !billing) return json({ error: "unknown organization" }, 404);
  if (!billing?.stripe_subscription_id || billing.status === "canceled") return json({ synced: false }, 200);

  const seats = await countSeats(admin, organizationId);
  const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
  const item = subscription.items.data[0];
  if (!item) return json({ synced: false }, 200);
  if (item.quantity !== seats) {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, quantity: seats }],
      proration_behavior: "create_prorations",
    });
  }
  await admin.from("organization_billing").update({ seats, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);

  return json({ synced: true, seats }, 200);
});
