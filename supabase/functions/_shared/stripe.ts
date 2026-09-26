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

/**
 * The Stripe Price id for the Team plan: a recurring per-seat price, billed
 * with quantity = the organization's member count. STRIPE_PRICE_ID_PRO is
 * still read as a fallback for projects configured before Team existed.
 */
export function getTeamPriceId(): string | null {
  return Deno.env.get("STRIPE_PRICE_ID_TEAM") ?? Deno.env.get("STRIPE_PRICE_ID_PRO") ?? null;
}

// deno-lint-ignore no-explicit-any
type AdminClient = { from: (table: string) => any };

/** Seats billed for an organization: one per member. */
export async function countSeats(admin: AdminClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) throw new Error(`failed to count members: ${error.message}`);
  return Math.max(1, count ?? 1);
}
