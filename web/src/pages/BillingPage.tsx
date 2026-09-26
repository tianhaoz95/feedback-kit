import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import { billableSeats, formatUsd, TEAM_PRICE_PER_SEAT_USD, teamMonthlyTotal } from "@/lib/pricing";
import type { OrganizationBilling } from "@/lib/types";
import { Button } from "@/components/Button";
import { CheckIcon, CreditCardIcon, UsersIcon } from "@/components/icons";

// Placeholder feature copy — there's no real Stripe product yet (see
// supabase/functions/create-checkout-session and
// supabase/migrations/0009_billing.sql / 0016_teams.sql). The price lives in
// lib/pricing.ts.
const FREE_FEATURES = ["1 project", "Up to 50 feedback reports / month", "Community support"];
const TEAM_FEATURES = [
  "Unlimited projects and reports",
  "Invite your whole team",
  "Notifications on web and the Portal app",
  "Priority email support",
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

export function BillingPage() {
  const { current } = useOrganization();
  const organizationId = current?.id ?? null;
  const isOwner = current?.role === "owner";
  const [billing, setBilling] = useState<OrganizationBilling | null | undefined>(undefined);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [billingNotConfigured, setBillingNotConfigured] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    (async () => {
      try {
        const [billingRes, membersRes] = await Promise.all([
          supabase
            .from("organization_billing")
            .select("*")
            .eq("organization_id", organizationId)
            .single<OrganizationBilling>(),
          supabase.from("memberships").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
        ]);
        if (cancelled) return;
        if (billingRes.error) throw billingRes.error;
        setLoadError(null);
        setBilling(billingRes.data);
        setMemberCount(membersRes.count ?? 1);
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
      const base = `${window.location.origin}${import.meta.env.BASE_URL}billing`;
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          organization_id: organizationId,
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
  const seats = billableSeats(billing.seats ?? memberCount ?? 1);
  const total = teamMonthlyTotal(seats);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Billing is per organization. You're looking at{" "}
          <span className="font-medium text-neutral-700">{current.name}</span>. FeedbackKit is free while it's early;
          the Team plan below isn't live yet.
        </p>
      </div>

      {billingNotConfigured ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Payments aren't switched on yet, so nothing was charged. Check back soon.
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
      ) : null}

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CreditCardIcon className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-900">Current plan</h2>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-neutral-900">{isPaid ? "Team" : "Free"}</p>
            <p className="text-sm text-neutral-500">
              {STATUS_LABEL[billing.status]}
              {isPaid ? ` · ${seats} ${seats === 1 ? "seat" : "seats"} · ${formatUsd(total)}/month` : ""}
              {billing.current_period_end
                ? ` · Renews ${new Date(billing.current_period_end).toLocaleDateString()}`
                : ""}
              {billing.cancel_at_period_end ? " · Cancels at period end" : ""}
            </p>
          </div>
          {isPaid && isOwner ? (
            <Button variant="secondary" size="sm" disabled={isPending} onClick={manage}>
              {isPending ? "Opening…" : "Manage billing"}
            </Button>
          ) : null}
        </div>
      </div>

      {!isPaid ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <PlanCard title="Free" price="$0" features={FREE_FEATURES} current />
          <PlanCard
            title="Team"
            price={formatUsd(TEAM_PRICE_PER_SEAT_USD)}
            priceNote="per member / month"
            features={TEAM_FEATURES}
            highlight
            action={
              <div className="space-y-3">
                <div className="rounded-lg bg-neutral-50 p-3 text-sm">
                  <div className="flex items-center justify-between text-neutral-600">
                    <span className="flex items-center gap-1.5">
                      <UsersIcon className="h-4 w-4 text-neutral-400" />
                      {seats} {seats === 1 ? "member" : "members"} × {formatUsd(TEAM_PRICE_PER_SEAT_USD)}
                    </span>
                    <span className="font-semibold text-neutral-900">{formatUsd(total)}/mo</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Seats follow your <Link to="/team" className="underline">team</Link>: adding or removing someone
                    changes the next invoice, prorated.
                  </p>
                </div>
                <Button size="sm" disabled={isPending || !isOwner} onClick={upgrade} className="w-full">
                  {isPending ? "Opening…" : `Upgrade to Team · ${formatUsd(total)}/mo`}
                </Button>
                {!isOwner ? (
                  <p className="text-center text-xs text-neutral-500">Only an owner of {current.name} can change the plan.</p>
                ) : null}
              </div>
            }
          />
        </div>
      ) : null}
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
