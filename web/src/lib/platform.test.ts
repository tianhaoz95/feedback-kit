import test from "node:test";
import assert from "node:assert/strict";
import { platformOf } from "./platform.ts";
import { generateAgentSetupPrompt } from "./agent-setup-prompt.ts";

test("platformOf recognizes every SDK", () => {
  assert.equal(platformOf({ platform: "web", osName: "macOS" }).id, "web");
  assert.equal(platformOf({ osName: "iOS" }).id, "ios");
  assert.equal(platformOf({ osName: "iPadOS" }).label, "iPadOS");
  assert.equal(platformOf({ osName: "macOS" }).id, "macos");
  assert.equal(platformOf({ osName: "watchOS" }).id, "watchos");
  // The Android SDK, and Flutter/React Native apps running on Android.
  assert.deepEqual(platformOf({ osName: "Android" }), { id: "android", label: "Android" });
  assert.equal(platformOf({ osName: "Tizen" }).id, "unknown");
  // The web SDK inside desktop shells.
  assert.deepEqual(platformOf({ platform: "web", runtime: "tauri", osName: "Windows" }), { id: "tauri", label: "Tauri · Windows" });
  assert.deepEqual(platformOf({ platform: "web", runtime: "electron", osName: "Linux" }), { id: "electron", label: "Electron · Linux" });
  assert.equal(platformOf(null).id, "unknown");
});

test("agent setup prompts carry the project's key and endpoint on the new platforms", () => {
  for (const platform of ["android", "flutter", "react-native", "tauri", "electron"] as const) {
    const prompt = generateAgentSetupPrompt({
      platform,
      projectKey: "pk_test_123",
      endpointUrl: "https://x.supabase.co/functions/v1/ingest-feedback",
    });
    assert.ok(prompt.includes("pk_test_123"), platform);
    assert.ok(prompt.includes("https://x.supabase.co/functions/v1/ingest-feedback"), platform);
  }
  assert.ok(
    generateAgentSetupPrompt({ platform: "android", projectKey: "k", endpointUrl: "e" }).includes("jitpack.io"),
  );
  assert.ok(
    generateAgentSetupPrompt({ platform: "flutter", projectKey: "k", endpointUrl: "e" }).includes("path: flutter/feedbackkit_flutter"),
  );
  assert.ok(generateAgentSetupPrompt({ platform: "tauri", projectKey: "k", endpointUrl: "e" }).includes('"feedbackkit:default"'));
  const electron = generateAgentSetupPrompt({
    platform: "electron",
    projectKey: "k",
    endpointUrl: "https://x.supabase.co/functions/v1/ingest-feedback",
  });
  assert.ok(electron.includes("connect-src` to https://x.supabase.co."));
});
