// Shared by every billing function (create-checkout-session,
// create-portal-session, stripe-webhook). Filenames/dirs starting with `_`
// are never deployed as functions of their own — see Supabase's Edge
// Function docs on shared code.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * The one error shape every billing endpoint returns when Stripe hasn't
 * been configured yet (no STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET) — a
 * distinct `error` code the dashboard checks for specifically, so it can
 * show "billing isn't set up yet" instead of a generic failure. 501 (Not
 * Implemented), not 500: nothing is broken, the feature just isn't turned
 * on.
 */
export function notConfigured(message: string): Response {
  return json({ error: "billing_not_configured", message }, 501);
}
