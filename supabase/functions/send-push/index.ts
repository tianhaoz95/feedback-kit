// Delivers one notification row (0017_notifications.sql) to the recipient's
// iOS Developer Portal devices over APNs.
//
// Called only by the database: the `on_notification_created_push` trigger
// POSTs `{ notification_id }` through pg_net with an `x-push-secret` header.
// There's no user session on that request, so `verify_jwt = false` (see
// supabase/config.toml) and the shared secret is the trust boundary, the same
// way Stripe's signature is for stripe-webhook.
//
// Dormant until switched on. To turn push on for the hosted project:
//   1. Apple Developer → Keys → create a key with Apple Push Notifications
//      service (APNs); download the .p8.
//   2. supabase secrets set APNS_KEY_ID=… APNS_TEAM_ID=… APNS_PRIVATE_KEY="$(cat AuthKey_XXXX.p8)" \
//        PUSH_WEBHOOK_SECRET=<random string>
//   3. In the SQL editor (see 0017_notifications.sql):
//        select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'feedbackkit_functions_url');
//        select vault.create_secret('<the same random string>', 'feedbackkit_push_secret');
// Until then the trigger never calls this function, and if it's called
// anyway it answers 200 `{ skipped: "push_not_configured" }`.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { json } from "../_shared/http.ts";
import { getApnsConfig, sendApns } from "../_shared/apns.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (!secret) return json({ skipped: "push_not_configured" }, 200);
  if (!timingSafeEqual(req.headers.get("x-push-secret") ?? "", secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  const config = getApnsConfig();
  if (!config) return json({ skipped: "push_not_configured" }, 200);

  let notificationId: string | undefined;
  try {
    notificationId = (await req.json()).notification_id;
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }
  if (!notificationId) return json({ error: "missing notification_id" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: notification, error } = await admin
    .from("notifications")
    .select("id, user_id, project_id, feedback_id, kind, title, body, read_at")
    .eq("id", notificationId)
    .maybeSingle();
  if (error) return json({ error: "failed to load notification", detail: error.message }, 500);
  if (!notification || notification.read_at) return json({ skipped: "not_found_or_read" }, 200);

  const [{ data: devices }, { count: unread }] = await Promise.all([
    admin.from("push_devices").select("id, token, environment, bundle_id").eq("user_id", notification.user_id),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", notification.user_id)
      .is("read_at", null),
  ]);
  if (!devices || devices.length === 0) return json({ sent: 0 }, 200);

  const payload = {
    aps: {
      alert: { title: notification.title, body: notification.body ?? "" },
      sound: "default",
      badge: unread ?? 1,
      "thread-id": notification.project_id ?? "feedbackkit",
    },
    // Read by the Portal's notification-tap handler to open the report.
    notification_id: notification.id,
    kind: notification.kind,
    project_id: notification.project_id,
    feedback_id: notification.feedback_id,
  };

  let sent = 0;
  const stale: string[] = [];
  for (const device of devices) {
    const result = await sendApns(
      { ...config, bundleId: device.bundle_id || config.bundleId },
      device.token,
      device.environment === "sandbox" ? "sandbox" : "production",
      payload,
      { collapseId: notification.id },
    );
    if (result.ok) sent++;
    else if (result.unregistered) stale.push(device.id);
    else console.warn(`APNs rejected a push: ${result.status} ${result.reason ?? ""}`);
  }
  if (stale.length > 0) await admin.from("push_devices").delete().in("id", stale);

  return json({ sent, removed: stale.length }, 200);
});
