// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "FeedbackKit",
    defaultLocalization: "en",
    platforms: [.iOS(.v15), .macOS(.v12)],
    products: [
        .library(name: "FeedbackKit", targets: ["FeedbackKit"])
    ],
    targets: [
        .target(
            name: "FeedbackKit",
            path: "Sources/FeedbackKit"
        ),
        .testTarget(
            name: "FeedbackKitTests",
            dependencies: ["FeedbackKit"],
            path: "Tests/FeedbackKitTests"
        )
    ]
)
