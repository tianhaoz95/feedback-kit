import { describe, expect, it } from "vitest";
import { parseUserAgent, redactUrl } from "../src/environment";
import { LogBuffer, redactMessage, stringifyArg } from "../src/logs";

describe("parseUserAgent", () => {
  it("parses Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      osName: "macOS",
      osVersion: "10.15.7",
      browserName: "Chrome",
      browserVersion: "141.0.0.0",
    });
  });

  it("parses Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toMatchObject({ osName: "iOS", osVersion: "18.1", browserName: "Safari", browserVersion: "18.1" });
  });

  it("parses Edge on Windows before Chrome", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.3537.57";
    expect(parseUserAgent(ua)).toMatchObject({ osName: "Windows", osVersion: "10", browserName: "Edge" });
  });

  it("parses Firefox on Android", () => {
    const ua = "Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0";
    expect(parseUserAgent(ua)).toMatchObject({ osName: "Android", osVersion: "15", browserName: "Firefox", browserVersion: "143.0" });
  });

  it("never throws on junk", () => {
    expect(parseUserAgent("")).toEqual({ osName: "Unknown", osVersion: "", browserName: "Unknown", browserVersion: "" });
  });
});

describe("redaction", () => {
  it("redacts sensitive query params and token fragments", () => {
    const url = redactUrl("https://app.example.com/reset?token=abc123&page=2#access_token=xyz");
    expect(url).toContain("token=%5Bredacted%5D");
    expect(url).toContain("page=2");
    expect(url).not.toContain("abc123");
    expect(url).not.toContain("xyz");
  });

  it("leaves ordinary URLs alone", () => {
    expect(redactUrl("https://example.com/projects/42?tab=settings")).toBe("https://example.com/projects/42?tab=settings");
  });

  it("scrubs bearer tokens, JWTs and key=value secrets from log text", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const msg = redactMessage(`Authorization: Bearer abc.def ${jwt} password=hunter2 {"api_key":"sk-123"}`);
    expect(msg).not.toContain("abc.def");
    expect(msg).not.toContain(jwt);
    expect(msg).not.toContain("hunter2");
    expect(msg).not.toContain("sk-123");
  });
});

describe("LogBuffer", () => {
  it("keeps only the newest entries and truncates long messages", () => {
    const buffer = new LogBuffer(3);
    for (let i = 0; i < 5; i++) buffer.push("error", `e${i}`);
    buffer.push("warn", "x".repeat(5000));
    const entries = buffer.snapshot();
    expect(entries.map((e) => e.message.slice(0, 2))).toEqual(["e3", "e4", "xx"]);
    expect(entries[2].message.length).toBeLessThan(1100);
  });

  it("stringifies errors, objects and circular structures", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(stringifyArg(circular)).toBe('{"a":1,"self":"[circular]"}');
    expect(stringifyArg(new TypeError("boom"))).toContain("boom");
    expect(stringifyArg(undefined)).toBe("undefined");
  });
});
