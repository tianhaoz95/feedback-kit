import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { DocsCallout, DocsSection, DocsTable, DocsTitle, InlineCode } from "@/components/docs/DocsProse";

const npxList = `npx skills add feedback-kit-skills --list

# Or via GitHub repository shorthand:
npx skills add tianhaoz95/feedback-kit --list`;

const npxInstallAll = `# Interactively choose skills to install into your agent
npx skills add feedback-kit-skills`;

const npxInstallIos = `# Install the iOS SDK setup skill directly
npx skills add feedback-kit-skills --skill setup-ios-sdk --yes`;

const npxInstallMac = `# Install the macOS SDK setup skill directly
npx skills add feedback-kit-skills --skill setup-macos-sdk --yes`;

const npxInstallWatch = `# Install the watchOS SDK setup skill directly
npx skills add feedback-kit-skills --skill setup-watchos-sdk --yes`;

const npxInstallMcp = `# Install the MCP server setup skill directly
npx skills add feedback-kit-skills --skill setup-mcp-server --yes`;

const agentPromptIos = `Please add FeedbackKit to this iOS app:
- Add the package dependency
- Configure with my project key and endpoint URL
- Wire up shake-to-report and screen tracking`;

const agentPromptMcp = `Set up the FeedbackKit MCP server so you can read bug reports and prompts directly.`;

const scaffolderCommands = `# Interactively scaffold a new skill with @clack/prompts
npm run new

# Validate frontmatter across all skills
npm run validate

# List all discoverable skills via npx skills
npm run list`;

export function DocsSkillsPage() {
  return (
    <div>
      <DocsTitle
        eyebrow="Agent Skills"
        title="Agent Skills for FeedbackKit"
        description="Automate SDK installation, trigger wiring, and MCP configuration using AI coding agents. FeedbackKit packages Agent Skills compliant with the vercel-labs/skills open standard via the dedicated feedback-kit-skills package."
      />

      <DocsSection title="What are Agent Skills?">
        <p>
          <a
            href="https://github.com/vercel-labs/skills"
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline font-medium text-neutral-900"
          >
            Agent Skills
          </a>{" "}
          is an open standard for packaging step-by-step instructions, code snippets, and operational recipes for AI
          coding assistants (such as Claude Code, Cursor, Antigravity, and Codex).
        </p>
        <p>
          Instead of manually copying configuration code or reading through integration documentation, you can install
          FeedbackKit's skills into your project. Your coding agent will automatically inspect your project structure
          (SwiftUI vs UIKit, XcodeGen vs SPM), add the Swift package dependency, initialize the SDK with your credentials,
          and install the right triggers.
        </p>
      </DocsSection>

      <DocsSection title="Available skills">
        <p>
          FeedbackKit publishes the <InlineCode>feedback-kit-skills</InlineCode> package containing four targeted skills:
        </p>

        <DocsTable
          columns={["Skill", "Platform", "What it does"]}
          rows={[
            [
              "setup-ios-sdk",
              "iOS",
              "Inspects project structure (SwiftUI or UIKit, XcodeGen or Xcode project), adds the FeedbackKit package, configures credentials at launch, wires shake or floating triggers, and sets up screen tracking.",
            ],
            [
              "setup-macos-sdk",
              "macOS",
              "Integrates FeedbackKit into macOS desktop apps, initializes credentials at startup, wires floating button or Help menu triggers, and configures screen tracking.",
            ],
            [
              "setup-watchos-sdk",
              "watchOS",
              "Integrates FeedbackKit into watchOS apps using FeedbackQuickNoteView embedded in a SwiftUI sheet for streamlined text and context feedback.",
            ],
            [
              "setup-web-sdk",
              "Web",
              "Installs feedbackkit-web in a website or SPA (React, Next.js, Vue, plain HTML), configures it client-side, adds a trigger and screen names.",
            ],
            [
              "setup-mcp-server",
              "Agent / MCP",
              "Installs feedbackkit-cli, completes browser-based authentication, and registers the MCP server in Claude Code, Cursor, Antigravity, or Codex.",
            ],
            [
              "setup-release-loop",
              "Release loop",
              "Wires the repo's releases into the loop: GitHub fix linking and agent hand-off, a CI release token, build announcements so reporters get asked \"is it fixed?\", correct build numbers, and an optional beta on every push.",
            ],
            [
              "fix-feedback",
              "Agent workflow",
              "Fixes a report end to end over MCP: claim, reproduce, fix, attach an after-fix screenshot, and commit with a FeedbackKit: trailer so the fix ships back to the reporter.",
            ],
            [
              "promote-release",
              "Owner workflow",
              "Reads release readiness (verified / awaiting / reopened), explains what blocks a beta, recommends which build to ship, and records the promotion.",
            ],
          ]}
        />
      </DocsSection>

      <DocsSection title="Install with npx skills">
        <p>
          Install skills directly from your terminal using <InlineCode>feedback-kit-skills</InlineCode>:
        </p>
        <CodeBlock code={npxList} label="List discoverable skills" />

        <p>To install skills interactively into your current project or agent workspace:</p>
        <CodeBlock code={npxInstallAll} label="Interactive install" />

        <p>Or install specific skills non-interactively:</p>
        <div className="space-y-3">
          <CodeBlock code={npxInstallIos} label="iOS setup skill" />
          <CodeBlock code={npxInstallMac} label="macOS setup skill" />
          <CodeBlock code={npxInstallWatch} label="watchOS setup skill" />
          <CodeBlock code={npxInstallMcp} label="MCP server setup skill" />
        </div>

        <DocsCallout>
          The <InlineCode>--yes</InlineCode> flag accepts prompt confirmations automatically, which is ideal when running inside an agent session or automated setup script.
        </DocsCallout>
      </DocsSection>

      <DocsSection title="Using with Claude Code">
        <p>
          In a repository where you want to add FeedbackKit, install the setup skill:
        </p>
        <CodeBlock code={`npx skills add feedback-kit-skills --skill setup-ios-sdk --yes`} label="Terminal" />
        <p>Then start Claude Code and ask it to perform the setup:</p>
        <CodeBlock code={agentPromptIos} label="You, to Claude Code" />
        <p>
          Claude Code will follow the skill instructions to locate your app delegate or main app struct, add the package
          dependency, configure credentials, and verify clean compilation with <InlineCode>xcodebuild</InlineCode>.
        </p>
      </DocsSection>

      <DocsSection title="Using with Cursor & Antigravity">
        <p>
          Both Cursor and Google Antigravity support Agent Skills placed in your workspace or global config directories.
        </p>
        <p>
          Run <InlineCode>npx skills add feedback-kit-skills</InlineCode> in your project root. The skills will be
          installed into your project's agent configuration where they are automatically discovered when you ask:
        </p>
        <CodeBlock code={`Please setup FeedbackKit in our macOS app and wire up a floating trigger button.`} label="You, to your agent" />
      </DocsSection>

      <DocsSection title="Setting up the MCP server via skill">
        <p>
          To connect your agent directly to your FeedbackKit dashboard so it can fetch bug reports and prompts without copy-pasting:
        </p>
        <CodeBlock code={`npx skills add feedback-kit-skills --skill setup-mcp-server --yes`} label="Terminal" />
        <p>Then ask your agent:</p>
        <CodeBlock code={agentPromptMcp} label="You, to your agent" />
        <p>
          The agent will install <InlineCode>feedbackkit-cli</InlineCode>, guide you through <InlineCode>feedbackkit login</InlineCode>,
          and register the MCP server config into your agent's configuration file. See{" "}
          <Link to="/docs/mcp" className="link-underline font-medium text-neutral-900">
            the MCP documentation
          </Link>{" "}
          for details on available tools and queries.
        </p>
      </DocsSection>

      <DocsSection title="Developing new skills">
        <p>
          This repository includes built-in tooling for developing and validating skills:
        </p>
        <CodeBlock code={scaffolderCommands} label="Terminal" />
        <p>
          Each skill is a directory containing a <InlineCode>SKILL.md</InlineCode> with YAML frontmatter:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-600">
          <li>
            <InlineCode>name</InlineCode>: must match the enclosing directory basename in kebab-case.
          </li>
          <li>
            <InlineCode>description</InlineCode>: a descriptive summary explaining what the skill does and what triggers it.
          </li>
          <li>
            <InlineCode>npm run validate</InlineCode>: verifies that all frontmatter blocks are valid and properly structured.
          </li>
        </ul>
      </DocsSection>
    </div>
  );
}
