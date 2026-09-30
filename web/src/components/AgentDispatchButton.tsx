import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AntigravityIcon,
  CheckIcon,
  ChevronDownIcon,
  ClaudeIcon,
  CopilotIcon,
  GitHubIcon,
  LayersIcon,
  MessageIcon,
  SettingsIcon,
  SparkleIcon,
  TerminalIcon,
} from "@/components/icons";
import {
  agentOptions,
  defaultAgent,
  loadPreferredAgent,
  savePreferredAgent,
  type AgentIcon,
  type AgentOption,
} from "@/lib/agents";
import type { Project } from "@/lib/types";
import { TextWithCode } from "@/components/TextWithCode";

const ISSUE_ONLY = "issue_only";
const ISSUE_ONLY_KEY = "feedbackkit:issue_create_mode";

function loadIssueOnly(): boolean {
  try {
    return localStorage.getItem(ISSUE_ONLY_KEY) === ISSUE_ONLY;
  } catch {
    return false;
  }
}

function saveIssueOnly(issueOnly: boolean) {
  try {
    localStorage.setItem(ISSUE_ONLY_KEY, issueOnly ? ISSUE_ONLY : "auto");
  } catch {
    // Ignore storage failures.
  }
}

export function AgentGlyph({ icon, className = "h-3.5 w-3.5" }: { icon: AgentIcon; className?: string }) {
  switch (icon) {
    case "claude":
      return <ClaudeIcon className={`${className} text-[#D97757]`} />;
    case "antigravity":
      return <AntigravityIcon className={`${className} text-neutral-800`} />;
    case "copilot":
      return <CopilotIcon className={`${className} text-neutral-800`} />;
    case "comment":
      return <MessageIcon className={`${className} text-neutral-700`} />;
    case "local":
      return <TerminalIcon className={`${className} text-neutral-700`} />;
    case "all":
      return <LayersIcon className={`${className} text-neutral-700`} />;
    default:
      return <SparkleIcon className={`${className} text-neutral-700`} />;
  }
}

export interface AgentDispatchButtonProps {
  project: Pick<Project, "id" | "dispatch_labels" | "dispatch_comment" | "dispatch_copilot">;
  /** The report(s) already have a GitHub issue: the button re-sends it instead of creating one. */
  hasIssue?: boolean;
  /** An agent already worked on it, so the label says "again". */
  sentBefore?: boolean;
  loading?: boolean;
  disabled?: boolean;
  batchCount?: number;
  /** `agent` null = create the issue without handing it to anyone. */
  onDispatch: (options: { agent: string | null }) => void;
  /** Queue for `feedbackkit watch`; omitted where a local run doesn't apply (batches). */
  onRunLocal?: () => void;
  localState?: "idle" | "queuing" | "queued";
  /** Opens Settings → Coding agent loop at the setup steps for `agent` (an AgentOption id), or for any agent. */
  onSetUp?: (agent?: string) => void;
  /** Overrides the primary button's tooltip (e.g. why it's disabled). */
  title?: string;
  className?: string;
}

/**
 * One button for handing a report to a coding agent: the primary half sends
 * to the agent picked last (per project, in this browser), the menu lists
 * every agent this project can reach — each configured GitHub trigger on its
 * own, the developer's own machine, and the supported agents that still need
 * setting up.
 */
export function AgentDispatchButton({
  project,
  hasIssue = false,
  sentBefore = false,
  loading = false,
  disabled = false,
  batchCount,
  onDispatch,
  onRunLocal,
  localState = "idle",
  onSetUp,
  title,
  className = "",
}: AgentDispatchButtonProps) {
  const options = useMemo(
    () => agentOptions(project).filter((o) => o.target !== "local" || onRunLocal),
    [project, onRunLocal],
  );
  const [savedAgent, setSavedAgent] = useState(() => loadPreferredAgent(project.id));
  const [issueOnly, setIssueOnly] = useState(loadIssueOnly);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSavedAgent(loadPreferredAgent(project.id)), [project.id]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = defaultAgent(options, savedAgent);
  // "Create issue only" is remembered, but means nothing once the issue exists.
  const primaryIsIssueOnly = !hasIssue && (issueOnly || !selected);
  // The issue exists but nothing on GitHub (or this machine) is set up to take it.
  const needsSetup = hasIssue && !selected;
  const isBatch = typeof batchCount === "number" && batchCount > 1;

  function send(option: AgentOption | null) {
    setOpen(false);
    if (option === null) {
      onDispatch({ agent: null });
      return;
    }
    if (option.target === "local") {
      onRunLocal?.();
      return;
    }
    onDispatch({ agent: option.id });
  }

  function pick(option: AgentOption | null) {
    if (option === null) {
      setIssueOnly(true);
      saveIssueOnly(true);
    } else {
      setIssueOnly(false);
      saveIssueOnly(false);
      setSavedAgent(option.id);
      savePreferredAgent(project.id, option.id);
    }
    send(option);
  }

  let primaryLabel: string;
  if (loading) {
    primaryLabel = hasIssue ? "Sending…" : "Creating issue…";
  } else if (localState === "queuing" && selected?.target === "local") {
    primaryLabel = "Queuing…";
  } else if (localState === "queued" && selected?.target === "local") {
    primaryLabel = "Queued for your machine";
  } else if (needsSetup) {
    primaryLabel = "Set up a coding agent";
  } else if (primaryIsIssueOnly) {
    primaryLabel = isBatch ? "Create one issue only" : "Create issue only";
  } else if (selected?.target === "local") {
    primaryLabel = "Run on my machine";
  } else {
    const name = selected!.name;
    primaryLabel = isBatch
      ? `Send ${batchCount} to ${name}`
      : hasIssue
      ? `Send to ${name}${sentBefore ? " again" : ""}`
      : `Create issue & send to ${name}`;
  }

  const primaryTitle = title
    ? title
    : needsSetup
    ? "No coding agent is set up for this project yet — open Settings → Coding agent loop"
    : primaryIsIssueOnly
    ? "Create a GitHub issue for tracking without triggering an agent"
    : selected?.target === "local"
    ? "Queue this report for a coding agent on your own machine — run `npx feedbackkit-cli watch` in your repo"
    : `${hasIssue ? "Re-trigger" : "Create a GitHub issue and trigger"} ${selected?.name} (${selected?.detail})`;

  const configured = options.filter((o) => o.configured);
  const notSetUp = options.filter((o) => !o.configured);

  return (
    <div ref={containerRef} className={`relative inline-flex items-stretch rounded-lg shadow-xs ${className}`}>
      <button
        type="button"
        disabled={disabled || loading || (selected?.target === "local" && localState === "queuing")}
        onClick={() => (needsSetup ? onSetUp?.() : send(primaryIsIssueOnly ? null : selected))}
        title={primaryTitle}
        className="inline-flex items-center gap-1.5 rounded-l-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {needsSetup ? (
          <SettingsIcon className="h-3.5 w-3.5 text-neutral-700" />
        ) : primaryIsIssueOnly ? (
          <GitHubIcon className="h-3.5 w-3.5 text-neutral-700" />
        ) : (
          <AgentGlyph icon={selected!.icon} />
        )}
        <span>{primaryLabel}</span>
      </button>
      <button
        type="button"
        aria-label="Choose a coding agent"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className="-ml-px inline-flex items-center rounded-r-lg border border-neutral-200 bg-white px-1.5 py-1.5 text-xs text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 focus:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg"
        >
          {configured.length > 0 ? <MenuHeading>{hasIssue ? "Send to" : "Create issue & send to"}</MenuHeading> : null}
          {configured.map((option) => (
            <MenuItem
              key={option.id}
              icon={<AgentGlyph icon={option.icon} className="h-4 w-4" />}
              title={option.name}
              detail={option.detail}
              checked={!primaryIsIssueOnly && selected?.id === option.id}
              onClick={() => pick(option)}
            />
          ))}

          {!hasIssue ? (
            <MenuItem
              icon={<GitHubIcon className="h-4 w-4 text-neutral-700" />}
              title="Create issue only"
              detail="Track it on GitHub without triggering an agent"
              checked={primaryIsIssueOnly}
              onClick={() => pick(null)}
            />
          ) : null}

          {notSetUp.length > 0 ? (
            <>
              <div className="my-1 border-t border-neutral-100" />
              <MenuHeading>Not set up for this project</MenuHeading>
              {notSetUp.map((option) => (
                <MenuItem
                  key={`setup-${option.id}`}
                  icon={<AgentGlyph icon={option.icon} className="h-4 w-4 opacity-50" />}
                  title={option.name}
                  detail={option.detail}
                  muted
                  trailing={onSetUp ? <SettingsIcon className="h-3.5 w-3.5 text-neutral-400" /> : null}
                  onClick={() => {
                    setOpen(false);
                    onSetUp?.(option.id);
                  }}
                />
              ))}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MenuHeading({ children }: { children: ReactNode }) {
  return <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-400">{children}</div>;
}

function MenuItem({
  icon,
  title,
  detail,
  checked = false,
  muted = false,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  checked?: boolean;
  muted?: boolean;
  trailing?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 ${
        checked ? "bg-neutral-50/80" : ""
      }`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-xs font-semibold ${muted ? "text-neutral-500" : "text-neutral-900"}`}>{title}</span>
          {checked ? <CheckIcon className="h-3.5 w-3.5 shrink-0 text-neutral-900" /> : trailing}
        </div>
        <p className="mt-0.5 break-words text-[11px] leading-normal text-neutral-500">
          <TextWithCode text={muted ? `${detail}. Click for setup steps.` : detail} />
        </p>
      </div>
    </button>
  );
}
