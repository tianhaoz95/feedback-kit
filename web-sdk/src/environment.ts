import type { FeedbackEnvironment } from "./types";

export interface ParsedUserAgent {
  osName: string;
  osVersion: string;
  browserName: string;
  browserVersion: string;
}

/**
 * Best-effort user-agent parsing. Deliberately small (a handful of ordered
 * regexes) rather than a UA-parsing dependency — the goal is a readable
 * "macOS 15.2 / Chrome 141" for a human or coding agent, not device
 * fingerprinting. `collectEnvironment` upgrades these with User-Agent Client
 * Hints where the browser offers them (Chromium), since UA strings freeze
 * or lie about OS versions there.
 */
export function parseUserAgent(ua: string): ParsedUserAgent {
  let osName = "Unknown";
  let osVersion = "";
  let m: RegExpMatchArray | null;

  if ((m = ua.match(/(?:iPhone|iPad|iPod).*?OS (\d+[_.\d]*)/))) {
    osName = /iPad/.test(ua) ? "iPadOS" : "iOS";
    osVersion = m[1].replace(/_/g, ".");
  } else if ((m = ua.match(/Android (\d+(?:\.\d+)*)/))) {
    osName = "Android";
    osVersion = m[1];
  } else if ((m = ua.match(/Windows NT (\d+\.\d+)/))) {
    osName = "Windows";
    osVersion = ({ "10.0": "10", "6.3": "8.1", "6.2": "8", "6.1": "7" } as Record<string, string>)[m[1]] ?? m[1];
  } else if ((m = ua.match(/Mac OS X (\d+[_.\d]*)/))) {
    osName = "macOS";
    osVersion = m[1].replace(/_/g, ".");
  } else if (/CrOS/.test(ua)) {
    osName = "ChromeOS";
  } else if (/Linux/.test(ua)) {
    osName = "Linux";
  }

  let browserName = "Unknown";
  let browserVersion = "";
  const browsers: [string, RegExp][] = [
    ["Edge", /Edg(?:e|A|iOS)?\/([\d.]+)/],
    ["Opera", /(?:OPR|Opera)\/([\d.]+)/],
    ["Samsung Internet", /SamsungBrowser\/([\d.]+)/],
    ["Firefox", /(?:Firefox|FxiOS)\/([\d.]+)/],
    ["Chrome", /(?:Chrome|CriOS)\/([\d.]+)/],
    ["Safari", /Version\/([\d.]+).*Safari/],
  ];
  for (const [name, re] of browsers) {
    const match = ua.match(re);
    if (match) {
      browserName = name;
      browserVersion = match[1];
      break;
    }
  }
  return { osName, osVersion, browserName, browserVersion };
}

/** Query parameter names whose values are replaced before a page URL leaves the browser. */
const SENSITIVE_PARAM = /token|secret|password|passwd|pwd|auth|session|key|code|signature|sig|jwt|otp|email/i;

export function redactUrl(href: string): string {
  try {
    const url = new URL(href);
    for (const name of [...url.searchParams.keys()]) {
      if (SENSITIVE_PARAM.test(name)) url.searchParams.set(name, "[redacted]");
    }
    // OAuth implicit-flow fragments (#access_token=...) are the classic leak.
    if (url.hash && SENSITIVE_PARAM.test(url.hash)) url.hash = "#[redacted]";
    return url.toString();
  } catch {
    return href;
  }
}

interface UADataValues {
  platform?: string;
  platformVersion?: string;
  fullVersionList?: { brand: string; version: string }[];
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: {
    getHighEntropyValues(hints: string[]): Promise<UADataValues>;
  };
}

/**
 * Real OS/version from User-Agent Client Hints where available — Chromium
 * freezes the UA string's OS version (e.g. macOS always reads "10_15_7").
 * Never throws; resolves to `null` when hints are unavailable or slow.
 */
async function clientHints(): Promise<UADataValues | null> {
  const uaData = (navigator as NavigatorWithUAData).userAgentData;
  if (!uaData?.getHighEntropyValues) return null;
  try {
    return await Promise.race([
      uaData.getHighEntropyValues(["platform", "platformVersion", "fullVersionList"]),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
    ]);
  } catch {
    return null;
  }
}

function osFromHints(hints: UADataValues, fallback: ParsedUserAgent): { osName: string; osVersion: string } {
  const platform = hints.platform;
  const version = hints.platformVersion ?? "";
  if (!platform) return fallback;
  if (platform === "macOS") return { osName: "macOS", osVersion: trimVersion(version) };
  if (platform === "Windows") {
    // platformVersion 13+ means Windows 11; 1–10 means Windows 10.
    const major = parseInt(version, 10);
    return { osName: "Windows", osVersion: major >= 13 ? "11" : major > 0 ? "10" : fallback.osVersion };
  }
  if (platform === "Android") return { osName: "Android", osVersion: trimVersion(version) || fallback.osVersion };
  if (platform === "Chrome OS" || platform === "ChromeOS") return { osName: "ChromeOS", osVersion: trimVersion(version) };
  return { osName: platform, osVersion: trimVersion(version) || fallback.osVersion };
}

function trimVersion(v: string): string {
  return v.replace(/(\.0)+$/, "");
}

function browserFromHints(hints: UADataValues): { name: string; version: string } | null {
  const list = hints.fullVersionList ?? [];
  const known = ["Microsoft Edge", "Opera", "Google Chrome", "Chromium"];
  for (const brand of known) {
    const hit = list.find((b) => b.brand === brand);
    if (hit) {
      const name = brand === "Microsoft Edge" ? "Edge" : brand === "Google Chrome" ? "Chrome" : brand;
      return { name, version: hit.version };
    }
  }
  return null;
}

export interface EnvironmentInputs {
  screenName?: string | null;
  appVersion?: string;
  appBuild?: string;
}

export async function collectEnvironment(inputs: EnvironmentInputs = {}): Promise<FeedbackEnvironment> {
  const ua = navigator.userAgent;
  const parsed = parseUserAgent(ua);
  const hints = await clientHints();
  const os = hints ? osFromHints(hints, parsed) : parsed;
  const browser = (hints && browserFromHints(hints)) || { name: parsed.browserName, version: parsed.browserVersion };
  const major = browser.version.split(".")[0];

  return {
    osName: os.osName,
    osVersion: os.osVersion,
    deviceModel: major ? `${browser.name} ${major}` : browser.name,
    appVersion: inputs.appVersion ?? "",
    appBuild: inputs.appBuild ?? "",
    bundleIdentifier: location.host,
    screenName: inputs.screenName || location.pathname || null,
    locale: navigator.language || "en",
    screenWidthPoints: window.innerWidth,
    screenHeightPoints: window.innerHeight,
    screenScale: window.devicePixelRatio || 1,
    platform: "web",
    pageUrl: redactUrl(location.href),
    userAgent: ua,
    browserName: browser.name,
    browserVersion: browser.version,
  };
}
