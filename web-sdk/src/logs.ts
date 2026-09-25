import type { FeedbackLogEntry, LogLevel } from "./types";
import { redactUrl } from "./environment";

/**
 * Keeps a small ring buffer of recent console output, uncaught errors, and
 * failed network requests, so a report can carry "what the page was
 * complaining about" alongside the screenshot. This is the one kind of
 * context a browser has that native reports don't, and it's exactly what a
 * coding agent needs to go from "the button does nothing" to a root cause.
 *
 * Privacy: messages are truncated, obvious credentials (bearer tokens, JWTs,
 * sensitive query params) are redacted, request/response *bodies* are never
 * recorded, and `console.log`/`debug` are excluded unless opted in.
 */

export interface LogCaptureOptions {
  /** Max entries kept (oldest dropped first). Default 50. */
  maxEntries?: number;
  /** Also record `console.log`/`console.info`/`console.debug`. Default false — warn/error only. */
  includeVerbose?: boolean;
  /** Record fetch/XHR requests that fail or return HTTP >= 400. Default true. */
  network?: boolean;
}

const MAX_MESSAGE_LENGTH = 1000;

export function redactMessage(message: string): string {
  return message
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted-jwt]")
    .replace(/https?:\/\/[^\s"'<>)]+/g, (url) => redactUrl(url))
    .replace(/("?(?:password|passwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}&]+)/gi, "$1[redacted]");
}

export function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  if (arg === undefined) return "undefined";
  if (typeof arg === "function") return `[function ${arg.name || "anonymous"}]`;
  if (typeof Element !== "undefined" && arg instanceof Element) return `<${arg.tagName.toLowerCase()}>`;
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(arg, (_k, v: unknown) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[circular]";
        seen.add(v);
      }
      return typeof v === "bigint" ? v.toString() : v;
    });
  } catch {
    return String(arg);
  }
}

export class LogBuffer {
  private entries: FeedbackLogEntry[] = [];
  constructor(private maxEntries = 50) {}

  push(level: LogLevel, message: string): void {
    let text = redactMessage(message);
    if (text.length > MAX_MESSAGE_LENGTH) text = `${text.slice(0, MAX_MESSAGE_LENGTH)}… [truncated]`;
    this.entries.push({ level, message: text, timestamp: new Date().toISOString() });
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
  }

  snapshot(): FeedbackLogEntry[] {
    return this.entries.slice();
  }

  clear(): void {
    this.entries = [];
  }
}

type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

/** Installs the hooks; returns the buffer plus an uninstall function restoring every patched global. */
export function installLogCapture(options: LogCaptureOptions = {}): { buffer: LogBuffer; uninstall: () => void } {
  const buffer = new LogBuffer(options.maxEntries ?? 50);
  const restores: (() => void)[] = [];

  const methods: ConsoleMethod[] = options.includeVerbose ? ["log", "info", "warn", "error", "debug"] : ["warn", "error"];
  for (const method of methods) {
    const original = console[method];
    console[method] = function (this: Console, ...args: unknown[]) {
      try {
        buffer.push(method, args.map(stringifyArg).join(" "));
      } catch {
        // Never let log capture break the host page's own logging.
      }
      return original.apply(this, args);
    };
    restores.push(() => {
      console[method] = original;
    });
  }

  const onError = (event: ErrorEvent) => {
    const where = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : "";
    buffer.push("error", `Uncaught ${event.error ? stringifyArg(event.error) : event.message}${where}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    buffer.push("error", `Unhandled promise rejection: ${stringifyArg(event.reason)}`);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  restores.push(() => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  });

  if (options.network !== false) {
    restores.push(patchFetch(buffer), patchXHR(buffer));
  }

  return {
    buffer,
    uninstall: () => {
      for (const restore of restores.reverse()) restore();
    },
  };
}

/** Requests to FeedbackKit's own endpoint are skipped so a failed submit doesn't log itself. */
let ignoredUrlPrefix: string | null = null;
export function setIgnoredUrlPrefix(prefix: string | null): void {
  ignoredUrlPrefix = prefix;
}

function isIgnored(url: string): boolean {
  return !!ignoredUrlPrefix && url.startsWith(ignoredUrlPrefix);
}

function patchFetch(buffer: LogBuffer): () => void {
  if (typeof window.fetch !== "function") return () => {};
  const original = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = input instanceof Request ? input.url : String(input);
    try {
      const response = await original.call(window, input, init);
      if (response.status >= 400 && !isIgnored(url)) {
        buffer.push("network", `${method} ${url} → ${response.status} ${response.statusText}`.trim());
      }
      return response;
    } catch (error) {
      if (!isIgnored(url) && !(error instanceof DOMException && error.name === "AbortError")) {
        buffer.push("network", `${method} ${url} → failed: ${stringifyArg(error)}`);
      }
      throw error;
    }
  };
  return () => {
    window.fetch = original;
  };
}

function patchXHR(buffer: LogBuffer): () => void {
  if (typeof XMLHttpRequest === "undefined") return () => {};
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  const meta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

  proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    meta.set(this, { method: String(method).toUpperCase(), url: String(url) });
    return (originalOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof proto.open;

  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    this.addEventListener("loadend", () => {
      const info = meta.get(this);
      if (!info || isIgnored(info.url)) return;
      if (this.status === 0) buffer.push("network", `${info.method} ${info.url} → failed (network error)`);
      else if (this.status >= 400) buffer.push("network", `${info.method} ${info.url} → ${this.status} ${this.statusText}`.trim());
    });
    return originalSend.call(this, body);
  };

  return () => {
    proto.open = originalOpen;
    proto.send = originalSend;
  };
}
