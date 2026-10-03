import FeedbackKit
import Foundation
import UIKit

/// The Swift half of the React Native module: plain Objective-C-friendly
/// calls onto the FeedbackKit SDK, so `FeedbackKitModule.mm` (the TurboModule,
/// which has to be Objective-C++) never touches Swift-only types. Reports
/// cross as dictionaries (see `FeedbackKitBridge`) with binary fields base64.
@objc(FeedbackKitRNBridge)
public final class FeedbackKitRNBridge: NSObject {
    /// Set by the module to emit `onSubmissionResult` to JS.
    @objc public static var onSubmissionResult: ((NSDictionary) -> Void)? {
        didSet {
            FeedbackKit.onSubmissionResult = onSubmissionResult.map { emit in
                { result in emit(FeedbackKitBridge.dictionary(from: result, encodeData: base64) as NSDictionary) }
            }
        }
    }

    private static func base64(_ data: Data) -> Any { data.base64EncodedString() }

    private static func onMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread { block() } else { DispatchQueue.main.async(execute: block) }
    }

    private static func dictionary(_ value: NSDictionary?) -> [String: Any]? {
        value as? [String: Any]
    }

    @objc public static func configure(_ configuration: NSDictionary?) {
        onMain { FeedbackKit.configure(FeedbackKitBridge.configuration(from: dictionary(configuration))) }
    }

    @objc public static var isConfigured: Bool { FeedbackKit.isConfigured }

    @objc public static func setCurrentScreen(_ name: String?) {
        onMain { FeedbackKit.currentScreen = name }
    }

    @objc public static func setTheme(_ theme: NSDictionary?) {
        onMain { FeedbackKit.theme = FeedbackKitBridge.theme(from: dictionary(theme)) }
    }

    @objc public static func setUser(_ user: NSDictionary?) {
        onMain { FeedbackKit.user = FeedbackKitBridge.user(from: dictionary(user)) }
    }

    @objc public static func setDefaultProductKey(_ key: String?) {
        onMain { FeedbackKit.defaultProductKey = key }
    }

    @objc public static var reporterID: String { FeedbackKit.reporterID }

    @objc public static func present(_ completion: @escaping (NSDictionary?) -> Void) {
        onMain {
            guard let presenter = FeedbackKitBridge.topViewController else { return completion(nil) }
            FeedbackKit.present(from: presenter) { report in
                completion(report.map { FeedbackKitBridge.dictionary(from: $0, encodeData: base64) as NSDictionary })
            }
        }
    }

    /// Not `FeedbackKit.presentAndSubmit`: that never calls back on cancel,
    /// and the JS promise needs an answer either way.
    @objc public static func presentAndSubmit(_ completion: @escaping (NSDictionary?) -> Void) {
        onMain {
            guard let presenter = FeedbackKitBridge.topViewController else { return completion(nil) }
            FeedbackKit.present(from: presenter) { report in
                guard let report else { return completion(nil) }
                guard let configuration = FeedbackKit.currentConfiguration else {
                    return completion(FeedbackKitBridge.dictionary(from: .failure(.notConfigured), encodeData: base64) as NSDictionary)
                }
                FeedbackSubmitter.submit(report, configuration: configuration) { submission in
                    let outcome = submission.map { report }
                    DispatchQueue.main.async {
                        FeedbackKit.onSubmissionResult?(outcome)
                        completion(FeedbackKitBridge.dictionary(from: outcome, encodeData: base64) as NSDictionary)
                    }
                }
            }
        }
    }

    @objc public static func presentAndSubmitIfConfigured(_ completion: @escaping (NSDictionary?) -> Void) {
        if FeedbackKit.isConfigured {
            presentAndSubmit(completion)
            return
        }
        onMain {
            guard let presenter = FeedbackKitBridge.topViewController else { return completion(nil) }
            FeedbackKit.present(from: presenter) { report in
                completion(report.map { FeedbackKitBridge.dictionary(from: .success($0), encodeData: base64) as NSDictionary })
            }
        }
    }

    @objc public static func showFloatingTriggerButton() {
        onMain { FeedbackKit.showFloatingTriggerButton { FeedbackKitBridge.topViewController } }
    }

    @objc public static func hideFloatingTriggerButton() {
        onMain { FeedbackKit.hideFloatingTriggerButton() }
    }

    @objc public static func enableShakeToReport() {
        onMain { FeedbackKit.enableShakeToReport { FeedbackKitBridge.topViewController } }
    }

    @objc public static func disableShakeToReport() {
        onMain { FeedbackKit.disableShakeToReport() }
    }

    @objc public static func enableFixVerification() {
        onMain { FeedbackKit.enableFixVerification { FeedbackKitBridge.topViewController } }
    }

    @objc public static func disableFixVerification() {
        onMain { FeedbackKit.disableFixVerification() }
    }

    @objc public static func presentFixUpdatesIfNeeded() {
        onMain { FeedbackKit.presentFixUpdatesIfNeeded() }
    }
}
