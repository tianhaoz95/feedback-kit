import { describe, expect, it } from "vitest";
import { blobToBase64, encodePayload } from "../src/submit";
import type { FeedbackReport } from "../src/types";

function report(overrides: Partial<FeedbackReport> = {}): FeedbackReport {
  return {
    id: "3F2504E0-4F89-41D3-9A0C-0305E82C3301",
    createdAt: new Date("2026-09-25T12:00:00.000Z"),
    text: "The save button does nothing",
    screenshotRaw: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    screenshotAnnotated: new Blob([new Uint8Array([4, 5, 6])], { type: "image/png" }),
    annotations: [{ kind: "arrow", points: [[0.1, 0.2], [0.3, 0.4]], colorHex: "#FF3B30", scale: 1, rotation: 0 }],
    environment: {
      osName: "macOS",
      osVersion: "15.2",
      deviceModel: "Chrome 141",
      appVersion: "1.2.0",
      appBuild: "",
      bundleIdentifier: "app.example.com",
      screenName: "/settings",
      locale: "en-US",
      screenWidthPoints: 1440,
      screenHeightPoints: 900,
      screenScale: 2,
      platform: "web",
      pageUrl: "https://app.example.com/settings",
    },
    attachment: null,
    products: [],
    logs: [],
    ...overrides,
  };
}

describe("encodePayload — the ingest-feedback wire contract", () => {
  it("produces the same snake_case shape as the Swift SDK's IngestPayload", async () => {
    const payload = await encodePayload(report(), "pk_test");
    expect(payload).toEqual({
      project_key: "pk_test",
      id: "3F2504E0-4F89-41D3-9A0C-0305E82C3301",
      created_at: "2026-09-25T12:00:00.000Z",
      text: "The save button does nothing",
      screenshot_raw_png_base64: "AQID",
      screenshot_annotated_png_base64: "BAUG",
      annotations: [{ kind: "arrow", points: [[0.1, 0.2], [0.3, 0.4]], colorHex: "#FF3B30", scale: 1, rotation: 0 }],
      environment: report().environment,
    });
  });

  it("omits optional fields entirely rather than sending nulls (like encodeIfPresent)", async () => {
    const payload = await encodePayload(report({ screenshotRaw: null, screenshotAnnotated: null, annotations: [] }), "pk");
    expect(Object.keys(payload)).not.toContain("screenshot_raw_png_base64");
    expect(Object.keys(payload)).not.toContain("attachment_filename");
    expect(Object.keys(payload)).not.toContain("products");
    expect(Object.keys(payload)).not.toContain("logs");
  });

  it("encodes attachments, products and logs", async () => {
    const payload = await encodePayload(
      report({
        attachment: { filename: "trace.txt", mimeType: "text/plain", data: new Blob(["hi"]) },
        products: [{ key: "web", name: "Web app", isDefault: true }],
        logs: [{ level: "error", message: "TypeError: x is undefined", timestamp: "2026-09-25T11:59:59.000Z" }],
      }),
      "pk",
    );
    expect(payload.attachment_filename).toBe("trace.txt");
    expect(payload.attachment_mime_type).toBe("text/plain");
    expect(payload.attachment_data_base64).toBe("aGk=");
    expect(payload.product_keys).toEqual(["web"]);
    expect(payload.products).toEqual([{ key: "web", name: "Web app", description: "", is_default: true }]);
    expect(payload.logs).toHaveLength(1);
  });

  it("base64-encodes large blobs without blowing the call stack", async () => {
    const bytes = new Uint8Array(300_000).map((_, i) => i % 256);
    const b64 = await blobToBase64(new Blob([bytes]));
    expect(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))).toEqual(bytes);
  });
});
