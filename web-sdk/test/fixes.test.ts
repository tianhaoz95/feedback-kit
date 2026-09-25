import { afterEach, describe, expect, it, vi } from "vitest";
import { compareBuilds, decodeUpdate, encodeFixAction, reporterId, reporterUpdatesEndpoint, setUser } from "../src/fixes";
import { encodePayload } from "../src/submit";
import type { FeedbackReport } from "../src/types";

const config = { projectKey: "pk_test", endpoint: "https://abc.supabase.co/functions/v1/ingest-feedback", appBuild: "101" };

function report(): FeedbackReport {
  return {
    id: "3F2504E0-4F89-41D3-9A0C-0305E82C3301",
    createdAt: new Date("2026-09-25T12:00:00.000Z"),
    text: "Still clipped",
    screenshotRaw: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    screenshotAnnotated: new Blob([new Uint8Array([4, 5, 6])], { type: "image/png" }),
    annotations: [{ kind: "rectangle", points: [[0.1, 0.1], [0.2, 0.2]], colorHex: "#FF3B30", scale: 1, rotation: 0 }],
    environment: {
      osName: "macOS", osVersion: "15", deviceModel: "Chrome 141", appVersion: "", appBuild: "", bundleIdentifier: "x",
      screenName: "/", locale: "en", screenWidthPoints: 1, screenHeightPoints: 1, screenScale: 1,
    },
    attachment: null,
    products: [],
    logs: [],
  };
}

describe("compareBuilds — mirrors compare_builds in 0014_closed_loop.sql", () => {
  it("orders dotted numeric builds and refuses to guess otherwise", () => {
    expect(compareBuilds("42", "42")).toBe(0);
    expect(compareBuilds("41", "42")).toBe(-1);
    expect(compareBuilds("1.2.10", "1.2.9")).toBe(1);
    expect(compareBuilds("1.2", "1.2.0")).toBe(0);
    expect(compareBuilds("20260925101010", "20260925101011")).toBe(-1);
    expect(compareBuilds("a1b2c3", "a1b2c4")).toBeNull();
    expect(compareBuilds(undefined, "1")).toBeNull();
  });
});

describe("reporter-updates wire format", () => {
  it("derives the endpoint from the ingest endpoint unless overridden", () => {
    expect(reporterUpdatesEndpoint(config)).toBe("https://abc.supabase.co/functions/v1/reporter-updates");
    expect(reporterUpdatesEndpoint({ ...config, reporterUpdatesEndpoint: "https://x.test/u" })).toBe("https://x.test/u");
  });

  it("decodes the snake_case response into the camelCase public shape", () => {
    const u = decodeUpdate({
      feedback_id: "f1",
      text: "Button cut off",
      fixed_in_build: "101",
      fix_summary: "Added the inset",
      needs_verification: true,
      open_question: { id: "q", body: "Landscape too?", created_at: "t" },
      screenshot_url: "https://signed",
      messages: [{ id: "m", kind: "comment", body: "Found it", author: "claude-code", created_at: "t" }],
    });
    expect(u).toMatchObject({
      feedbackId: "f1",
      fixedInBuild: "101",
      fixSummary: "Added the inset",
      needsVerification: true,
      openQuestion: { body: "Landscape too?" },
      screenshotUrl: "https://signed",
    });
    expect(u.messages[0].author).toBe("claude-code");
    expect(decodeUpdate({ feedback_id: "f2" })).toMatchObject({ needsVerification: false, openQuestion: null, messages: [] });
  });

  it("encodes verify / reply / reopen like the Swift SDK", async () => {
    const verify = await encodeFixAction(config, "f1", { type: "verify" });
    expect(verify).toEqual({ project_key: "pk_test", reporter_id: reporterId(), feedback_id: "f1", action: "verify", build: "101" });

    expect(await encodeFixAction(config, "f1", { type: "reply", text: "iPhone SE" })).toMatchObject({ action: "reply", text: "iPhone SE" });

    const reopen = await encodeFixAction(config, "f1", { type: "reopen", report: report() });
    expect(reopen).toMatchObject({
      action: "reopen",
      text: "Still clipped",
      screenshot_annotated_png_base64: btoa(String.fromCharCode(4, 5, 6)),
      screenshot_raw_png_base64: btoa(String.fromCharCode(1, 2, 3)),
    });
    expect(reopen.annotations).toHaveLength(1);

    const bare = await encodeFixAction({ projectKey: "pk" }, "f1", { type: "reopen" });
    expect(bare).toEqual({ project_key: "pk", reporter_id: reporterId(), feedback_id: "f1", action: "reopen" });
  });
});

describe("reporter identity", () => {
  afterEach(() => {
    setUser(null);
    vi.restoreAllMocks();
  });

  it("is a stable, server-valid id", () => {
    const id = reporterId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(reporterId()).toBe(id);
  });

  it("rides along on the ingest payload only when passed", async () => {
    const withIdentity = await encodePayload(report(), "pk", { reporterId: "abcdefabcdefabcdef", user: { email: "a@b.c" } });
    expect(withIdentity.reporter_id).toBe("abcdefabcdefabcdef");
    expect(withIdentity.reporter).toEqual({ email: "a@b.c" });
    const without = await encodePayload(report(), "pk");
    expect(without).not.toHaveProperty("reporter_id");
    expect(without).not.toHaveProperty("reporter");
  });
});
