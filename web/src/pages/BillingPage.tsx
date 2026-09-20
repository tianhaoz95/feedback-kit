import { useEffect, useState, useTransition } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getCurrentOrganizationId } from "@/lib/organization";
import { getErrorMessage } from "@/lib/errors";
import type { OrganizationBilling } from "@/lib/types";
import { Button } from "@/components/Button";
import { CheckIcon, CreditCardIcon } from "@/components/icons";

// Placeholder pricing/feature copy — there's no real Stripe product yet
// (see supabase/functions/create-checkout-session and
// supabase/migrations/0009_billing.sql). Update this once one exists; it's
// not read from anywhere else, just written here for the page to show.
const PRO_PRICE = "$29/month";
const FREE_FEATURES = ["1 project", "Up to 50 feedback reports / month", "Community support"];
const PRO_FEATURES = [
  "Unlimited projects",
  "Unlimited feedback reports",
  "Priority email support",
  "Custom prompt templates per project",
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
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [billing, setBilling] = useState<OrganizationBilling | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [billingNotConfigured, setBillingNotConfigured] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgId = await getCurrentOrganizationId();
        if (cancelled) return;
        if (!orgId) {
          setLoadError("No organization is associated with your account.");
          setBilling(null);
          return;
        }
        setOrganizationId(orgId);

        const { data, error } = await supabase
          .from("organization_billing")
          .select("*")
          .eq("organization_id", orgId)
          .single<OrganizationBilling>();
        if (cancelled) return;
        if (error) throw error;
        setBilling(data);
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
  }, []);

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

  if (billing === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-200" />
      </div>
    );
  }

  if (loadError || billing === null) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-neutral-900">Billing</h1>
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError ?? "Couldn't load billing information."}
        </div>
      </div>
    );
  }

  const isPaid = billing.plan === "pro";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Billing</h1>
        <p className="mt-1 text-sm text-neutral-500">
          FeedbackKit is free while it's early — this is where a subscription will live once
          there's a paid plan to subscribe to.
        </p>
      </div>

      {billingNotConfigured ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Billing isn't set up yet — check back soon.
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
            <p className="text-lg font-semibold capitalize text-neutral-900">{billing.plan}</p>
            <p className="text-sm text-neutral-500">
              {STATUS_LABEL[billing.status]}
              {billing.current_period_end
                ? ` · Renews ${new Date(billing.current_period_end).toLocaleDateString()}`
                : ""}
              {billing.cancel_at_period_end ? " · Cancels at period end" : ""}
            </p>
          </div>
          {isPaid ? (
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
            title="Pro"
            price={PRO_PRICE}
            features={PRO_FEATURES}
            action={
              <Button size="sm" disabled={isPending} onClick={upgrade} className="w-full">
                {isPending ? "Opening…" : "Upgrade to Pro"}
              </Button>
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
  features,
  current = false,
  action,
}: {
  title: string;
  price: string;
  features: string[];
  current?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {current ? (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{price}</p>
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
