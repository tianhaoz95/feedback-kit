import Foundation
#if os(iOS)
import UIKit
#endif

/// Plain-dictionary conversions for cross-platform wrappers — the Flutter
/// plugin (flutter/) and the React Native module (react-native/) — so both
/// bridge the same shapes without each re-implementing them. Keys are
/// camelCase, matching the Dart/TypeScript models and `FeedbackKitBridge` in
/// the Android SDK; binary fields go through `encodeData` (typed data for
/// Flutter, base64 for React Native).
public enum FeedbackKitBridge {
    public static func dictionary(from report: FeedbackReport, encodeData: (Data) -> Any) -> [String: Any] {
        var result: [String: Any] = [
            "id": report.id.uuidString,
            "createdAt": ISO8601DateFormatter().string(from: report.createdAt),
            "text": report.text,
            "annotations": report.annotations.map { annotation -> [String: Any] in
                var map: [String: Any] = [
                    "kind": annotation.kind.rawValue,
                    "points": annotation.points.map { [Double($0.x), Double($0.y)] },
                    "colorHex": annotation.colorHex,
                    "scale": annotation.scale,
                    "rotation": annotation.rotation,
                ]
                if let label = annotation.label { map["label"] = label }
                return map
            },
            "environment": environmentDictionary(report.environment),
            "products": report.products.map(productDictionary),
            "notifyReporter": report.notifyReporter,
        ]
        if let raw = report.screenshotRawPNG { result["screenshotRawPng"] = encodeData(raw) }
        if let annotated = report.screenshotAnnotatedPNG { result["screenshotAnnotatedPng"] = encodeData(annotated) }
        if let attachment = report.attachment {
            result["attachment"] = [
                "filename": attachment.filename,
                "mimeType": attachment.mimeType,
                "data": encodeData(attachment.data),
            ]
        }
        return result
    }

    /// `["status": "success", "report": …]` or `["status": "failure", "error": …]`.
    public static func dictionary(
        from result: Result<FeedbackReport, FeedbackSubmissionError>,
        encodeData: (Data) -> Any
    ) -> [String: Any] {
        switch result {
        case .success(let report):
            return ["status": "success", "report": dictionary(from: report, encodeData: encodeData)]
        case .failure(let error):
            return ["status": "failure", "error": error.localizedDescription]
        }
    }

    public static func environmentDictionary(_ environment: FeedbackEnvironment) -> [String: Any] {
        var map: [String: Any] = [
            "osName": environment.osName,
            "osVersion": environment.osVersion,
            "deviceModel": environment.deviceModel,
            "appVersion": environment.appVersion,
            "appBuild": environment.appBuild,
            "bundleIdentifier": environment.bundleIdentifier,
            "locale": environment.locale,
            "screenWidthPoints": environment.screenWidthPoints,
            "screenHeightPoints": environment.screenHeightPoints,
            "screenScale": environment.screenScale,
        ]
        if let screenName = environment.screenName { map["screenName"] = screenName }
        return map
    }

    public static func productDictionary(_ product: FeedbackProduct) -> [String: Any] {
        ["key": product.key, "name": product.name, "description": product.description, "isDefault": product.isDefault]
    }

    public static func product(from map: [String: Any]) -> FeedbackProduct? {
        guard let key = map["key"] as? String else { return nil }
        return FeedbackProduct(
            key: key,
            name: map["name"] as? String ?? key,
            description: map["description"] as? String ?? "",
            isDefault: map["isDefault"] as? Bool ?? false
        )
    }

    public static func configuration(from map: [String: Any]?) -> FeedbackKitConfiguration? {
        guard let map,
              let endpoint = (map["endpointUrl"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              let key = (map["projectKey"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
              !key.isEmpty,
              let url = URL(string: endpoint)
        else { return nil }
        return FeedbackKitConfiguration(
            endpointURL: url,
            projectKey: key,
            products: (map["products"] as? [[String: Any]] ?? []).compactMap(product(from:)),
            defaultProductKey: map["defaultProductKey"] as? String,
            reporterUpdatesURL: (map["reporterUpdatesUrl"] as? String).flatMap(URL.init(string:))
        )
    }

    public static func theme(from map: [String: Any]?) -> FeedbackTheme? {
        guard let primary = map?["primaryColorHex"] as? String,
              let secondary = map?["secondaryColorHex"] as? String
        else { return nil }
        return FeedbackTheme(primaryColorHex: primary, secondaryColorHex: secondary)
    }

    public static func user(from map: [String: Any]?) -> FeedbackUser? {
        guard let map else { return nil }
        let user = FeedbackUser(id: map["id"] as? String, email: map["email"] as? String, name: map["name"] as? String)
        return user.id == nil && user.email == nil && user.name == nil ? nil : user
    }

    #if os(iOS)
    /// The view controller to present from: the key window's root, walked up
    /// through anything it's presenting. Wrappers have no view controller of
    /// their own to hand `FeedbackKit.present(from:)`.
    public static var topViewController: UIViewController? {
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
            .flatMap(\.windows)
            .first { $0.isKeyWindow && !($0 is CaptureIndicatorWindow) }
        var top = window?.rootViewController
        while let presented = top?.presentedViewController, !presented.isBeingDismissed {
            top = presented
        }
        return top
    }
    #endif
}
