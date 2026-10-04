// swift-tools-version: 5.9
import Foundation
import PackageDescription

// The plugin runs the real FeedbackKit Swift SDK. Inside this repo (the demo
// app, CI) it's the package at the repo root; a published copy of the plugin
// gets it from GitHub at the matching release tag.
// Flutter reaches this file through a symlink, so resolve it first.
let repoRoot = URL(fileURLWithPath: #filePath)
    .resolvingSymlinksInPath()
    .deletingLastPathComponent() // ios/feedbackkit_flutter/
    .deletingLastPathComponent() // ios/
    .deletingLastPathComponent() // flutter/feedbackkit_flutter/ (the plugin)
    .deletingLastPathComponent() // flutter/
    .deletingLastPathComponent() // repo root
let useRepoSDK = FileManager.default.fileExists(atPath: repoRoot.appendingPathComponent("Sources/FeedbackKit").path)

let sdkDependency: Package.Dependency = useRepoSDK
    ? .package(path: repoRoot.path)
    : .package(url: "https://github.com/tianhaoz95/feedback-kit.git", exact: "1.0.62")
// A path dependency's identity is its directory name; a URL's is the repo name.
let sdkPackage = useRepoSDK ? repoRoot.lastPathComponent : "feedback-kit"

let package = Package(
    name: "feedbackkit_flutter",
    platforms: [
        .iOS("15.0")
    ],
    products: [
        .library(name: "feedbackkit-flutter", targets: ["feedbackkit_flutter"])
    ],
    dependencies: [
        .package(name: "FlutterFramework", path: "../FlutterFramework"),
        sdkDependency,
    ],
    targets: [
        .target(
            name: "feedbackkit_flutter",
            dependencies: [
                .product(name: "FlutterFramework", package: "FlutterFramework"),
                .product(name: "FeedbackKit", package: sdkPackage),
            ]
        )
    ]
)
