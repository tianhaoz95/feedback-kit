import { useState } from "react";
import { Link } from "react-router-dom";
import { CopyButton } from "@/components/CopyButton";
import { SparkleIcon, TerminalIcon } from "@/components/icons";
import {
  generateAgentSetupPrompt,
  type TargetPlatform,
} from "@/lib/agent-setup-prompt";

const PLATFORMS: { id: TargetPlatform; label: string }[] = [
  { id: "ios", label: "iOS" },
  { id: "macos", label: "macOS" },
  { id: "multiplatform", label: "Multiplatform" },
  { id: "watchos", label: "watchOS" },
];

export function SdkSetupCard({
  projectKey,
  endpointUrl,
  projectName,
}: {
  projectKey: string;
  endpointUrl: string;
  projectName?: string;
}) {
  const [activeTab, setActiveTab] = useState<"agent" | "manual">("agent");
  const [platform, setPlatform] = useState<TargetPlatform>("ios");

  const agentPrompt = generateAgentSetupPrompt({
    platform,
    projectKey,
    endpointUrl,
    projectName,
  });

  const swiftSnippet = `FeedbackKit.configure(.init(\n    endpointURL: URL(string: "${endpointUrl}")!,\n    projectKey: "${projectKey}"\n))`;
  const packageUrl = "https://github.com/tianhaoz95/feedback-kit";

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {activeTab === "agent" ? (
              <SparkleIcon className="h-4 w-4 text-neutral-500" />
            ) : (
              <TerminalIcon className="h-4 w-4 text-neutral-500" />
            )}
            <h2 className="text-sm font-medium text-neutral-900">SDK setup</h2>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {activeTab === "agent"
              ? "Supply this prompt to your AI coding agent to integrate FeedbackKit in the proper place."
              : "Paste this where you configure FeedbackKit at app launch."}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex shrink-0 self-start sm:self-auto rounded-lg border border-neutral-200 bg-neutral-100/70 p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("agent")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
              activeTab === "agent"
                ? "bg-white text-neutral-900 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <SparkleIcon className="h-3.5 w-3.5 text-neutral-700" />
            <span>AI coding agent</span>
            <span className="rounded bg-neutral-900/5 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
              Recommended
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors ${
              activeTab === "manual"
                ? "bg-white text-neutral-900 shadow-xs font-semibold"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            <TerminalIcon className="h-3.5 w-3.5 text-neutral-500" />
            <span>Manual setup</span>
          </button>
        </div>
      </div>

      {activeTab === "agent" ? (
        <div className="mt-4 space-y-3">
          {/* Platform selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">Target platform:</span>
            <div className="inline-flex gap-1">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    platform === p.id
                      ? "bg-neutral-900 text-white shadow-xs"
                      : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt container */}
          <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-xs">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
              <span className="text-[11px] font-medium text-neutral-400">
                Coding agent prompt · {PLATFORMS.find((p) => p.id === platform)?.label}
              </span>
              <CopyButton text={agentPrompt} label="Copy prompt" variant="dark" />
            </div>
            <pre className="max-h-80 overflow-y-auto overflow-x-auto p-4 font-mono text-xs leading-relaxed text-neutral-100 whitespace-pre-wrap select-all">
              {agentPrompt}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <CopyButton text={agentPrompt} label="Copy prompt for agent" variant="primary" size="md" />
            <div className="flex items-center gap-3">
              <Link
                to="/docs/skills"
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
              >
                Or install Agent Skills →
              </Link>
              <Link
                to="/docs/ios-sdk"
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
              >
                View SDK documentation →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <span className="text-xs font-medium text-neutral-700">1. Add Swift Package dependency</span>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-mono text-neutral-800">
                {packageUrl}
              </code>
              <CopyButton text={packageUrl} label="Copy URL" />
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-neutral-700">2. Configure FeedbackKit at app launch</span>
            <pre className="mt-1 overflow-x-auto rounded-lg bg-neutral-900 p-3.5 text-xs leading-relaxed text-neutral-100">
              {swiftSnippet}
            </pre>
            <div className="mt-2.5">
              <CopyButton text={swiftSnippet} label="Copy snippet" />
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-3">
            <Link
              to="/docs/ios-sdk"
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
            >
              View full SDK setup guide (triggers, screen tracking, etc.) →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
