import { useEffect, useState, useTransition, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { Link } from "react-router-dom";
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
import type { OrganizationBilling, Project } from "@/lib/types";
import { Button } from "@/components/Button";
import { ArrowRightIcon, CheckIcon, CreditCardIcon, ImageOffIcon, LayersIcon, LockIcon, SparkleIcon } from "@/components/icons";

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
  const [projects, setProjects] = useState<Pick<Project, "id" | "name">[]>([]);
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
        supabase
          .from("projects")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("created_at")
          .then(({ data }) => {
            if (!cancelled) setProjects(data ?? []);
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

  function chooseActiveProject(projectId: string) {
    if (!organizationId) return;
    setActionError(null);
    startTransition(async () => {
      const { error } = await supabase.rpc("set_active_project", { p_org_id: organizationId, p_project_id: projectId });
      if (error) {
        setActionError(getErrorMessage(error, "Couldn't change the active project."));
        return;
      }
      const { data } = await supabase.rpc("organization_usage", { p_org_id: organizationId });
      setUsage((data as OrganizationUsage | null) ?? null);
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
  // Exempt organizations (0019's limits_exempt, e.g. the team's own dogfood
  // org) are unlimited whatever `plan` says, so don't present them as Free.
  const limitsWaived = !isPaid && billing.limits_exempt === true;
  const lockedReports = usage?.locked_reports ?? 0;
  const pausedIds = usage?.paused_project_ids ?? [];
  const activeProject = projects.find((p) => !pausedIds.includes(p.id));
  const indiePrice = billingInterval === "year" ? INDIE_PRICE_ANNUAL_USD : INDIE_PRICE_MONTHLY_USD;
  const showHero = !isPaid && !limitsWaived;
  const heroHeadline =
    pausedIds.length > 0
      ? `Bring your ${pausedIds.length} paused ${pausedIds.length === 1 ? "project" : "projects"} back to life`
      : lockedReports > 0
        ? `${lockedReports} ${lockedReports === 1 ? "report is" : "reports are"} waiting for you`
        : trialDays !== null
          ? `Keep the momentum: ${trialDays} ${trialDays === 1 ? "day" : "days"} left in your trial`
          : "Ship every app with Indie";
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
      {showHero ? (
        <UpgradeHero
          headline={heroHeadline}
          interval={billingInterval}
          onIntervalChange={setBillingInterval}
          price={indiePrice}
          isOwner={isOwner}
          isPending={isPending}
          onUpgrade={upgrade}
          ownerNote={`Only an owner of ${current.name} can change the plan.`}
        />
      ) : null}

      {!isPaid && (lockedReports > 0 || pausedIds.length > 0 || usage?.media_grace_until) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {lockedReports > 0 ? (
            <StatusCard icon={<LockIcon className="h-4 w-4" />} tone="red" title={`${lockedReports} ${lockedReports === 1 ? "report is" : "reports are"} waiting`}>
              Locked because this month&apos;s {FREE_LIMITS.reportsPerMonth} Free reports are used. Upgrade to Indie and{" "}
              {lockedReports === 1 ? "it unlocks" : "they unlock"} right away.
            </StatusCard>
          ) : null}
          {pausedIds.length > 0 ? (
            <StatusCard
              icon={<LayersIcon className="h-4 w-4" />}
              tone="neutral"
              title={`${pausedIds.length} of ${projects.length} projects paused`}
            >
              The Free plan includes {FREE_LIMITS.projects} active project. Paused projects keep their history, and their
              apps keep sending, but new reports arrive locked until you upgrade.
              {isOwner && projects.length > 1 ? (
                <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-neutral-700">
                  Active project
                  <select
                    value={activeProject?.id ?? ""}
                    disabled={isPending}
                    onChange={(e) => chooseActiveProject(e.target.value)}
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : activeProject ? (
                <span className="mt-2 block text-neutral-700">
                  Active project: <span className="font-medium">{activeProject.name}</span>
                </span>
              ) : null}
            </StatusCard>
          ) : null}
          {usage?.media_grace_until ? (
            <StatusCard icon={<ImageOffIcon className="h-4 w-4" />} tone="amber" title="Older screenshots have a deadline">
              On Free, screenshots and attachments are kept {FREE_LIMITS.retentionDays} days. Older ones will be removed on{" "}
              {new Date(usage.media_grace_until).toLocaleDateString()} unless you upgrade before then; report text is always
              kept.
            </StatusCard>
          ) : null}
        </div>
      ) : null}

      {isPaid && (billing.status === "active" || billing.status === "trialing") ? (
        <PaidCelebration planName={PLAN_NAME[billing.plan]} />
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
            <CreditCardIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-medium text-neutral-900">Current plan</h2>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-neutral-900">
              {trialDays !== null ? "Indie trial" : limitsWaived ? "Free · limits waived" : PLAN_NAME[billing.plan]}
              {isPaid || trialDays !== null ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  {trialDays !== null ? "Trial" : "Active"}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {trialDays !== null
                ? `${trialDays} ${trialDays === 1 ? "day" : "days"} left, then Free unless you upgrade`
                : limitsWaived
                  ? "Plan limits don't apply to this organization: projects, members and reports are unlimited"
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
            ) : showHero ? null : (
              <IntervalToggle value={billingInterval} onChange={setBillingInterval} />
            )}
          </div>
          <div className="grid items-stretch gap-6 md:grid-cols-2">
            <PlanCard
              title="Free"
              price="$0"
              features={FREE_FEATURES}
              current={!isPaid && trialDays === null && !limitsWaived}
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
              badge={!isPaid ? "Recommended" : undefined}
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
                    <Button disabled={isPending || !isOwner} onClick={upgrade} className="w-full">
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
  badge,
  price,
  priceNote,
  features,
  current = false,
  highlight = false,
  action,
}: {
  title: string;
  badge?: string;
  price: string;
  priceNote?: string;
  features: string[];
  current?: boolean;
  highlight?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl bg-white p-6 transition-shadow duration-300 sm:p-8 ${
        highlight ? "border-2 border-neutral-900 shadow-md hover:shadow-lg" : "border border-neutral-200 shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        <div className="flex items-center gap-1.5">
          {badge ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{badge}</span>
          ) : null}
          {current ? (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">Current</span>
          ) : null}
        </div>
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-4xl font-semibold tracking-tight text-neutral-900">{price}</span>
        {priceNote ? <span className="text-sm text-neutral-500">{priceNote}</span> : null}
      </p>
      <ul className="mt-6 flex-1 space-y-3 text-sm text-neutral-600">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {feature}
          </li>
        ))}
      </ul>
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  );
}

function StatusCard({
  icon,
  tone,
  title,
  children,
}: {
  icon: ReactNode;
  tone: "red" | "amber" | "neutral";
  title: string;
  children: ReactNode;
}) {
  const bubble = {
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    neutral: "bg-neutral-100 text-neutral-600",
  }[tone];
  return (
    <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bubble}`}>{icon}</span>
      <div className="min-w-0 text-sm text-neutral-600">
        <h2 className="font-medium text-neutral-900">{title}</h2>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

/** Confetti pieces for PaidCelebration: position, color, size and tilt. */
const CONFETTI = [
  { left: "4%", top: "10%", color: "bg-violet-400", size: "h-2 w-4", rotate: "rotate-12" },
  { left: "16%", top: "86%", color: "bg-emerald-400", size: "h-2.5 w-2.5 rounded-full", rotate: "" },
  { left: "30%", top: "8%", color: "bg-amber-300", size: "h-1.5 w-3", rotate: "-rotate-12" },
  { left: "47%", top: "88%", color: "bg-sky-400", size: "h-2 w-2 rounded-full", rotate: "" },
  { left: "60%", top: "10%", color: "bg-pink-400", size: "h-1.5 w-3.5", rotate: "rotate-45" },
  { left: "70%", top: "60%", color: "bg-violet-300", size: "h-2.5 w-2.5 rounded-full", rotate: "" },
  { left: "82%", top: "12%", color: "bg-emerald-300", size: "h-2 w-4", rotate: "-rotate-45" },
  { left: "95%", top: "84%", color: "bg-amber-400", size: "h-2 w-2 rounded-full", rotate: "" },
];

/**
 * A thank-you above the current plan for an organization that's paying:
 * confetti on a soft violet → mint wash, what the plan unlocks, and a nudge
 * back to the work.
 */
function PaidCelebration({ planName }: { planName: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-violet-50 via-white to-emerald-50 px-6 py-7 shadow-sm sm:px-8">
      {CONFETTI.map((piece) => (
        <span
          key={`${piece.left}-${piece.top}`}
          aria-hidden
          className={`pointer-events-none absolute rounded-sm opacity-70 ${piece.color} ${piece.size} ${piece.rotate}`}
          style={{ left: piece.left, top: piece.top }}
        />
      ))}
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
            You&apos;re on {planName}. Thanks for backing FeedbackKit!
          </h2>
          <p className="mt-1 max-w-xl text-sm text-neutral-600">
            Every app, every report and every screenshot is yours to keep. Now go close some loops: your users are
            about to see their bugs fixed faster than ever.
          </p>
        </div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-800 active:translate-y-0 active:scale-95"
        >
          Open your projects
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

/**
 * The upgrade pitch for an organization that isn't paying: what Indie
 * unlocks, the price for the chosen interval and the checkout button, on the
 * same dark surface as the landing page's closing call to action.
 */
function UpgradeHero({
  headline,
  interval,
  onIntervalChange,
  price,
  isOwner,
  isPending,
  onUpgrade,
  ownerNote,
}: {
  headline: string;
  interval: BillingInterval;
  onIntervalChange: (value: BillingInterval) => void;
  price: number;
  isOwner: boolean;
  isPending: boolean;
  onUpgrade: () => void;
  ownerNote: string;
}) {
  const perks = [
    "Unlimited apps and reports",
    `Up to ${INDIE_LIMITS.members} teammates`,
    "Screenshots kept while you're subscribed",
    "The full fix loop, on every app",
  ];
  const perMonth = interval === "year" ? INDIE_PRICE_ANNUAL_USD / 12 : null;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl"
      />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-white/15">
            <SparkleIcon className="h-3.5 w-3.5 text-emerald-300" />
            Indie plan
          </span>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{headline}</h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-300 sm:text-base">
            Every report from every app lands in one inbox, goes to your coding agent, and comes back to the reporter
            fixed. One flat price, no seat math.
          </p>
          <ul className="mt-6 grid gap-2.5 text-sm text-neutral-200 sm:grid-cols-2">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                {perk}
              </li>
            ))}
          </ul>
        </div>
        <div className="w-full rounded-xl bg-white/5 p-5 ring-1 ring-white/10 lg:w-80">
          <div className="inline-flex w-full rounded-lg bg-white/10 p-0.5">
            {(["month", "year"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={interval === value}
                onClick={() => onIntervalChange(value)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                  interval === value ? "bg-white text-neutral-900 shadow-sm" : "text-white/70 hover:text-white"
                }`}
              >
                {value === "month" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="text-4xl font-semibold tracking-tight">{formatUsd(price)}</span>
            <span className="text-sm text-neutral-400">/ {interval === "year" ? "year" : "month"}</span>
          </p>
          <p className="mt-1 h-4 text-xs text-emerald-300">
            {perMonth
              ? `That's ${formatUsd(Math.round(perMonth * 100) / 100)} a month · ${annualMonthsFree()} months free`
              : `Save ${annualMonthsFree()} months with yearly`}
          </p>
          <button
            type="button"
            disabled={isPending || !isOwner}
            onClick={onUpgrade}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-white py-2.5 text-sm font-semibold text-neutral-900 transition-all duration-150 hover:-translate-y-0.5 hover:bg-neutral-100 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Opening checkout…" : "Upgrade to Indie"}
            {isPending ? null : <ArrowRightIcon className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-center text-xs text-neutral-400">
            {isOwner ? "Cancel anytime. Have a promo code? Enter it at checkout." : ownerNote}
          </p>
        </div>
      </div>
    </section>
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
