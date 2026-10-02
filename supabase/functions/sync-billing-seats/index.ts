// Retired: plans are flat now (Indie, see 0028_indie_pricing.sql), so there's
// no per-seat quantity to keep in step. Kept as a no-op because Portal builds
// already in people's hands still call it after membership changes, and the
// hosted function must not keep changing subscription quantities.
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  return json({ synced: false }, 200);
});
