import 'dart:typed_data';

/// Configuration for the optional built-in submission path to the hosted
/// FeedbackKit dashboard. Mirrors `FeedbackKitConfiguration` in the native SDKs.
class FeedbackKitConfiguration {
  const FeedbackKitConfiguration({
    required this.endpointUrl,
    required this.projectKey,
    this.products = const [],
    this.defaultProductKey,
    this.reporterUpdatesUrl,
  });

  /// e.g. `https://<project>.supabase.co/functions/v1/ingest-feedback`.
  final String endpointUrl;

  /// The project key from the dashboard — a routing key, safe to ship in the app.
  final String projectKey;

  /// Products of this project. Empty fetches them from the backend.
  final List<FeedbackProduct> products;

  /// The default product for this app target (e.g. `"flutter"`).
  final String? defaultProductKey;

  /// Where fix updates come from; null derives it from [endpointUrl].
  final String? reporterUpdatesUrl;

  Map<String, Object?> toMap() => {
        'endpointUrl': endpointUrl,
        'projectKey': projectKey,
        'products': products.map((p) => p.toMap()).toList(),
        'defaultProductKey': defaultProductKey,
        'reporterUpdatesUrl': reporterUpdatesUrl,
      };
}

/// A product or surface of a project (e.g. "iOS App", "Backend API").
class FeedbackProduct {
  const FeedbackProduct({
    required this.key,
    required this.name,
    this.description = '',
    this.isDefault = false,
  });

  final String key;
  final String name;
  final String description;
  final bool isDefault;

  factory FeedbackProduct.fromMap(Map<Object?, Object?> map) => FeedbackProduct(
        key: map['key'] as String,
        name: map['name'] as String? ?? map['key'] as String,
        description: map['description'] as String? ?? '',
        isDefault: map['isDefault'] as bool? ?? false,
      );

  Map<String, Object?> toMap() => {
        'key': key,
        'name': name,
        'description': description,
        'isDefault': isDefault,
      };
}

/// Brands the native feedback screen with the app's accent colors (hex
/// strings like `"#7C3AED"`). Primary drives the send button and the
/// selected tool; secondary drives Cancel and the attach button.
class FeedbackTheme {
  const FeedbackTheme({required this.primaryColorHex, required this.secondaryColorHex});

  final String primaryColorHex;
  final String secondaryColorHex;

  Map<String, Object?> toMap() => {
        'primaryColorHex': primaryColorHex,
        'secondaryColorHex': secondaryColorHex,
      };
}

/// Optional identity of the person using the app, attached to their reports.
class FeedbackUser {
  const FeedbackUser({this.id, this.email, this.name});

  final String? id;
  final String? email;
  final String? name;

  Map<String, Object?> toMap() => {'id': id, 'email': email, 'name': name};
}

/// The kind of a markup shape.
enum FeedbackAnnotationKind { rectangle, arrow, freehand, text }

/// A markup shape drawn on the screenshot. Points are normalized to 0...1 of
/// the screenshot's width/height.
class FeedbackAnnotation {
  const FeedbackAnnotation({
    required this.kind,
    required this.points,
    required this.colorHex,
    this.label,
    this.scale = 1,
    this.rotation = 0,
  });

  final FeedbackAnnotationKind kind;

  /// Each point is `[x, y]`, normalized to 0...1.
  final List<List<double>> points;
  final String colorHex;

  /// Only set for [FeedbackAnnotationKind.text].
  final String? label;
  final double scale;

  /// Radians, around the shape's center.
  final double rotation;

  factory FeedbackAnnotation.fromMap(Map<Object?, Object?> map) => FeedbackAnnotation(
        kind: FeedbackAnnotationKind.values.firstWhere(
          (k) => k.name == map['kind'],
          orElse: () => FeedbackAnnotationKind.freehand,
        ),
        points: (map['points'] as List? ?? const [])
            .map((p) => (p as List).map((v) => (v as num).toDouble()).toList())
            .toList(),
        colorHex: map['colorHex'] as String? ?? '#FF3B30',
        label: map['label'] as String?,
        scale: (map['scale'] as num?)?.toDouble() ?? 1,
        rotation: (map['rotation'] as num?)?.toDouble() ?? 0,
      );
}

/// A file attached from the composer's attach menu.
class FeedbackAttachment {
  const FeedbackAttachment({required this.filename, required this.mimeType, required this.data});

  final String filename;
  final String mimeType;
  final Uint8List data;

  factory FeedbackAttachment.fromMap(Map<Object?, Object?> map) => FeedbackAttachment(
        filename: map['filename'] as String,
        mimeType: map['mimeType'] as String,
        data: map['data'] as Uint8List,
      );
}

/// The device/app/screen a report was captured on — the native SDK's
/// `FeedbackEnvironment` (osName is "iOS"/"iPadOS" or "Android").
class FeedbackEnvironment {
  const FeedbackEnvironment({
    required this.osName,
    required this.osVersion,
    required this.deviceModel,
    required this.appVersion,
    required this.appBuild,
    required this.bundleIdentifier,
    required this.screenName,
    required this.locale,
    required this.screenWidthPoints,
    required this.screenHeightPoints,
    required this.screenScale,
  });

  final String osName;
  final String osVersion;
  final String deviceModel;
  final String appVersion;
  final String appBuild;
  final String bundleIdentifier;
  final String? screenName;
  final String locale;
  final double screenWidthPoints;
  final double screenHeightPoints;
  final double screenScale;

  factory FeedbackEnvironment.fromMap(Map<Object?, Object?> map) => FeedbackEnvironment(
        osName: map['osName'] as String? ?? '',
        osVersion: map['osVersion'] as String? ?? '',
        deviceModel: map['deviceModel'] as String? ?? '',
        appVersion: map['appVersion'] as String? ?? '',
        appBuild: map['appBuild'] as String? ?? '',
        bundleIdentifier: map['bundleIdentifier'] as String? ?? '',
        screenName: map['screenName'] as String?,
        locale: map['locale'] as String? ?? '',
        screenWidthPoints: (map['screenWidthPoints'] as num?)?.toDouble() ?? 0,
        screenHeightPoints: (map['screenHeightPoints'] as num?)?.toDouble() ?? 0,
        screenScale: (map['screenScale'] as num?)?.toDouble() ?? 1,
      );
}

/// The finished report — the contract. Delivery is up to the app, or use
/// [FeedbackKit.presentAndSubmit] to send it to the hosted dashboard.
class FeedbackReport {
  const FeedbackReport({
    required this.id,
    required this.createdAt,
    required this.text,
    required this.screenshotRawPng,
    required this.screenshotAnnotatedPng,
    required this.annotations,
    required this.environment,
    this.attachment,
    this.products = const [],
    this.notifyReporter = false,
  });

  final String id;
  final DateTime createdAt;
  final String text;

  /// Raw capture, PNG. Null if the reporter turned "Include Screenshot" off.
  final Uint8List? screenshotRawPng;

  /// The capture with annotations burned in, PNG.
  final Uint8List? screenshotAnnotatedPng;
  final List<FeedbackAnnotation> annotations;
  final FeedbackEnvironment environment;
  final FeedbackAttachment? attachment;
  final List<FeedbackProduct> products;

  /// "Notify Me When It's Fixed" from the composer's menu.
  final bool notifyReporter;

  factory FeedbackReport.fromMap(Map<Object?, Object?> map) => FeedbackReport(
        id: map['id'] as String,
        createdAt: DateTime.tryParse(map['createdAt'] as String? ?? '') ?? DateTime.now(),
        text: map['text'] as String? ?? '',
        screenshotRawPng: map['screenshotRawPng'] as Uint8List?,
        screenshotAnnotatedPng: map['screenshotAnnotatedPng'] as Uint8List?,
        annotations: (map['annotations'] as List? ?? const [])
            .map((a) => FeedbackAnnotation.fromMap(a as Map<Object?, Object?>))
            .toList(),
        environment: FeedbackEnvironment.fromMap(map['environment'] as Map<Object?, Object?>? ?? const {}),
        attachment: map['attachment'] == null
            ? null
            : FeedbackAttachment.fromMap(map['attachment'] as Map<Object?, Object?>),
        products: (map['products'] as List? ?? const [])
            .map((p) => FeedbackProduct.fromMap(p as Map<Object?, Object?>))
            .toList(),
        notifyReporter: map['notifyReporter'] as bool? ?? false,
      );

  @override
  String toString() => 'FeedbackReport(id: $id, text: "$text", annotations: ${annotations.length})';
}

/// The outcome of submitting a report to the hosted dashboard.
sealed class FeedbackSubmissionResult {
  const FeedbackSubmissionResult();

  static FeedbackSubmissionResult fromMap(Map<Object?, Object?> map) {
    final report = map['report'] == null ? null : FeedbackReport.fromMap(map['report'] as Map<Object?, Object?>);
    if (map['status'] == 'success' && report != null) return FeedbackSubmissionSuccess(report);
    return FeedbackSubmissionFailure(map['error'] as String? ?? 'Unknown error', report: report);
  }
}

/// The report reached the dashboard (or, when FeedbackKit isn't configured,
/// was captured locally by `presentAndSubmitIfConfigured`).
class FeedbackSubmissionSuccess extends FeedbackSubmissionResult {
  const FeedbackSubmissionSuccess(this.report);
  final FeedbackReport report;
}

/// Submission failed; [message] is the native SDK's description.
class FeedbackSubmissionFailure extends FeedbackSubmissionResult {
  const FeedbackSubmissionFailure(this.message, {this.report});
  final String message;
  final FeedbackReport? report;
}
