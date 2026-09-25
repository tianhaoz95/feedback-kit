import Foundation
import FeedbackKit

public enum PromptGenerator {
    public static let placeholders: [String] = [
        "feedback_id",
        "feedback_text",
        "screen_name",
        "os_name",
        "os_version",
        "device_model",
        "app_version",
        "app_build",
        "locale",
        "screenshot_url",
        "attachment_url",
        "products",
        "platform",
        "page_url",
        "browser",
        "console_logs"
    ]

    /// Recent console/network logs as a fenced block, newest last — mirrors
    /// `formatConsoleLogs` in web/src/lib/prompt-template.ts.
    public static func formatConsoleLogs(_ logs: [PortalLogEntry]) -> String {
        guard !logs.isEmpty else { return "(none captured)" }
        let lines = logs.map { log -> String in
            let time = log.timestamp.count >= 19
                ? String(log.timestamp[log.timestamp.index(log.timestamp.startIndex, offsetBy: 11)..<log.timestamp.index(log.timestamp.startIndex, offsetBy: 19)])
                : ""
            return "\(time) [\(log.level)] \(log.message)"
        }
        return "```\n" + lines.joined(separator: "\n") + "\n```"
    }

    static func browserLabel(_ env: FeedbackEnvironment) -> String {
        if let name = env.browserName {
            return "\(name) \(env.browserVersion ?? "")".trimmingCharacters(in: .whitespaces)
        }
        return env.deviceModel
    }

    /// Appended to a web report's prompt when the template uses none of the
    /// web placeholders — same rule as the dashboard and CLI.
    static func webContextSection(_ feedback: PortalFeedbackItem) -> String {
        let env = feedback.environment
        return [
            "## Web context",
            "- Page URL: \(env.pageUrl ?? "(unknown)")",
            "- Browser: \(browserLabel(env))",
            "- Viewport: \(Int(env.screenWidthPoints))×\(Int(env.screenHeightPoints)) @\(formatScale(env.screenScale))x",
            "",
            "### Console & network log (most recent last)",
            formatConsoleLogs(feedback.logs)
        ].joined(separator: "\n")
    }

    private static func formatScale(_ scale: Double) -> String {
        scale == scale.rounded() ? String(Int(scale)) : String(scale)
    }

    public static func formatProductsList(_ products: [FeedbackProduct]) -> String {
        guard !products.isEmpty else { return "(none specified)" }
        return products.map { p in
            let desc = p.description.isEmpty ? "" : ": \(p.description)"
            let name = p.name.isEmpty ? p.key : p.name
            return "- **\(name)** (`\(p.key)`)\(desc)"
        }.joined(separator: "\n")
    }

    public static let defaultTemplate = """
    You are fixing an issue reported by a real user of this app. If it reads as a feature request rather than a bug, implement the requested behavior instead.

    ## User's report
    {{feedback_text}}

    ## Screen
    {{screen_name}}

    ## Environment
    - OS: {{os_name}} {{os_version}}
    - Device: {{device_model}}
    - App version: {{app_version}} ({{app_build}})
    - Locale: {{locale}}

    ## Screenshot
    An annotated screenshot highlighting the issue is at: {{screenshot_url}}

    ## Task
    Investigate the code for the "{{screen_name}}" screen, identify the root cause, and implement a minimal, style-consistent fix.
    """

    public static func renderPrompt(
        template: String,
        feedback: PortalFeedbackItem,
        screenshotUrl: String?,
        attachmentUrl: String?
    ) -> String {
        let env = feedback.environment
        let values: [String: String] = [
            "feedback_text": feedback.text.isEmpty ? "(no description provided)" : feedback.text,
            "screen_name": env.screenName ?? "(unknown)",
            "os_name": env.osName,
            "os_version": env.osVersion,
            "device_model": env.deviceModel,
            "app_version": env.appVersion,
            "app_build": env.appBuild,
            "locale": env.locale,
            "screenshot_url": screenshotUrl ?? "",
            "attachment_url": attachmentUrl ?? "(no attachment)",
            "products": formatProductsList(feedback.products),
            "platform": env.isWeb ? "Web" : env.osName,
            "page_url": env.pageUrl ?? "(not a web report)",
            "browser": env.isWeb ? browserLabel(env) : "(not a web report)",
            "console_logs": formatConsoleLogs(feedback.logs),
            "feedback_id": feedback.id
        ]

        var rendered = template.isEmpty ? defaultTemplate : template

        if env.isWeb, rendered.range(of: "\\{\\{\\s*(page_url|console_logs|browser)\\s*\\}\\}", options: .regularExpression) == nil {
            rendered = rendered.trimmingCharacters(in: .whitespacesAndNewlines) + "\n\n" + webContextSection(feedback)
        }

        // If no screenshot is included, remove the entire ## Screenshot section
        if screenshotUrl == nil || screenshotUrl?.isEmpty == true {
            let sectionPattern = "(?m)^##\\s*Screenshot\\s*\\n[\\s\\S]*?(?=(?:^##\\s|\\z))"
            if let regex = try? NSRegularExpression(pattern: sectionPattern, options: []) {
                let range = NSRange(location: 0, length: rendered.utf16.count)
                rendered = regex.stringByReplacingMatches(in: rendered, options: [], range: range, withTemplate: "")
            }
        }

        for (key, val) in values {
            let pattern = "\\{\\{\\s*" + key + "\\s*\\}\\}"
            if let regex = try? NSRegularExpression(pattern: pattern, options: []) {
                let range = NSRange(location: 0, length: rendered.utf16.count)
                rendered = regex.stringByReplacingMatches(in: rendered, options: [], range: range, withTemplate: NSRegularExpression.escapedTemplate(for: val))
            }
        }
        return rendered.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func renderMergedPrompt(
        items: [PortalFeedbackItem],
        templateText: String? = nil
    ) -> String {
        guard !items.isEmpty else { return "" }
        if items.count == 1 {
            let item = items[0]
            if let edited = item.editedPrompt, !edited.isEmpty {
                return edited
            }
            return renderPrompt(
                template: templateText ?? defaultTemplate,
                feedback: item,
                screenshotUrl: item.signedScreenshotUrl,
                attachmentUrl: item.signedAttachmentUrl
            )
        }

        let header = """
        You are an expert software engineer addressing multiple user feedback reports for this app in a single pass.
        Resolve all \(items.count) reported issues described below in a coordinated manner. By solving them together, ensure changes are cohesive, avoid git merge conflicts, and prevent regressions across shared files, state, or navigation flows.
        """

        var summaryLines: [String] = []
        for (idx, item) in items.enumerated() {
            let screen = item.environment.screenName.map { "[\($0)] " } ?? ""
            let textSnippet: String
            if item.text.isEmpty {
                textSnippet = "(no description)"
            } else if item.text.count > 70 {
                textSnippet = String(item.text.prefix(67)) + "…"
            } else {
                textSnippet = item.text
            }
            summaryLines.append("\(idx + 1). \(screen)\(textSnippet) (ID: `\(item.id)`, Status: \(item.status.rawValue))")
        }

        var detailSections: [String] = []
        for (idx, item) in items.enumerated() {
            let env = item.environment
            let screenshot = item.signedScreenshotUrl ?? (item.screenshotAnnotatedPath != nil ? "(Screenshot available in dashboard)" : nil)
            let screenshotLine = screenshot != nil ? "\n- **Screenshot URL**: \(screenshot!)" : ""
            let attachment = item.signedAttachmentUrl ?? "(No attachment)"
            let screen = env.screenName.map { "[\($0)] " } ?? ""
            let titleSnippet = item.text.isEmpty ? "Issue report" : (item.text.count > 60 ? String(item.text.prefix(57)) + "…" : item.text)

            var customPromptPart = ""
            if let custom = item.editedPrompt, !custom.isEmpty {
                customPromptPart = "\n- **Custom Prompt / Developer Notes**:\n```markdown\n\(custom)\n```"
            }

            var productsPart = ""
            if !item.products.isEmpty {
                let lines = item.products.map { p in
                    let desc = p.description.isEmpty ? "" : ": \(p.description)"
                    let name = p.name.isEmpty ? p.key : p.name
                    return "  - **\(name)** (`\(p.key)`)\(desc)"
                }.joined(separator: "\n")
                productsPart = "\n- **Affected Products**:\n\(lines)"
            }

            var webPart = ""
            if env.isWeb {
                webPart = "\n  - Page URL: \(env.pageUrl ?? "—")\n  - Browser: \(browserLabel(env))"
                if !item.logs.isEmpty {
                    webPart += "\n- **Console & network log**:\n\(formatConsoleLogs(item.logs))"
                }
            }

            let descQuoted = item.text.isEmpty ? "*(No description provided)*" : item.text.split(separator: "\n").map { "> \($0)" }.joined(separator: "\n")

            let section = """
            ### Issue \(idx + 1): \(screen)\(titleSnippet)
            - **Report ID**: `\(item.id)`
            - **Screen**: \(env.screenName ?? "(unknown)")
            - **Status**: \(item.status.rawValue)\(productsPart)
            - **User Description**:
            \(descQuoted)
            - **Environment**:
              - OS: \(env.osName) \(env.osVersion)
              - Device: \(env.deviceModel)
              - App Version: \(env.appVersion) (\(env.appBuild))
              - Locale: \(env.locale)\(webPart)\(screenshotLine)
            - **Attachment**: \(attachment)\(customPromptPart)
            """
            detailSections.append(section)
        }

        let instructions = """
        ## Coordinated Implementation Guidelines
        1. **Analyze Shared Dependencies**: Review all \(items.count) issues above before modifying code. Identify any shared files, view models, database models, or theme variables.
        2. **Coordinated Multi-Issue Fixes**: Implement the fixes cohesively so that resolving one issue does not cause conflicts, duplication, or regressions in another.
        3. **Architecture & Styling Conventions**: Maintain existing project idioms and code style across Swift/SwiftUI/UIKit/AppKit.
        4. **Verification**: Verify each modified screen or workflow and ensure all test suites pass.
        """

        return """
        \(header)

        ## Summary of Issues (\(items.count) total)
        \(summaryLines.joined(separator: "\n"))

        ---

        ## Issue Details

        \(detailSections.joined(separator: "\n\n---\n\n"))

        ---

        \(instructions)
        """
    }
}
