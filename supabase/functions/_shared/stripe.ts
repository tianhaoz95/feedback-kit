// Thin wrapper so every billing function checks for/creates a Stripe client
// the same way. Returns null (never throws) when STRIPE_SECRET_KEY isn't
// set — that's the expected, default state until a real Stripe account
// exists — so callers can respond with `notConfigured()` (see http.ts)
// instead of a raw exception.
import Stripe from "npm:stripe@17";

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  cached = key
    ? new Stripe(key, {
        apiVersion: "2025-08-27.basil",
        httpClient: Stripe.createFetchHttpClient(),
      })
    : null;
  return cached;
}

/** The Stripe Price id for the (currently only) paid plan. */
export function getProPriceId(): string | null {
  return Deno.env.get("STRIPE_PRICE_ID_PRO") ?? null;
}
