/**
 * Signs and verifies HMAC-SHA256 tokens for public feedback screenshot URLs.
 * This allows GitHub issues, PRs, and coding agents to display and inspect
 * screenshots directly without committing binary images into git or exposing
 * other reports' storage paths.
 */

export async function signScreenshotToken(feedbackId: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`screenshot:${feedbackId}`));
  const hashArray = Array.from(new Uint8Array(signature));
  // Use first 32 hex characters (128 bits of entropy)
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function verifyScreenshotToken(feedbackId: string, token: string, secret: string): Promise<boolean> {
  if (!feedbackId || !token || !secret) return false;
  const expected = await signScreenshotToken(feedbackId, secret);
  if (token.length !== expected.length) return false;
  let match = 0;
  for (let i = 0; i < token.length; i++) {
    match |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return match === 0;
}
