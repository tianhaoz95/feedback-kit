/**
 * Plan pricing shown on the landing and Billing pages. The charge itself
 * comes from the Stripe Prices behind STRIPE_PRICE_ID_INDIE_MONTHLY /
 * STRIPE_PRICE_ID_INDIE_ANNUAL (see supabase/functions/create-checkout-session),
 * so keep these in step with them. Larger teams are priced case by case.
 */
export const INDIE_PRICE_MONTHLY_USD = 9;
export const INDIE_PRICE_ANNUAL_USD = 79;

export type BillingInterval = "month" | "year";

/** What a year on the annual price saves over paying monthly, in whole months. */
export function annualMonthsFree(): number {
  return Math.floor((INDIE_PRICE_MONTHLY_USD * 12 - INDIE_PRICE_ANNUAL_USD) / INDIE_PRICE_MONTHLY_USD);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/**
 * Plan limits — mirror plan_limit(plan, name) in
 * supabase/migrations/0028_indie_pricing.sql, where they're enforced.
 */
export const FREE_LIMITS = { projects: 1, members: 1, reportsPerMonth: 50, retentionDays: 90 } as const;
export const INDIE_LIMITS = { members: 3, storageGb: 25 } as const;
/** Every new organization starts on Indie for this long. */
export const TRIAL_DAYS = 14;

/** organization_usage() — what the org has used against its plan's limits (null = unlimited). */
export interface OrganizationUsage {
  plan?: "free" | "indie" | "unlimited";
  limited: boolean;
  trial_ends_at?: string | null;
  reports_this_month: number;
  locked_reports?: number;
  projects: number;
  members: number;
  storage_bytes?: number;
  limits: {
    projects: number | null;
    members: number | null;
    reports_per_month: number | null;
    storage_mb?: number | null;
    retention_days?: number | null;
  };
}

/** Share of the monthly report limit used, 0…1 (0 when unlimited). */
export function reportUsageShare(usage: OrganizationUsage | null): number {
  if (!usage?.limited || !usage.limits.reports_per_month) return 0;
  return Math.min(1, usage.reports_this_month / usage.limits.reports_per_month);
}

/** Whole days left in an Indie trial, or null when the organization isn't in one. */
export function trialDaysLeft(usage: OrganizationUsage | null, billingPlan: string, now = Date.now()): number | null {
  if (!usage?.trial_ends_at || billingPlan !== "free" || usage.plan !== "indie") return null;
  const ms = new Date(usage.trial_ends_at).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 86_400_000) : null;
}
