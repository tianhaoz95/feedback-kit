import { Link, useNavigate } from "react-router-dom";
import { useNotifications } from "@/lib/notifications";
import { useOrganization } from "@/lib/organization";
import { notificationHref, timeAgo } from "@/lib/notificationFormat";
import type { AppNotification } from "@/lib/types";
import { Dropdown } from "@/components/Dropdown";
import { BellIcon } from "@/components/icons";

const KIND_DOT: Record<AppNotification["kind"], string> = {
  new_feedback: "bg-blue-500",
  reporter_reply: "bg-violet-500",
  reopened: "bg-red-500",
  verified: "bg-emerald-500",
  fix_merged: "bg-indigo-500",
  member_joined: "bg-amber-500",
};

/** Opens a notification: switches to its organization first so list pages match, then navigates. */
// eslint-disable-next-line react-refresh/only-export-components -- shared with NotificationsPage
export function useOpenNotification() {
  const navigate = useNavigate();
  const { markRead } = useNotifications();
  const { current, switchOrganization } = useOrganization();
  return (n: AppNotification) => {
    void markRead(n.id);
    if (current && n.organization_id !== current.id) switchOrganization(n.organization_id);
    navigate(notificationHref(n));
  };
}

export function NotificationRow({ n, onOpen, compact = false }: { n: AppNotification; onOpen: (n: AppNotification) => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={`flex w-full gap-3 text-left transition-colors hover:bg-neutral-50 ${compact ? "px-3 py-2.5" : "px-4 py-3"} ${
        n.read_at ? "" : "bg-blue-50/40"
      }`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read_at ? "bg-neutral-200" : KIND_DOT[n.kind]}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${n.read_at ? "text-neutral-600" : "font-medium text-neutral-900"}`}>{n.title}</span>
        {n.body ? <span className="mt-0.5 block truncate text-xs text-neutral-500">{n.body}</span> : null}
      </span>
      <span className="shrink-0 text-[11px] text-neutral-400">{timeAgo(n.created_at)}</span>
    </button>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const open = useOpenNotification();
  const recent = (notifications ?? []).slice(0, 8);

  return (
    <Dropdown
      label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      align="right"
      panelClassName="w-[min(22rem,calc(100vw-1.5rem))]"
      trigger={() => (
        <span className="relative flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900">
          <BellIcon className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            {unreadCount > 0 ? (
              <button type="button" onClick={() => void markAllRead()} className="text-xs text-neutral-500 hover:text-neutral-900">
                Mark all read
              </button>
            ) : null}
          </div>
          {notifications === null ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-400">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-neutral-400">
              Nothing yet. New reports and replies from reporters will show up here.
            </p>
          ) : (
            <div className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
              {recent.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  compact
                  onOpen={(item) => {
                    close();
                    open(item);
                  }}
                />
              ))}
            </div>
          )}
          <Link
            to="/notifications"
            onClick={close}
            className="block border-t border-neutral-100 px-3 py-2 text-center text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            All notifications &amp; settings
          </Link>
        </div>
      )}
    </Dropdown>
  );
}
