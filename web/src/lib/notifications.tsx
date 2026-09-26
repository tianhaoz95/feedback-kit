import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { AppNotification } from "@/lib/types";
import { notificationHref } from "@/lib/notificationFormat";

/**
 * The signed-in user's notifications (supabase/migrations/0017_notifications.sql).
 * Database triggers write them; this loads the latest page, then listens for
 * new rows over Realtime, so the bell updates without a refresh. Optionally
 * mirrors new ones as desktop notifications while the tab is in the
 * background (the browser Notification API — no service worker or push
 * server, so nothing arrives while every dashboard tab is closed).
 */

const PAGE_SIZE = 50;
const DESKTOP_KEY = "feedbackkit.desktopNotifications";

interface NotificationsContextValue {
  notifications: AppNotification[] | null;
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  desktopEnabled: boolean;
  /** Asks the browser for permission when turning on; resolves to the resulting state. */
  setDesktopEnabled: (enabled: boolean) => Promise<boolean>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

function readDesktopPref(): boolean {
  try {
    return (
      localStorage.getItem(DESKTOP_KEY) === "1" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    );
  } catch {
    return false;
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [desktopEnabled, setDesktopEnabledState] = useState(readDesktopPref);
  const desktopRef = useRef(desktopEnabled);
  useEffect(() => {
    desktopRef.current = desktopEnabled;
  }, [desktopEnabled]);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    setUnreadCount(count ?? 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE)
        .returns<AppNotification[]>();
      if (cancelled) return;
      setNotifications(data ?? []);
      await loadUnreadCount();
    })();

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => (prev ? [row, ...prev.filter((n) => n.id !== row.id)].slice(0, PAGE_SIZE) : [row]));
          setUnreadCount((c) => c + 1);
          if (desktopRef.current && document.hidden && typeof Notification !== "undefined") {
            try {
              const note = new Notification(row.title, { body: row.body ?? undefined, tag: row.id });
              note.onclick = () => {
                window.focus();
                window.location.assign(`${import.meta.env.BASE_URL.replace(/\/$/, "")}${notificationHref(row)}`);
              };
            } catch {
              // Some browsers only allow notifications from a service worker.
            }
          }
        },
      )
      .subscribe();

    // Realtime can miss rows while a laptop sleeps; catch up when the tab returns.
    const onVisible = () => {
      if (!document.hidden) void loadUnreadCount();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [user, loadUnreadCount]);

  const markRead = useCallback(
    async (id: string) => {
      const target = notifications?.find((n) => n.id === id);
      if (target && target.read_at) return;
      const now = new Date().toISOString();
      setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, read_at: now } : n)) ?? prev);
      setUnreadCount((c) => Math.max(0, c - 1));
      await supabase.from("notifications").update({ read_at: now }).eq("id", id);
    },
    [notifications],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? prev);
    setUnreadCount(0);
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
  }, [user]);

  const setDesktopEnabled = useCallback(async (enabled: boolean) => {
    let granted = false;
    if (enabled && typeof Notification !== "undefined") {
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      granted = permission === "granted";
    }
    try {
      localStorage.setItem(DESKTOP_KEY, granted ? "1" : "0");
    } catch {
      // Not persisted; still applies to this tab.
    }
    setDesktopEnabledState(granted);
    return granted;
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead, desktopEnabled, setDesktopEnabled }),
    [notifications, unreadCount, markRead, markAllRead, desktopEnabled, setDesktopEnabled],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hook are one unit
export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within a NotificationsProvider");
  return ctx;
}
