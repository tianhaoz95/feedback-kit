/// In-app feedback for Flutter: capture a screenshot, annotate it, describe
/// the problem, get a structured report. A thin bridge over the native
/// FeedbackKit SDKs — the capture, the annotation editor and the transport
/// are the iOS (Swift) and Android (Kotlin) SDKs themselves, so reports from
/// a Flutter app are byte-for-byte the same contract as from a native one.
library;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import 'src/models.dart';

export 'src/models.dart';

/// FeedbackKit's entry point.
///
/// ```dart
/// // Optional, for the hosted dashboard:
/// await FeedbackKit.configure(const FeedbackKitConfiguration(
///   endpointUrl: 'https://<project>.supabase.co/functions/v1/ingest-feedback',
///   projectKey: 'pk_live_...',
/// ));
///
/// // Triggers:
/// await FeedbackKit.showFloatingTriggerButton();
/// await FeedbackKit.enableShakeToReport();
/// // or from your own button:
/// final report = await FeedbackKit.present();
///
/// // Keep reports labelled with the current screen:
/// MaterialApp(navigatorObservers: [FeedbackKitNavigatorObserver()]);
/// ```
class FeedbackKit {
  FeedbackKit._();

  static const MethodChannel _channel = MethodChannel('feedbackkit');
  static bool _handlerInstalled = false;
  static void Function(FeedbackSubmissionResult result)? _onSubmissionResult;

  /// Called whenever a submission to the hosted dashboard finishes — including
  /// ones started natively by the floating button or a shake.
  static set onSubmissionResult(void Function(FeedbackSubmissionResult result)? callback) {
    _onSubmissionResult = callback;
    _installHandler();
  }

  static void _installHandler() {
    if (_handlerInstalled) return;
    _handlerInstalled = true;
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onSubmissionResult' && call.arguments is Map) {
        _onSubmissionResult?.call(FeedbackSubmissionResult.fromMap(call.arguments as Map<Object?, Object?>));
      }
      return null;
    });
  }

  /// Configures the hosted-dashboard submission path. Pass null to return to
  /// local-only delivery.
  static Future<void> configure(FeedbackKitConfiguration? configuration) =>
      _channel.invokeMethod('configure', configuration?.toMap());

  /// Whether [configure] has been called with a configuration.
  static Future<bool> get isConfigured async => await _channel.invokeMethod<bool>('isConfigured') ?? false;

  /// Labels reports with the screen the user is on. [FeedbackKitNavigatorObserver]
  /// sets this from route names automatically.
  static Future<void> setCurrentScreen(String? name) => _channel.invokeMethod('setCurrentScreen', name);

  /// Brands the feedback screen; null restores the default blue.
  static Future<void> setTheme(FeedbackTheme? theme) => _channel.invokeMethod('setTheme', theme?.toMap());

  /// Attaches the person using the app to every report they submit.
  static Future<void> setUser(FeedbackUser? user) => _channel.invokeMethod('setUser', user?.toMap());

  /// Sets the default product for reports from this app.
  static Future<void> setDefaultProductKey(String? key) => _channel.invokeMethod('setDefaultProductKey', key);

  /// The anonymous per-install id fix updates are matched by.
  static Future<String> get reporterId async => await _channel.invokeMethod<String>('getReporterId') ?? '';

  /// Captures the screen and presents the native annotate → describe flow.
  /// Returns the report, or null if the user cancelled. Delivery is up to you.
  static Future<FeedbackReport?> present() async {
    final map = await _channel.invokeMethod<Map<Object?, Object?>>('present');
    return map == null ? null : FeedbackReport.fromMap(map);
  }

  /// Presents the flow and submits the report to the hosted dashboard.
  /// Null if the user cancelled; a failure if FeedbackKit isn't configured.
  static Future<FeedbackSubmissionResult?> presentAndSubmit() async {
    final map = await _channel.invokeMethod<Map<Object?, Object?>>('presentAndSubmit');
    return map == null ? null : FeedbackSubmissionResult.fromMap(map);
  }

  /// Submits if configured, otherwise returns the report locally as a success.
  static Future<FeedbackSubmissionResult?> presentAndSubmitIfConfigured() async {
    final map = await _channel.invokeMethod<Map<Object?, Object?>>('presentAndSubmitIfConfigured');
    return map == null ? null : FeedbackSubmissionResult.fromMap(map);
  }

  /// Shows the native floating, draggable "report feedback" button.
  static Future<void> showFloatingTriggerButton() => _channel.invokeMethod('showFloatingTriggerButton');

  static Future<void> hideFloatingTriggerButton() => _channel.invokeMethod('hideFloatingTriggerButton');

  /// Shaking the device opens the feedback flow (and submits, if configured).
  static Future<void> enableShakeToReport() => _channel.invokeMethod('enableShakeToReport');

  static Future<void> disableShakeToReport() => _channel.invokeMethod('disableShakeToReport');

  /// When a fix for one of this device's reports ships in the running build,
  /// asks the reporter "is it fixed?" (and shows questions from the
  /// developer). Requires [configure].
  static Future<void> enableFixVerification() => _channel.invokeMethod('enableFixVerification');

  static Future<void> disableFixVerification() => _channel.invokeMethod('disableFixVerification');

  /// Checks for fix updates now, ignoring the once-a-minute throttle.
  static Future<void> presentFixUpdatesIfNeeded() => _channel.invokeMethod('presentFixUpdatesIfNeeded');
}

/// Keeps [FeedbackKit.setCurrentScreen] in sync with the navigator, so every
/// report says which route it came from. Uses `RouteSettings.name`, so name
/// your routes (or pass `settings: RouteSettings(name: ...)`).
class FeedbackKitNavigatorObserver extends NavigatorObserver {
  void _update(Route<dynamic>? route) {
    final name = route?.settings.name;
    if (name != null && route is PageRoute) FeedbackKit.setCurrentScreen(name);
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _update(route);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _update(previousRoute);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _update(newRoute);

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) => _update(previousRoute);
}
