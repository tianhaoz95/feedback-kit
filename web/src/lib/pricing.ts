/**
 * Team plan pricing shown on the Billing page. Placeholder until a real
 * Stripe Price exists (see supabase/functions/create-checkout-session): the
 * charge itself will come from that Price, so keep this in step with it.
 */
export const TEAM_PRICE_PER_SEAT_USD = 15;

/** Every member of an organization is one seat; an organization always has at least one. */
export function billableSeats(memberCount: number): number {
  return Math.max(1, Math.floor(memberCount));
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function teamMonthlyTotal(memberCount: number): number {
  return billableSeats(memberCount) * TEAM_PRICE_PER_SEAT_USD;
}
