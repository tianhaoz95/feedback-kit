import FeedbackKit
import Flutter
import UIKit

/// Bridges `package:feedbackkit_flutter` to the native FeedbackKit Swift SDK.
/// Every call maps 1:1 onto `FeedbackKit`; reports cross the channel as plain
/// dictionaries (see `FeedbackKitBridge`), with PNGs as typed data (Uint8List in Dart).
public class FeedbackKitFlutterPlugin: NSObject, FlutterPlugin {
    private let channel: FlutterMethodChannel

    init(channel: FlutterMethodChannel) {
        self.channel = channel
    }

    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(name: "feedbackkit", binaryMessenger: registrar.messenger())
        let instance = FeedbackKitFlutterPlugin(channel: channel)
        registrar.addMethodCallDelegate(instance, channel: channel)
        // Submissions started natively (floating button, shake) reach Dart too.
        FeedbackKit.onSubmissionResult = { [weak channel] result in
            channel?.invokeMethod("onSubmissionResult", arguments: FeedbackKitBridge.dictionary(from: result, encodeData: typedData))
        }
    }

    private static func typedData(_ data: Data) -> Any {
        FlutterStandardTypedData(bytes: data)
    }

    private var presenter: UIViewController? { FeedbackKitBridge.topViewController }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        let arguments = call.arguments as? [String: Any]
        switch call.method {
        case "configure":
            FeedbackKit.configure(FeedbackKitBridge.configuration(from: arguments))
            result(nil)
        case "isConfigured":
            result(FeedbackKit.isConfigured)
        case "setCurrentScreen":
            FeedbackKit.currentScreen = call.arguments as? String
            result(nil)
        case "setTheme":
            FeedbackKit.theme = FeedbackKitBridge.theme(from: arguments)
            result(nil)
        case "setUser":
            FeedbackKit.user = FeedbackKitBridge.user(from: arguments)
            result(nil)
        case "setDefaultProductKey":
            FeedbackKit.defaultProductKey = call.arguments as? String
            result(nil)
        case "getReporterId":
            result(FeedbackKit.reporterID)
        case "present":
            guard let presenter else { return result(nil) }
            FeedbackKit.present(from: presenter) { report in
                result(report.map { FeedbackKitBridge.dictionary(from: $0, encodeData: Self.typedData) })
            }
        case "presentAndSubmit":
            // Not FeedbackKit.presentAndSubmit: that never calls back on
            // cancel, and the Dart future needs an answer either way.
            guard let presenter else { return result(nil) }
            FeedbackKit.present(from: presenter) { report in
                guard let report else { return result(nil) }
                guard let configuration = FeedbackKit.currentConfiguration else {
                    return result(FeedbackKitBridge.dictionary(from: .failure(.notConfigured), encodeData: Self.typedData))
                }
                FeedbackSubmitter.submit(report, configuration: configuration) { submission in
                    let outcome = submission.map { report }
                    DispatchQueue.main.async {
                        FeedbackKit.onSubmissionResult?(outcome)
                        result(FeedbackKitBridge.dictionary(from: outcome, encodeData: Self.typedData))
                    }
                }
            }
        case "presentAndSubmitIfConfigured":
            guard let presenter else { return result(nil) }
            if FeedbackKit.isConfigured {
                handle(FlutterMethodCall(methodName: "presentAndSubmit", arguments: nil), result: result)
            } else {
                FeedbackKit.present(from: presenter) { report in
                    result(report.map { FeedbackKitBridge.dictionary(from: .success($0), encodeData: Self.typedData) })
                }
            }
        case "showFloatingTriggerButton":
            FeedbackKit.showFloatingTriggerButton { FeedbackKitBridge.topViewController }
            result(nil)
        case "hideFloatingTriggerButton":
            FeedbackKit.hideFloatingTriggerButton()
            result(nil)
        case "enableShakeToReport":
            FeedbackKit.enableShakeToReport { FeedbackKitBridge.topViewController }
            result(nil)
        case "disableShakeToReport":
            FeedbackKit.disableShakeToReport()
            result(nil)
        case "enableFixVerification":
            FeedbackKit.enableFixVerification { FeedbackKitBridge.topViewController }
            result(nil)
        case "disableFixVerification":
            FeedbackKit.disableFixVerification()
            result(nil)
        case "presentFixUpdatesIfNeeded":
            FeedbackKit.presentFixUpdatesIfNeeded()
            result(nil)
        default:
            result(FlutterMethodNotImplemented)
        }
    }
}
