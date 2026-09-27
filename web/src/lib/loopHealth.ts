import type { FeedbackEvent, FeedbackItem, Project } from "./types";

/**
 * Is a project's closed loop actually wired up, and is any report stuck in it?
 * Pure, so it's unit-tested (loopHealth.test.ts); components/LoopChecklist.tsx
 * and components/FixLoopPanel.tsx render it.
 */

export type LoopStepId = "report" | "verification" | "github" | "agent" | "linked" | "announced" | "verified";

export interface LoopSignals {
  hasReport: boolean;
  /** Any report carrying a reporter id — the SDK's fix verification is on. */
  hasReporterId: boolean;
  project: Pick<Project, "github_repo" | "github_installation_id" | "dispatch_labels" | "dispatch_comment" | "dispatch_copilot">;
  /** Any claimed/dispatched event: an agent has picked up a report. */
  hasAgentActivity: boolean;
  /** Any pr_opened/pr_merged/fix_committed event: fixes get linked to reports. */
  hasLinkedFix: boolean;
  /** Any release recorded for the project. */
  hasRelease: boolean;
  hasVerified: boolean;
}

export interface LoopStep {
  id: LoopStepId;
  done: boolean;
  title: string;
  /** What to do when it isn't done yet. */
  howTo: string;
}

export function loopChecklist(s: LoopSignals): LoopStep[] {
  const agentConfigured =
    (s.project.dispatch_labels?.length ?? 0) > 0 || !!s.project.dispatch_comment || !!s.project.dispatch_copilot;
  return [
    {
      id: "report",
      done: s.hasReport,
      title: "Reports arrive",
      howTo: "Add the SDK to your app or website with this project's key (SDK setup tab), then send a test report.",
    },
    {
      id: "verification",
      done: s.hasReporterId,
      title: "Reporters can be asked “is it fixed?”",
      howTo:
        "Call FeedbackKit.enableFixVerification(…) in the app (iOS/macOS) or FeedbackKit.enableFixVerification() on the web. Reports sent after that carry a reporter id.",
    },
    {
      id: "github",
      done: !!s.project.github_repo && !!s.project.github_installation_id,
      title: "GitHub connected",
      howTo: "Settings → GitHub Integration: install the FeedbackKit GitHub App on the repository and connect it.",
    },
    {
      id: "agent",
      done: s.hasAgentActivity || agentConfigured,
      title: "A coding agent picks up reports",
      howTo:
        "Connect the MCP server (Connect AI agent tab), set a dispatch label or Copilot in Settings → Coding agent loop, or run `npx feedbackkit-cli watch` in your repo.",
    },
    {
      id: "linked",
      done: s.hasLinkedFix,
      title: "Fixes are linked to reports",
      howTo:
        "Fix commits or PR descriptions carry `FeedbackKit: <report id>` (agents add it from the prompt). Without the GitHub App's webhook, use `feedbackkit link`.",
    },
    {
      id: "announced",
      done: s.hasRelease,
      title: "Builds are announced",
      howTo:
        "Run `npx feedbackkit-cli release --build <n>` at the end of each release (the setup-release-loop skill wires it into CI). Until then fixes stay at “Merged”.",
    },
    {
      id: "verified",
      done: s.hasVerified,
      title: "A reporter confirmed a fix",
      howTo: "Happens on its own once the steps above work: the reporter opens a build containing the fix and taps “Yes”.",
    },
  ];
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export interface StuckHint {
  tone: "warning" | "info";
  message: string;
  /** Show the developer's "Mark verified" override. */
  offerMarkVerified?: boolean;
}

function lastEventTime(events: FeedbackEvent[], kinds: string[]): number | null {
  const times = events.filter((e) => kinds.includes(e.kind)).map((e) => Date.parse(e.created_at));
  return times.length ? Math.max(...times) : null;
}

/** Why a report has sat at its stage too long, and what usually unsticks it. */
/** Whether the reporter can be asked on their device: they have an id and didn't opt out (0023). */
export function reporterReachable(item: Pick<FeedbackItem, "reporter_id" | "notify_reporter">): boolean {
  return !!item.reporter_id && item.notify_reporter !== false;
}

export function stuckHint(
  item: Pick<FeedbackItem, "fix_stage" | "shipped_at" | "reporter_id" | "notify_reporter">,
  events: FeedbackEvent[],
  now = Date.now(),
): StuckHint | null {
  const stage = item.fix_stage ?? null;
  if (stage === "agent_working") {
    const since = lastEventTime(events, ["claimed", "dispatched"]);
    if (since && now - since > DAY) {
      return {
        tone: "warning",
        message: `An agent picked this up ${Math.floor((now - since) / DAY)}d ago and no pull request has been linked. Check the agent's run, or send it to the agent again.`,
      };
    }
  }
  if (stage === "merged") {
    const since = lastEventTime(events, ["pr_merged", "fix_committed"]);
    if (since && now - since > 3 * DAY) {
      return {
        tone: "warning",
        message: `Merged ${Math.floor((now - since) / DAY)}d ago, but no announced build contains it yet. Run \`feedbackkit release\` after each build (see the loop checklist) so the reporter gets asked.`,
      };
    }
  }
  if (stage === "shipped") {
    const since = item.shipped_at ? Date.parse(item.shipped_at) : lastEventTime(events, ["shipped"]);
    if (!reporterReachable(item)) {
      return {
        tone: "info",
        message: item.reporter_id
          ? "The reporter chose not to hear back, so nobody will be asked to confirm. Mark it verified once you've checked it yourself."
          : "This report has no reporter id, so nobody can be asked to confirm. Mark it verified once you've checked it yourself.",
        offerMarkVerified: true,
      };
    }
    if (since && now - since > 7 * DAY) {
      return {
        tone: "info",
        message: `Shipped ${Math.floor((now - since) / DAY)}d ago and the reporter hasn't answered yet (they're asked when they open a build with the fix). If you've confirmed it yourself, mark it verified.`,
        offerMarkVerified: true,
      };
    }
  }
  return null;
}
