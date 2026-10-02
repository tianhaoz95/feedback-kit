import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { reportUsageShare, type OrganizationUsage } from "@/lib/pricing";
import { AlertIcon } from "@/components/icons";

/**
 * Warns before the Free plan's monthly report limit (0028_indie_pricing.sql)
 * starts locking reports — at 80%, and once reports are waiting locked —
 * and says when this project is paused or the viewer is read-only after a
 * downgrade (0029_downgrade_pause.sql).
 */
export function UsageBanner({ organizationId, projectId }: { organizationId: string; projectId?: string }) {
  const [usage, setUsage] = useState<OrganizationUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc("organization_usage", { p_org_id: organizationId }).then(({ data }) => {
      if (!cancelled) setUsage((data as OrganizationUsage | null) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (usage && projectId && usage.paused_project_ids?.includes(projectId)) {
    return (
      <Notice tone="red">
        This project is paused on the Free plan: its history stays here, but new reports arrive locked. Upgrade to Indie,
        or make it your active project.{" "}
        <Link to="/billing" className="font-medium underline">
          See Billing
        </Link>
      </Notice>
    );
  }
  if (usage?.can_write === false) {
    return (
      <Notice tone="amber">
        You&apos;re read-only here: the Free plan is for one person, so only the owner can make changes until the
        organization upgrades.{" "}
        <Link to="/billing" className="font-medium underline">
          See Billing
        </Link>
      </Notice>
    );
  }

  const share = reportUsageShare(usage);
  const locked = usage?.limited ? (usage.locked_reports ?? 0) : 0;
  if (!usage || (share < 0.8 && locked === 0)) return null;
  const full = share >= 1 || locked > 0;
  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs ${
        full ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {locked > 0
          ? `${locked} new ${locked === 1 ? "report is" : "reports are"} waiting, locked: this month's ${usage.limits.reports_per_month} Free reports are used. Upgrade to Indie to read ${locked === 1 ? "it" : "them"}.`
          : `${usage.reports_this_month} of ${usage.limits.reports_per_month} reports this month on the Free plan. ${
              full ? "New reports are kept but locked until you upgrade or the month ends." : "Past the limit, new reports are kept but locked until you upgrade."
            }`}{" "}
        <Link to="/billing" className="font-medium underline">
          See Billing
        </Link>
      </span>
    </div>
  );
}

function Notice({ tone, children }: { tone: "red" | "amber"; children: ReactNode }) {
  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs ${
        tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
