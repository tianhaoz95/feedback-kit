import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';
import 'package:flutter/material.dart';

import 'src/cart_screen.dart';
import 'src/cart_store.dart';
import 'src/demo_settings.dart';
import 'src/home_screen.dart';
import 'src/settings_screen.dart';

final navigatorKey = GlobalKey<NavigatorState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Restores whichever API key and endpoint were saved in Settings,
  // configuring FeedbackKit if a key is present, plus the saved brand
  // (FeedbackKit.setTheme — default: Sunset, this demo's own brand).
  await DemoSettings.instance.load();

  // Showcases onSubmissionResult: tells the user when a report reached their
  // dashboard (including reports from the native floating button or a shake).
  FeedbackKit.onSubmissionResult = (result) {
    final context = navigatorKey.currentContext;
    if (context == null) return;
    final (title, message) = switch (result) {
      FeedbackSubmissionSuccess(:final report) => (
          'Feedback Submitted',
          'Your feedback was sent to your web dashboard project (ID: ${report.id.substring(0, 8)}).',
        ),
      FeedbackSubmissionFailure(:final message) => (
          'Submission Failed',
          '$message\n\nPlease verify your API key in Settings.',
        ),
    };
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
      ),
    );
  };

  // The same three triggers as the native demos — all native UI.
  await FeedbackKit.showFloatingTriggerButton();
  await FeedbackKit.enableShakeToReport();
  // Closes the loop: once a fix for something reported from this device
  // ships and this build includes it, asks "is it fixed?".
  await FeedbackKit.enableFixVerification();

  runApp(const DemoApp());

  // For screenshot automation (scripts, CI): `--dart-define=FEEDBACKKIT_DEMO_AUTOPRESENT=true`
  // opens the feedback flow a few seconds after launch, since simulators
  // can't be tapped from the command line.
  if (const bool.fromEnvironment('FEEDBACKKIT_DEMO_AUTOPRESENT')) {
    Future<void>.delayed(const Duration(seconds: 3), () async {
      final report = await FeedbackKit.present();
      debugPrint('[FeedbackKit demo] autopresent finished: $report');
    });
  }
}

class DemoApp extends StatelessWidget {
  const DemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF7C3AED);
    return MaterialApp(
      title: 'FeedbackKit Flutter Demo',
      navigatorKey: navigatorKey,
      theme: ThemeData(colorSchemeSeed: seed, useMaterial3: true),
      darkTheme: ThemeData(colorSchemeSeed: seed, brightness: Brightness.dark, useMaterial3: true),
      home: const RootTabs(),
    );
  }
}

class RootTabs extends StatefulWidget {
  const RootTabs({super.key});

  @override
  State<RootTabs> createState() => _RootTabsState();
}

class _RootTabsState extends State<RootTabs> {
  static const _titles = ['Home', 'Cart', 'Settings'];
  int _index = 0;

  @override
  void initState() {
    super.initState();
    FeedbackKit.setCurrentScreen(_titles[_index]);
  }

  void _select(int index) {
    setState(() => _index = index);
    // Tabs aren't routes, so label reports with the tab directly. Apps with
    // named routes can use FeedbackKitNavigatorObserver instead.
    FeedbackKit.setCurrentScreen(_titles[index]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: IndexedStack(
          index: _index,
          children: const [HomeScreen(), CartScreen(), SettingsScreen()],
        ),
      ),
      bottomNavigationBar: ListenableBuilder(
        listenable: CartStore.instance,
        builder: (context, _) => NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _select,
          destinations: [
            const NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
            NavigationDestination(
              icon: Badge(
                isLabelVisible: CartStore.instance.items.isNotEmpty,
                label: Text('${CartStore.instance.items.length}'),
                child: const Icon(Icons.shopping_cart_outlined),
              ),
              label: 'Cart',
            ),
            const NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings'),
          ],
        ),
      ),
    );
  }
}
