import { useEffect, useState, useTransition, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import { SUPPORT_EMAIL } from "@/lib/company";
import {
  annualMonthsFree,
  FREE_LIMITS,
  formatUsd,
  INDIE_LIMITS,
  INDIE_PRICE_ANNUAL_USD,
  INDIE_PRICE_MONTHLY_USD,
  trialDaysLeft,
  type BillingInterval,
  type OrganizationUsage,
} from "@/lib/pricing";
import type { OrganizationBilling } from "@/lib/types";
import { Button } from "@/components/Button";
import { CheckIcon, CreditCardIcon } from "@/components/icons";

// The prices live in lib/pricing.ts and the limits in
// supabase/migrations/0028_indie_pricing.sql.
const FREE_FEATURES = [
  `${FREE_LIMITS.projects} project, ${FREE_LIMITS.members} member`,
  `${FREE_LIMITS.reportsPerMonth} readable reports / month; extras are kept, locked`,
  `Screenshots and attachments kept ${FREE_LIMITS.retentionDays} days`,
  "The full fix loop: agents, releases, reporter verification",
];
const INDIE_FEATURES = [
  "Unlimited projects and reports",
  `Up to ${INDIE_LIMITS.members} members`,
  `Screenshots kept while you're subscribed (${INDIE_LIMITS.storageGb} GB fair use)`,
  "Everything in Free",
];

const STATUS_LABEL: Record<OrganizationBilling["status"], string> = {
  none: "No subscription",
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Incomplete (expired)",
};

const PLAN_NAME: Record<OrganizationBilling["plan"], string> = {
  free: "Free",
  indie: "Indie",
  team: "Team",
  pro: "Team",
};

export function BillingPage() {
  const { current } = useOrganization();
  const organizationId = current?.id ?? null;
  const isOwner = current?.role === "owner";
  const [billing, setBilling] = useState<OrganizationBilling | null | undefined>(undefined);
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [billingNotConfigured, setBillingNotConfigured] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const billingRes = await supabase
          .from("organization_billing")
          .select("*")
          .eq("organization_id", organizationId)
          .single<OrganizationBilling>();
        // Best effort: the plan card still renders if usage can't load.
        supabase.rpc("organization_usage", { p_org_id: organizationId }).then(({ data }) => {
          if (!cancelled) setUsage((data as OrganizationUsage | null) ?? null);
        });
        if (cancelled) return;
        if (billingRes.error) throw billingRes.error;
        setLoadError(null);
        setBilling(billingRes.data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load billing information."));
          setBilling(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  async function handleFunctionError(error: unknown) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (body?.error === "billing_not_configured") {
        setBillingNotConfigured(true);
        return;
      }
      setActionError(body?.message ?? getErrorMessage(error, "Something went wrong."));
      return;
    }
    setActionError(getErrorMessage(error, "Something went wrong."));
  }

  function upgrade() {
    if (!organizationId) return;
    setActionError(null);
    setBillingNotConfigured(false);
    startTransition(async () => {
      track("checkout_started", { interval: billingInterval }, organizationId);
      const base = `${window.location.origin}${import.meta.env.BASE_URL}billing`;
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          organization_id: organizationId,
          interval: billingInterval,
          success_url: `${base}?checkout=success`,
          cancel_url: `${base}?checkout=cancel`,
        },
      });
      if (error) {
        await handleFunctionError(error);
        return;
      }
      if (data?.url) window.location.href = data.url;
    });
  }

  function manage() {
    if (!organizationId) return;
    setActionError(null);
    setBillingNotConfigured(false);
    startTransition(async () => {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          organization_id: organizationId,
          return_url: `${window.location.origin}${import.meta.env.BASE_URL}billing`,
        },
      });
      if (error) {
        await handleFunctionError(error);
        return;
      }
      if (data?.url) window.location.href = data.url;
    });
  }

  if (!current || (billing === undefined && !loadError)) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-200" />
      </div>
    );
  }

  if (loadError || !billing) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-neutral-900">Billing</h1>
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError ?? "Couldn't load billing information."}
        </div>
      </div>
    );
  }

  const isPaid = billing.plan !== "free";
  const trialDays = trialDaysLeft(usage, billing.plan);
  const lockedReports = usage?.locked_reports ?? 0;
  const indiePrice = billingInterval === "year" ? INDIE_PRICE_ANNUAL_USD : INDIE_PRICE_MONTHLY_USD;
  const indiePriceLabel = `${formatUsd(indiePrice)}/${billingInterval === "year" ? "year" : "month"}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Billing is per organization. You're looking at{" "}
          <span className="font-medium text-neutral-700">{current.name}</span>.
        </p>
      </div>

      {billingNotConfigured ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Payments aren&apos;t switched on yet, so nothing was charged. Need more than the Free plan in the meantime?
          Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          and we&apos;ll lift the limits for your organization.
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      ) : null}
      {!isPaid && lockedReports > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {lockedReports} {lockedReports === 1 ? "report is" : "reports are"} waiting, locked because this month&apos;s{" "}
          {FREE_LIMITS.reportsPerMonth} Free reports are used. Upgrade to Indie and {lockedReports === 1 ? "it unlocks" : "they unlock"}{" "}
          right away.
        </div>
      ) : null}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-900">Current plan</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-neutral-900">
              {trialDays !== null ? "Indie trial" : PLAN_NAME[billing.plan]}
            </p>
            <p className="text-sm text-neutral-500">
              {trialDays !== null
                ? `${trialDays} ${trialDays === 1 ? "day" : "days"} left, then Free unless you upgrade`
                : STATUS_LABEL[billing.status]}
              {billing.current_period_end
                ? ` · Renews ${new Date(billing.current_period_end).toLocaleDateString()}`
                : ""}
              {billing.cancel_at_period_end ? " · Cancels at period end" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isPaid ? (
              <Button variant="secondary" size="sm" onClick={() => setShowAllPlans((prev) => !prev)}>
                {showAllPlans ? "Hide available plans" : "View all plans"}
              </Button>
            ) : null}
            {isPaid && isOwner && billing.stripe_customer_id ? (
              <Button variant="secondary" size="sm" disabled={isPending} onClick={manage}>
                {isPending ? "Opening…" : "Manage billing"}
              </Button>
            ) : null}
          </div>
        </div>
        {usage?.limited ? (
          <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-3">
            <UsageMeter label="Reports this month" used={usage.reports_this_month} limit={usage.limits.reports_per_month} />
            <UsageMeter label="Projects" used={usage.projects} limit={usage.limits.projects} />
            <UsageMeter label="Members" used={usage.members} limit={usage.limits.members} />
          </div>
        ) : usage?.plan === "indie" ? (
          <div className="mt-4 grid gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2">
            <UsageMeter label="Members" used={usage.members} limit={usage.limits.members} />
            <UsageMeter
              label="Storage (GB)"
              used={Math.round(((usage.storage_bytes ?? 0) / 1024 ** 3) * 100) / 100}
              limit={usage.limits.storage_mb ? usage.limits.storage_mb / 1024 : null}
            />
          </div>
        ) : null}
      </div>

      {!isPaid || showAllPlans ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-neutral-900">Available plans</h2>
            {isPaid ? (
              <button
                type="button"
                onClick={() => setShowAllPlans(false)}
                className="text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer"
              >
                Close
              </button>
            ) : (
              <IntervalToggle value={billingInterval} onChange={setBillingInterval} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PlanCard
              title="Free"
              price="$0"
              features={FREE_FEATURES}
              current={!isPaid && trialDays === null}
              action={
                isPaid ? (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-500">
                      To move back to Free, cancel your subscription in the Stripe billing portal.
                    </p>
                    {isOwner && billing.stripe_customer_id ? (
                      <Button variant="secondary" size="sm" disabled={isPending} onClick={manage} className="w-full">
                        Manage via billing portal
                      </Button>
                    ) : null}
                  </div>
                ) : undefined
              }
            />
            <PlanCard
              title="Indie"
              price={formatUsd(isPaid ? INDIE_PRICE_MONTHLY_USD : indiePrice)}
              priceNote={isPaid || billingInterval === "month" ? "/ month, flat" : `/ year, flat (${annualMonthsFree()} months free)`}
              features={INDIE_FEATURES}
              current={billing.plan === "indie" || trialDays !== null}
              highlight={!isPaid}
              action={
                isPaid ? (
                  billing.plan === "indie" && isOwner && billing.stripe_customer_id ? (
                    <Button variant="secondary" size="sm" disabled={isPending} onClick={manage} className="w-full">
                      {isPending ? "Opening…" : "Manage subscription in Stripe"}
                    </Button>
                  ) : undefined
                ) : (
                  <div className="space-y-2">
                    <Button size="sm" disabled={isPending || !isOwner} onClick={upgrade} className="w-full">
                      {isPending ? "Opening…" : `Upgrade to Indie · ${indiePriceLabel}`}
                    </Button>
                    <p className="text-center text-xs text-neutral-500">
                      {isOwner
                        ? "Have a promo code? Enter it at checkout."
                        : `Only an owner of ${current.name} can change the plan.`}
                    </p>
                  </div>
                )
              }
            />
          </div>
          <p className="text-sm text-neutral-600">
            More than {INDIE_LIMITS.members} people?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`FeedbackKit for ${current.name}`)}`}
              className="font-medium text-neutral-900 underline"
            >
              Email {SUPPORT_EMAIL}
            </a>{" "}
            and we&apos;ll set up a plan for your team.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function IntervalToggle({ value, onChange }: { value: BillingInterval; onChange: (value: BillingInterval) => void }) {
  const option = (interval: BillingInterval, label: string) => (
    <button
      type="button"
      aria-pressed={value === interval}
      onClick={() => onChange(interval)}
      className={`rounded-md px-3 py-1 text-xs font-medium cursor-pointer ${
        value === interval ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex rounded-lg bg-neutral-100 p-0.5">
      {option("month", "Monthly")}
      {option("year", `Yearly · ${annualMonthsFree()} months free`)}
    </div>
  );
}

function PlanCard({
  title,
  price,
  priceNote,
  features,
  current = false,
  highlight = false,
  action,
}: {
  title: string;
  price: string;
  priceNote?: string;
  features: string[];
  current?: boolean;
  highlight?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${
        highlight ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {current ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">
        {price}
        {priceNote ? <span className="ml-1 text-sm font-normal text-neutral-500">{priceNote}</span> : null}
      </p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-neutral-600">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {feature}
          </li>
        ))}
      </ul>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const share = limit ? Math.min(1, used / limit) : 0;
  const tone = share >= 1 ? "bg-red-500" : share >= 0.8 ? "bg-amber-500" : "bg-neutral-900";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium text-neutral-900">
          {used} / {limit ?? "∞"}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-neutral-100">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
