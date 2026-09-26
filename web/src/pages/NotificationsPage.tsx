import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { NOTIFICATION_KIND_LABEL } from "@/lib/notificationFormat";
import { getErrorMessage } from "@/lib/errors";
import type { NotificationKind, NotificationPreferences } from "@/lib/types";
import { Button } from "@/components/Button";
import { NotificationRow, useOpenNotification } from "@/components/NotificationBell";
import { BellIcon, SettingsIcon } from "@/components/icons";

const KIND_HINT: Record<NotificationKind, string> = {
  new_feedback: "A report arrives in one of your organizations' projects.",
  reporter_reply: "A reporter answers a question or adds detail from their device.",
  reopened: "A reporter says a shipped fix is still broken.",
  verified: "A reporter confirms a fix on their device.",
  fix_merged: "A fix for a report is merged or committed.",
  member_joined: "Someone joins an organization you own.",
};

const KINDS = Object.keys(NOTIFICATION_KIND_LABEL) as NotificationKind[];

export function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, desktopEnabled, setDesktopEnabled } = useNotifications();
  const open = useOpenNotification();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [prefs, setPrefs] = useState<Pick<NotificationPreferences, "muted_kinds" | "push_enabled"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desktopBlocked, setDesktopBlocked] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("muted_kinds, push_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) setError(error.message);
      setPrefs(data ?? { muted_kinds: [], push_enabled: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function savePrefs(next: Pick<NotificationPreferences, "muted_kinds" | "push_enabled">) {
    if (!user) return;
    const previous = prefs;
    setPrefs(next);
    setError(null);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
    if (error) {
      setPrefs(previous);
      setError(getErrorMessage(error, "Couldn't save your notification settings."));
    }
  }

  const shown = (notifications ?? []).filter((n) => filter === "all" || !n.read_at);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Notifications</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Across every organization you're in. The Developer Portal app shows the same list.
          </p>
        </div>
        {unreadCount > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => void markAllRead()}>
            Mark all read
          </Button>
        ) : null}
      </div>

      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-1 border-b border-neutral-100 px-3 py-2">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                filter === f ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {f === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
            </button>
          ))}
        </div>
        {notifications === null ? (
          <div className="space-y-2 p-4">
            <div className="h-10 animate-pulse rounded bg-neutral-100" />
            <div className="h-10 animate-pulse rounded bg-neutral-100" />
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellIcon className="h-6 w-6 text-neutral-300" />
            <p className="text-sm text-neutral-500">
              {filter === "unread" ? "You're all caught up." : "No notifications yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {shown.map((n) => (
              <NotificationRow key={n.id} n={n} onOpen={open} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <SettingsIcon className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-900">What to notify me about</h2>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Applies everywhere: this dashboard, desktop notifications and the Portal app. You're never notified about
          something you did yourself.
        </p>
        <ul className="mt-4 divide-y divide-neutral-100">
          {KINDS.map((kind) => {
            const on = prefs ? !prefs.muted_kinds.includes(kind) : true;
            return (
              <li key={kind} className="flex items-center justify-between gap-4 py-2.5">
                <div>
                  <p className="text-sm text-neutral-800">{NOTIFICATION_KIND_LABEL[kind]}</p>
                  <p className="text-xs text-neutral-500">{KIND_HINT[kind]}</p>
                </div>
                <Toggle
                  label={NOTIFICATION_KIND_LABEL[kind]}
                  checked={on}
                  disabled={!prefs}
                  onChange={(checked) => {
                    if (!prefs) return;
                    const muted = checked ? prefs.muted_kinds.filter((k) => k !== kind) : [...prefs.muted_kinds, kind];
                    void savePrefs({ ...prefs, muted_kinds: muted });
                  }}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-neutral-900">Where to notify me</h2>
        <ul className="mt-3 divide-y divide-neutral-100">
          <li className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p className="text-sm text-neutral-800">Desktop notifications from this browser</p>
              <p className="text-xs text-neutral-500">
                {desktopBlocked
                  ? "Your browser is blocking notifications for this site. Allow them in the site settings, then try again."
                  : "Shown while a dashboard tab is open in the background."}
              </p>
            </div>
            <Toggle
              label="Desktop notifications"
              checked={desktopEnabled}
              disabled={typeof Notification === "undefined"}
              onChange={(checked) => {
                void setDesktopEnabled(checked).then((granted) => setDesktopBlocked(checked && !granted));
              }}
            />
          </li>
          <li className="flex items-center justify-between gap-4 py-2.5">
            <div>
              <p className="text-sm text-neutral-800">Push to the Developer Portal on iPhone and iPad</p>
              <p className="text-xs text-neutral-500">Sign in to the Portal app and allow notifications when it asks.</p>
            </div>
            <Toggle
              label="Portal push notifications"
              checked={prefs?.push_enabled ?? true}
              disabled={!prefs}
              onChange={(checked) => prefs && void savePrefs({ ...prefs, push_enabled: checked })}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-neutral-900" : "bg-neutral-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
