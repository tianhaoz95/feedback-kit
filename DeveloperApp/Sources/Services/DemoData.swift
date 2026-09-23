import Foundation
import CoreGraphics
import FeedbackKit

public enum DemoData {
    public static let sampleProjects: [PortalProject] = [
        PortalProject(
            id: "proj-1",
            organizationId: "org-1",
            name: "FeedbackKit Demo App",
            projectKey: "fk_live_sample_key_001",
            createdAt: Date().addingTimeInterval(-86400 * 30),
            githubRepo: "tianhaoz95/feedback-kit",
            githubInstallationId: 123456,
            feedbackCount: 5,
            unresolvedCount: 3
        ),
        PortalProject(
            id: "proj-2",
            organizationId: "org-1",
            name: "HyperCart iOS",
            projectKey: "fk_live_sample_key_002",
            createdAt: Date().addingTimeInterval(-86400 * 15),
            githubRepo: "my-org/hypercart-ios",
            githubInstallationId: 654321,
            feedbackCount: 3,
            unresolvedCount: 1
        ),
        PortalProject(
            id: "proj-3",
            organizationId: "org-1",
            name: "PodcastPulse",
            projectKey: "fk_live_sample_key_003",
            createdAt: Date().addingTimeInterval(-86400 * 5),
            githubRepo: nil,
            githubInstallationId: nil,
            feedbackCount: 1,
            unresolvedCount: 0
        )
    ]

    public static let samplePromptTemplates: [String: PortalPromptTemplate] = [
        "proj-1": PortalPromptTemplate(
            id: "tpl-1",
            projectId: "proj-1",
            templateText: PromptGenerator.defaultTemplate,
            updatedAt: Date()
        ),
        "proj-2": PortalPromptTemplate(
            id: "tpl-2",
            projectId: "proj-2",
            templateText: """
            You are fixing a high-priority bug in the HyperCart mobile app.
            
            Report: {{feedback_text}}
            Screen: {{screen_name}}
            Device: {{device_model}} ({{os_name}} {{os_version}})
            Screenshot: {{screenshot_url}}
            
            Please provide a minimal diff resolving this issue.
            """,
            updatedAt: Date()
        )
    ]

    public static let sampleFeedbackItems: [PortalFeedbackItem] = [
        PortalFeedbackItem(
            id: "fb-101",
            projectId: "proj-1",
            text: "The 'Add to Cart' button is unresponsive after tapping multiple times in quick succession. Seems like a debounce or race condition.",
            screenshotRawPath: "proj-1/fb-101/raw.png",
            screenshotAnnotatedPath: "proj-1/fb-101/annotated.png",
            annotations: [
                FeedbackAnnotation(
                    kind: .rectangle,
                    points: [CGPoint(x: 0.15, y: 0.78), CGPoint(x: 0.85, y: 0.86)],
                    colorHex: "#FF3B30",
                    scale: 1.0,
                    rotation: 0.0
                ),
                FeedbackAnnotation(
                    kind: .arrow,
                    points: [CGPoint(x: 0.50, y: 0.65), CGPoint(x: 0.50, y: 0.77)],
                    colorHex: "#FF3B30",
                    scale: 1.0,
                    rotation: 0.0
                ),
                FeedbackAnnotation(
                    kind: .text,
                    points: [CGPoint(x: 0.50, y: 0.60)],
                    colorHex: "#FF3B30",
                    label: "Button freezes here",
                    scale: 1.0,
                    rotation: 0.0
                )
            ],
            environment: FeedbackEnvironment(
                osName: "iOS",
                osVersion: "18.3",
                deviceModel: "iPhone 16 Pro",
                appVersion: "1.2.0",
                appBuild: "42",
                bundleIdentifier: "com.feedbackkit.demo",
                screenName: "CartView",
                locale: "en_US",
                screenWidthPoints: 393,
                screenHeightPoints: 852,
                screenScale: 3.0
            ),
            status: .new,
            isArchived: false,
            createdAt: Date().addingTimeInterval(-3600 * 2),
            attachmentPath: "proj-1/fb-101/attachment/cart_state.json",
            attachmentFilename: "cart_state.json",
            attachmentMimeType: "application/json",
            githubIssueUrl: nil,
            githubIssueNumber: nil,
            signedScreenshotUrl: "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=800&auto=format&fit=crop",
            signedRawScreenshotUrl: "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=800&auto=format&fit=crop"
        ),
        PortalFeedbackItem(
            id: "fb-102",
            projectId: "proj-1",
            text: "Dark mode contrast is too low on the settings tab subtitle labels. Can barely read them under sunlight.",
            screenshotRawPath: "proj-1/fb-102/raw.png",
            screenshotAnnotatedPath: "proj-1/fb-102/annotated.png",
            annotations: [
                FeedbackAnnotation(
                    kind: .rectangle,
                    points: [CGPoint(x: 0.10, y: 0.32), CGPoint(x: 0.90, y: 0.44)],
                    colorHex: "#FFCC00",
                    scale: 1.0,
                    rotation: 0.0
                ),
                FeedbackAnnotation(
                    kind: .text,
                    points: [CGPoint(x: 0.50, y: 0.28)],
                    colorHex: "#FFCC00",
                    label: "Gray on dark gray",
                    scale: 1.0,
                    rotation: 0.0
                )
            ],
            environment: FeedbackEnvironment(
                osName: "iOS",
                osVersion: "18.2",
                deviceModel: "iPhone 15",
                appVersion: "1.2.0",
                appBuild: "42",
                bundleIdentifier: "com.feedbackkit.demo",
                screenName: "SettingsView",
                locale: "en_US",
                screenWidthPoints: 393,
                screenHeightPoints: 852,
                screenScale: 3.0
            ),
            status: .inProgress,
            isArchived: false,
            editedPrompt: nil,
            createdAt: Date().addingTimeInterval(-3600 * 18),
            attachmentPath: nil,
            attachmentFilename: nil,
            attachmentMimeType: nil,
            githubIssueUrl: "https://github.com/tianhaoz95/feedback-kit/issues/48",
            githubIssueNumber: 48,
            signedScreenshotUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop",
            signedRawScreenshotUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop"
        ),
        PortalFeedbackItem(
            id: "fb-103",
            projectId: "proj-1",
            text: "Occasional crash when switching between tabs while network request is in flight. Stack trace attached.",
            screenshotRawPath: nil,
            screenshotAnnotatedPath: nil,
            annotations: [],
            environment: FeedbackEnvironment(
                osName: "iOS",
                osVersion: "18.0",
                deviceModel: "iPhone 14 Pro",
                appVersion: "1.1.9",
                appBuild: "38",
                bundleIdentifier: "com.feedbackkit.demo",
                screenName: "HomeView",
                locale: "de_DE",
                screenWidthPoints: 393,
                screenHeightPoints: 852,
                screenScale: 3.0
            ),
            status: .resolved,
            isArchived: false,
            createdAt: Date().addingTimeInterval(-86400 * 3),
            attachmentPath: "proj-1/fb-103/attachment/crashlog.txt",
            attachmentFilename: "crashlog.txt",
            attachmentMimeType: "text/plain",
            githubIssueUrl: "https://github.com/tianhaoz95/feedback-kit/issues/39",
            githubIssueNumber: 39
        ),
        PortalFeedbackItem(
            id: "fb-104",
            projectId: "proj-1",
            text: "Request: Add support for Apple Pay on checkout.",
            screenshotRawPath: nil,
            screenshotAnnotatedPath: nil,
            annotations: [],
            environment: FeedbackEnvironment(
                osName: "iOS",
                osVersion: "18.1",
                deviceModel: "iPhone 16",
                appVersion: "1.2.0",
                appBuild: "42",
                bundleIdentifier: "com.feedbackkit.demo",
                screenName: "CheckoutView",
                locale: "en_GB",
                screenWidthPoints: 393,
                screenHeightPoints: 852,
                screenScale: 3.0
            ),
            status: .wontFix,
            isArchived: true,
            createdAt: Date().addingTimeInterval(-86400 * 7),
            attachmentPath: nil,
            attachmentFilename: nil,
            attachmentMimeType: nil,
            githubIssueUrl: nil,
            githubIssueNumber: nil
        ),
        PortalFeedbackItem(
            id: "fb-201",
            projectId: "proj-2",
            text: "Price calculation doesn't round cents properly when applying promo discount code.",
            screenshotRawPath: "proj-2/fb-201/raw.png",
            screenshotAnnotatedPath: "proj-2/fb-201/annotated.png",
            annotations: [
                FeedbackAnnotation(
                    kind: .rectangle,
                    points: [CGPoint(x: 0.60, y: 0.50), CGPoint(x: 0.92, y: 0.58)],
                    colorHex: "#FF9500",
                    scale: 1.0,
                    rotation: 0.0
                )
            ],
            environment: FeedbackEnvironment(
                osName: "iOS",
                osVersion: "18.3",
                deviceModel: "iPhone 15 Pro Max",
                appVersion: "2.0.1",
                appBuild: "105",
                bundleIdentifier: "com.hypercart.app",
                screenName: "CartSummary",
                locale: "en_US",
                screenWidthPoints: 430,
                screenHeightPoints: 932,
                screenScale: 3.0
            ),
            status: .new,
            isArchived: false,
            createdAt: Date().addingTimeInterval(-3600 * 5),
            attachmentPath: nil,
            attachmentFilename: nil,
            attachmentMimeType: nil,
            githubIssueUrl: nil,
            githubIssueNumber: nil,
            signedScreenshotUrl: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&auto=format&fit=crop",
            signedRawScreenshotUrl: "https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=800&auto=format&fit=crop"
        )
    ]

    public static let sampleCliSessions: [PortalCliSession] = [
        PortalCliSession(
            id: "cli-1",
            userId: "user-1",
            sessionId: "sess-abc-123",
            label: "MacBook Pro (arm64) — Cursor AI",
            createdAt: Date().addingTimeInterval(-3600 * 4),
            revokedAt: nil
        ),
        PortalCliSession(
            id: "cli-2",
            userId: "user-1",
            sessionId: "sess-def-456",
            label: "iMac (Intel) — Claude Code",
            createdAt: Date().addingTimeInterval(-86400 * 2),
            revokedAt: nil
        ),
        PortalCliSession(
            id: "cli-3",
            userId: "user-1",
            sessionId: "sess-ghi-789",
            label: "CI Runner — Antigravity Agent",
            createdAt: Date().addingTimeInterval(-86400 * 10),
            revokedAt: Date().addingTimeInterval(-86400 * 5)
        )
    ]
}
