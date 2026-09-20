// Stripe calls this directly (not the dashboard), so it's authenticated by
// verifying the `Stripe-Signature` header against STRIPE_WEBHOOK_SECRET —
// not a Supabase JWT. `verify_jwt = false` for this function in
// supabase/config.toml, same reasoning as ingest-feedback's anonymous
// project_key auth: the caller can't present a Supabase session.
//
// Keeps organization_billing (supabase/migrations/0009_billing.sql) in
// sync with whatever Stripe reports. Uses the service-role key throughout —
// there's no authenticated user on this request for RLS to scope to, and
// Stripe's signature is the trust boundary here, the same way project_key
// is ingest-feedback's.
//
// Register this endpoint's URL (https://<project-ref>.supabase.co/functions/v1/stripe-webhook)
// in the Stripe Dashboard (or `stripe listen --forward-to` locally) for at
// least: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted.
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { json, notConfigured } from "../_shared/http.ts";
import { getStripe } from "../_shared/stripe.ts";

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Maps a Stripe subscription status onto this project's `billing_status` enum — they're spelled identically on purpose. */
function toBillingStatus(status: Stripe.Subscription.Status): string {
  return status;
}

async function upsertFromSubscription(subscription: Stripe.Subscription, organizationId: string) {
  const item = subscription.items.data[0];
  const { error } = await admin()
    .from("organization_billing")
    .update({
      plan: "pro",
      status: toBillingStatus(subscription.status),
      stripe_subscription_id: subscription.id,
      current_period_end: item ? new Date(item.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  if (error) throw new Error(`failed to update organization_billing: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const stripe = getStripe();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripe || !webhookSecret) {
    return notConfigured("Stripe webhook isn't configured yet.");
  }

  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return json({ error: "missing Stripe-Signature header" }, 400);

  const body = await req.text();
  let event: Stripe.Event;
  try {
    // constructEventAsync (not the sync constructEvent) + an explicit
    // SubtleCrypto provider — Deno has no Node `crypto` module, which the
    // sync verifier needs. See Stripe's own Deno/edge-function docs.
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    return json({ error: "invalid signature", detail: err instanceof Error ? err.message : String(err) }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organization_id;
        if (!organizationId || typeof session.subscription !== "string") break;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await upsertFromSubscription(subscription, organizationId);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organization_id;
        if (!organizationId) break;
        await upsertFromSubscription(subscription, organizationId);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organization_id;
        if (!organizationId) break;
        const { error } = await admin()
          .from("organization_billing")
          .update({
            plan: "free",
            status: "canceled",
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);
        if (error) throw new Error(`failed to reset organization_billing: ${error.message}`);
        break;
      }
      default:
        // Everything else is intentionally ignored — this endpoint only
        // needs to track plan/status, not build a full billing history.
        break;
    }
  } catch (err) {
    return json({ error: "webhook handler failed", detail: err instanceof Error ? err.message : String(err) }, 500);
  }

  return json({ received: true }, 200);
});
