import { assert, assertEquals } from "jsr:@std/assert@1";
import { signScreenshotToken, verifyScreenshotToken } from "./screenshotToken.ts";

Deno.test("signScreenshotToken generates deterministic 32-character hex token", async () => {
  const secret = "test-secret-key-12345";
  const id = "981d57dd-ef62-4ace-96f9-7ba84a4d2a16";
  const token1 = await signScreenshotToken(id, secret);
  const token2 = await signScreenshotToken(id, secret);

  assertEquals(token1.length, 32);
  assertEquals(token1, token2);
});

Deno.test("verifyScreenshotToken validates valid token and rejects invalid token or secret", async () => {
  const secret = "super-secret-service-role-key";
  const id = "981d57dd-ef62-4ace-96f9-7ba84a4d2a16";
  const token = await signScreenshotToken(id, secret);

  assert(await verifyScreenshotToken(id, token, secret));

  // Wrong ID
  assert(!await verifyScreenshotToken("other-id", token, secret));

  // Wrong secret
  assert(!await verifyScreenshotToken(id, token, "wrong-secret"));

  // Tampered token
  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  assert(!await verifyScreenshotToken(id, tampered, secret));

  // Empty / bad input
  assert(!await verifyScreenshotToken("", token, secret));
  assert(!await verifyScreenshotToken(id, "", secret));
  assert(!await verifyScreenshotToken(id, token, ""));
});
