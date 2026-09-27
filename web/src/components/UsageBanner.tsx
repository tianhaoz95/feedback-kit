import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { reportUsageShare, type OrganizationUsage } from "@/lib/pricing";
import { AlertIcon } from "@/components/icons";

/**
 * Warns before the Free plan's monthly report limit (0019_plan_limits.sql)
 * starts refusing reports — at 80%, and once it's reached.
 */
export function UsageBanner({ organizationId }: { organizationId: string }) {
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

  const share = reportUsageShare(usage);
  if (!usage || share < 0.8) return null;
  const full = share >= 1;
  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs ${
        full ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
    >
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {usage.reports_this_month} of {usage.limits.reports_per_month} reports this month on the Free plan.{" "}
        {full ? "New reports are being refused until next month." : "At the limit, new reports are refused until next month."}{" "}
        <Link to="/billing" className="font-medium underline">
          See Billing
        </Link>
      </span>
    </div>
  );
}
