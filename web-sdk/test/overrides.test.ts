import { afterEach, describe, expect, it, vi } from "vitest";
import { collectEnvironment } from "../src/environment";

function stubBrowser() {
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
    language: "en-US",
  });
  vi.stubGlobal("location", { host: "tauri.localhost", pathname: "/", href: "http://tauri.localhost/" });
  vi.stubGlobal("window", { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1.5 });
}

describe("environment overrides (desktop shells)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("detects the browser view by default", async () => {
    stubBrowser();
    const env = await collectEnvironment({});
    expect(env.osName).toBe("Windows");
    expect(env.bundleIdentifier).toBe("tauri.localhost");
    expect(env.platform).toBe("web");
    expect(env.runtime).toBeUndefined();
  });

  it("merges host-supplied fields over detected ones", async () => {
    stubBrowser();
    const env = await collectEnvironment({
      overrides: {
        osName: "Windows",
        osVersion: "11 (26100)",
        deviceModel: "Surface Laptop 7",
        bundleIdentifier: "com.example.notes",
        appVersion: "2.1.0",
        appBuild: "421",
        runtime: "tauri",
        runtimeVersion: "2.8.5",
      },
    });
    expect(env).toMatchObject({
      osVersion: "11 (26100)",
      deviceModel: "Surface Laptop 7",
      bundleIdentifier: "com.example.notes",
      appVersion: "2.1.0",
      appBuild: "421",
      runtime: "tauri",
      runtimeVersion: "2.8.5",
      // Still a web-content report: logs, page URL and browser stay.
      platform: "web",
      browserName: "Edge",
      screenWidthPoints: 1200,
    });
  });

  it("lets an explicit appVersion/appBuild win and ignores empty overrides", async () => {
    stubBrowser();
    const env = await collectEnvironment({
      appVersion: "9.9.9",
      overrides: { appVersion: "2.1.0", appBuild: "421", deviceModel: "" },
    });
    expect(env.appVersion).toBe("9.9.9");
    expect(env.appBuild).toBe("421");
    expect(env.deviceModel).toBe("Edge 141");
  });
});
