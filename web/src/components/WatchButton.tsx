import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { Button } from "@/components/Button";
import { EyeIcon } from "@/components/icons";

/**
 * Adds a report to your watchlist (0023_notify_and_watchlist.sql): you're
 * notified of every step of its fix, not just the organization-wide
 * highlights. Rows are yours only; RLS scopes them.
 */
export function WatchButton({ feedbackId, organizationId }: { feedbackId: string; organizationId?: string }) {
  const { user } = useAuth();
  const [watching, setWatching] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setWatching(null);
    supabase
      .from("feedback_watchers")
      .select("feedback_id", { count: "exact", head: true })
      .eq("feedback_id", feedbackId)
      .eq("user_id", user.id)
      .then(({ count }) => {
        if (!cancelled) setWatching((count ?? 0) > 0);
      });
    return () => {
      cancelled = true;
    };
  }, [feedbackId, user]);

  async function toggle() {
    if (!user || watching === null) return;
    setBusy(true);
    const { error } = watching
      ? await supabase.from("feedback_watchers").delete().eq("feedback_id", feedbackId).eq("user_id", user.id)
      : await supabase.from("feedback_watchers").insert({ feedback_id: feedbackId, user_id: user.id });
    setBusy(false);
    if (!error) {
      track(watching ? "report_unwatched" : "report_watched", {}, organizationId);
      setWatching(!watching);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={busy || watching === null}
      onClick={() => void toggle()}
      className="inline-flex items-center gap-1.5"
      title={watching ? "Stop getting notified about this report" : "Get notified about every step of this report's fix"}
      aria-pressed={watching ?? false}
    >
      <EyeIcon className={`h-3.5 w-3.5 ${watching ? "text-sky-600" : ""}`} />
      <span>{watching ? "Watching" : "Watch"}</span>
    </Button>
  );
}
