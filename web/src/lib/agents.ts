// The coding agents a report can be sent to from the dashboard's agent
// picker (AgentDispatchButton). GitHub triggers come from the project's
// Coding agent loop settings (0014 `dispatch_labels`/`dispatch_comment`,
// 0018 `dispatch_copilot`); create-github-issue's `agent` field picks one of
// them (supabase/functions/_shared/github.ts `dispatchSettingsFor`), so the
// ids here — `copilot`, `comment`, `all`, or the label itself — must match.
import type { Project } from "@/lib/types";

export type AgentIcon = "claude" | "antigravity" | "copilot" | "comment" | "local" | "all" | "label";

export interface AgentOption {
  /** What create-github-issue's `agent` gets; `local` never reaches it. */
  id: string;
  name: string;
  detail: string;
  icon: AgentIcon;
  /** GitHub triggers go through an issue; `local` is picked up by `feedbackkit watch`. */
  target: "github" | "local";
  /** False for a supported agent this project hasn't set up yet (shown with a link to Settings). */
  configured: boolean;
}

export const LOCAL_AGENT_ID = "local";
export const ALL_AGENTS_ID = "all";

/**
 * Agents with a ready-made GitHub workflow in the setup-agent-runner skill,
 * keyed by the label that workflow listens for.
 */
const LABEL_AGENTS: Record<string, { name: string; icon: AgentIcon; detail: string }> = {
  claude: { name: "Claude Code", icon: "claude", detail: "claude-code-action, via the `claude` label" },
  antigravity: { name: "Antigravity", icon: "antigravity", detail: "Antigravity CLI workflow, via the `antigravity` label" },
};

type DispatchSettings = Pick<Project, "dispatch_labels" | "dispatch_comment" | "dispatch_copilot">;

/**
 * Every agent the picker offers for a project: its configured GitHub
 * triggers first (one entry per label, the trigger comment, Copilot), then
 * "All configured" when there's more than one, the developer's own machine,
 * and the supported agents it hasn't set up yet.
 */
export function agentOptions(project: DispatchSettings): AgentOption[] {
  const labels = (project.dispatch_labels ?? []).map((l) => l.trim()).filter(Boolean);
  const comment = project.dispatch_comment?.trim() || null;
  const configured: AgentOption[] = labels.map((label) => {
    const known = LABEL_AGENTS[label];
    return {
      id: label,
      name: known?.name ?? label,
      detail: known?.detail ?? `Your workflow for the \`${label}\` label`,
      icon: known?.icon ?? "label",
      target: "github",
      configured: true,
    };
  });
  if (comment) {
    configured.push({ id: "comment", name: "Trigger comment", detail: comment, icon: "comment", target: "github", configured: true });
  }
  if (project.dispatch_copilot) {
    configured.push({
      id: "copilot",
      name: "GitHub Copilot",
      detail: "Assigned as you (needs your GitHub account connected)",
      icon: "copilot",
      target: "github",
      configured: true,
    });
  }

  const options = [...configured];
  if (configured.length > 1) {
    options.push({
      id: ALL_AGENTS_ID,
      name: "All configured agents",
      detail: "Every label, comment and assignment above, at once",
      icon: "all",
      target: "github",
      configured: true,
    });
  }
  options.push({
    id: LOCAL_AGENT_ID,
    name: "Your machine",
    detail: "Claude Code or Codex, run by `npx feedbackkit-cli watch` in your repo",
    icon: "local",
    target: "local",
    configured: true,
  });

  for (const [label, known] of Object.entries(LABEL_AGENTS)) {
    if (!labels.includes(label)) {
      options.push({ id: label, name: known.name, detail: known.detail, icon: known.icon, target: "github", configured: false });
    }
  }
  if (!project.dispatch_copilot) {
    options.push({
      id: "copilot",
      name: "GitHub Copilot",
      detail: "Copilot's coding agent, assigned to the issue",
      icon: "copilot",
      target: "github",
      configured: false,
    });
  }
  return options;
}

/**
 * The agent the button sends to: the one this browser picked last for the
 * project if it's still configured, else the first configured GitHub
 * trigger, else null (nothing on GitHub is set up).
 */
export function defaultAgent(options: AgentOption[], savedId: string | null): AgentOption | null {
  const usable = options.filter((o) => o.configured);
  return usable.find((o) => o.id === savedId) ?? usable.find((o) => o.target === "github") ?? null;
}

const storageKey = (projectId: string) => `feedbackkit:agent:${projectId}`;

export function loadPreferredAgent(projectId: string): string | null {
  try {
    return localStorage.getItem(storageKey(projectId));
  } catch {
    return null;
  }
}

export function savePreferredAgent(projectId: string, agentId: string): void {
  try {
    localStorage.setItem(storageKey(projectId), agentId);
  } catch {
    // Private browsing / blocked storage: the default is fine.
  }
}
