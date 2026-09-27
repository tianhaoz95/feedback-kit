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

/**
 * Free plan limits — mirrors plan_limit() in
 * supabase/migrations/0019_plan_limits.sql, where they're enforced.
 */
export const FREE_LIMITS = { projects: 1, members: 3, reportsPerMonth: 50 } as const;

/** organization_usage() — what the org has used against its plan's limits. */
export interface OrganizationUsage {
  limited: boolean;
  reports_this_month: number;
  projects: number;
  members: number;
  limits: { projects: number; members: number; reports_per_month: number };
}

/** Share of the monthly report limit used, 0…1 (0 when unlimited). */
export function reportUsageShare(usage: OrganizationUsage | null): number {
  if (!usage?.limited) return 0;
  return Math.min(1, usage.reports_this_month / usage.limits.reports_per_month);
}
