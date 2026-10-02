// Thin wrapper so every billing function checks for/creates a Stripe client
// the same way. Returns null (never throws) when STRIPE_SECRET_KEY isn't
// set — that's the expected, default state until a real Stripe account
// exists — so callers can respond with `notConfigured()` (see http.ts)
// instead of a raw exception.
import Stripe from "npm:stripe@18.5.0";

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

export type BillingInterval = "month" | "year";

/**
 * The Stripe Price ids for the Indie plan: flat recurring prices ($9/month,
 * $79/year — see web/src/lib/pricing.ts), billed with quantity 1 whatever
 * the member count.
 */
export function getIndiePriceId(interval: BillingInterval): string | null {
  return Deno.env.get(interval === "year" ? "STRIPE_PRICE_ID_INDIE_ANNUAL" : "STRIPE_PRICE_ID_INDIE_MONTHLY") ?? null;
}

/**
 * The plan a subscription's price puts an organization on: the Indie prices
 * mean 'indie'; anything else is a larger team's custom price, set up by
 * hand in Stripe, so 'team' (unlimited — see 0028_indie_pricing.sql).
 */
export function planForPrice(priceId: string | undefined): "indie" | "team" {
  const indie = [Deno.env.get("STRIPE_PRICE_ID_INDIE_MONTHLY"), Deno.env.get("STRIPE_PRICE_ID_INDIE_ANNUAL")];
  return priceId && indie.includes(priceId) ? "indie" : "team";
}
