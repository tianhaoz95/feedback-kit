import type { FeedbackEnvironment } from "@/lib/types";

export type PlatformId = "web" | "ios" | "macos" | "watchos" | "unknown";

export interface PlatformInfo {
  id: PlatformId;
  label: string;
}

/**
 * Which SDK a report came from. Web reports say so explicitly
 * (`environment.platform === "web"`); native reports predate that field, so
 * they're inferred from `osName` (the Swift SDK reports "iOS"/"iPadOS",
 * "macOS" or "watchOS").
 */
export function platformOf(env: Partial<FeedbackEnvironment> | null | undefined): PlatformInfo {
  if (env?.platform === "web") return { id: "web", label: "Web" };
  const os = (env?.osName ?? "").toLowerCase();
  if (os === "ios" || os === "ipados") return { id: "ios", label: env?.osName ?? "iOS" };
  if (os === "macos") return { id: "macos", label: "macOS" };
  if (os === "watchos") return { id: "watchos", label: "watchOS" };
  return { id: "unknown", label: env?.osName || "Unknown" };
}
