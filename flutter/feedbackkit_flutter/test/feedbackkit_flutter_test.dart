import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('feedbackkit');
  final calls = <MethodCall>[];

  // The shape FeedbackKitBridge produces on both native platforms.
  final reportMap = <Object?, Object?>{
    'id': 'E6C0A31A-745B-4234-9A20-F037EAF8E5A0',
    'createdAt': '2026-10-03T05:40:37Z',
    'text': 'Headphones card looks off',
    'screenshotRawPng': Uint8List.fromList([1, 2, 3]),
    'screenshotAnnotatedPng': Uint8List.fromList([4, 5]),
    'annotations': [
      {
        'kind': 'rectangle',
        'points': [
          [0.05, 0.27],
          [0.87, 0.35],
        ],
        'colorHex': '#FF3B30',
        'scale': 1,
        'rotation': 0,
      },
    ],
    'environment': {
      'osName': 'Android',
      'osVersion': '15',
      'deviceModel': 'Google Pixel 8',
      'appVersion': '1.0',
      'appBuild': '1',
      'bundleIdentifier': 'com.example',
      'screenName': 'Home',
      'locale': 'en_US',
      'screenWidthPoints': 411.4,
      'screenHeightPoints': 914.3,
      'screenScale': 2.625,
    },
    'products': [
      {'key': 'android', 'name': 'Android App', 'description': '', 'isDefault': true},
    ],
    'notifyReporter': true,
  };

  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      switch (call.method) {
        case 'present':
          return reportMap;
        case 'presentAndSubmit':
          return {'status': 'failure', 'error': 'FeedbackKit is not configured with an API key and endpoint.'};
        case 'presentAndSubmitIfConfigured':
          return {'status': 'success', 'report': reportMap};
        case 'isConfigured':
          return true;
      }
      return null;
    });
  });

  test('configure sends the configuration map', () async {
    await FeedbackKit.configure(const FeedbackKitConfiguration(
      endpointUrl: 'https://x.supabase.co/functions/v1/ingest-feedback',
      projectKey: 'pk_test',
      products: [FeedbackProduct(key: 'flutter', name: 'Flutter App', isDefault: true)],
      defaultProductKey: 'flutter',
    ));
    final args = calls.single.arguments as Map;
    expect(calls.single.method, 'configure');
    expect(args['projectKey'], 'pk_test');
    expect((args['products'] as List).single['isDefault'], true);
    expect(args['defaultProductKey'], 'flutter');

    await FeedbackKit.configure(null);
    expect(calls.last.arguments, isNull);
  });

  test('present decodes the native report', () async {
    final report = await FeedbackKit.present();
    expect(report, isNotNull);
    expect(report!.text, 'Headphones card looks off');
    expect(report.createdAt, DateTime.utc(2026, 10, 3, 5, 40, 37));
    expect(report.screenshotRawPng, [1, 2, 3]);
    expect(report.annotations.single.kind, FeedbackAnnotationKind.rectangle);
    expect(report.annotations.single.points[1], [0.87, 0.35]);
    expect(report.environment.osName, 'Android');
    expect(report.environment.screenScale, 2.625);
    expect(report.products.single.isDefault, isTrue);
    expect(report.notifyReporter, isTrue);
  });

  test('submission results', () async {
    final failure = await FeedbackKit.presentAndSubmit();
    expect(failure, isA<FeedbackSubmissionFailure>());
    final success = await FeedbackKit.presentAndSubmitIfConfigured();
    expect((success as FeedbackSubmissionSuccess).report.id, 'E6C0A31A-745B-4234-9A20-F037EAF8E5A0');
    expect(await FeedbackKit.isConfigured, isTrue);
  });

  test('theme and screen', () async {
    await FeedbackKit.setTheme(const FeedbackTheme(primaryColorHex: '#7C3AED', secondaryColorHex: '#F97316'));
    await FeedbackKit.setCurrentScreen('Checkout');
    expect(calls[0].arguments, {'primaryColorHex': '#7C3AED', 'secondaryColorHex': '#F97316'});
    expect(calls[1].arguments, 'Checkout');
  });
}
