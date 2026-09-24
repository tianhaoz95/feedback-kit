import Foundation
import FeedbackKit

public enum PromptGenerator {
    public static let placeholders: [String] = [
        "feedback_text",
        "screen_name",
        "os_name",
        "os_version",
        "device_model",
        "app_version",
        "app_build",
        "locale",
        "screenshot_url",
        "attachment_url"
    ]

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
            "attachment_url": attachmentUrl ?? "(no attachment)"
        ]

        var rendered = template.isEmpty ? defaultTemplate : template

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

            let descQuoted = item.text.isEmpty ? "*(No description provided)*" : item.text.split(separator: "\n").map { "> \($0)" }.joined(separator: "\n")

            let section = """
            ### Issue \(idx + 1): \(screen)\(titleSnippet)
            - **Report ID**: `\(item.id)`
            - **Screen**: \(env.screenName ?? "(unknown)")
            - **Status**: \(item.status.rawValue)
            - **User Description**:
            \(descQuoted)
            - **Environment**:
              - OS: \(env.osName) \(env.osVersion)
              - Device: \(env.deviceModel)
              - App Version: \(env.appVersion) (\(env.appBuild))
              - Locale: \(env.locale)\(screenshotLine)
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
