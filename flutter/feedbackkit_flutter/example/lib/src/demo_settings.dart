import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The brand presets in Settings > Branding — the same as the native demos.
enum DemoBranding {
  system('System Blue', null),
  sunset('Sunset', FeedbackTheme(primaryColorHex: '#7C3AED', secondaryColorHex: '#F97316')),
  ocean('Ocean', FeedbackTheme(primaryColorHex: '#0EA5E9', secondaryColorHex: '#14B8A6')),
  forest('Forest', FeedbackTheme(primaryColorHex: '#16A34A', secondaryColorHex: '#CA8A04'));

  const DemoBranding(this.displayName, this.theme);
  final String displayName;
  final FeedbackTheme? theme;

  Color get primarySwatch => theme == null ? const Color(0xFF007AFF) : _hex(theme!.primaryColorHex);
  Color get secondarySwatch => theme == null ? Colors.grey : _hex(theme!.secondaryColorHex);

  static Color _hex(String hex) => Color(int.parse(hex.substring(1), radix: 16) | 0xFF000000);
}

/// The project key + endpoint entered in Settings (same keys and defaults as
/// the native demos), so you can send real reports to your dashboard.
class DemoSettings extends ChangeNotifier {
  DemoSettings._();
  static final instance = DemoSettings._();

  static const defaultEndpoint = 'https://gpucoladcyvijefdjudf.supabase.co/functions/v1/ingest-feedback';
  static const _apiKeyKey = 'com.feedbackkit.demo.apiKey';
  static const _endpointKey = 'com.feedbackkit.demo.endpointURL';
  static const _brandingKey = 'com.feedbackkit.demo.branding';

  late SharedPreferences _prefs;
  String apiKey = '';
  String endpointUrl = defaultEndpoint;
  DemoBranding branding = DemoBranding.sunset;

  bool get isConfigured => apiKey.trim().isNotEmpty;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    apiKey = _prefs.getString(_apiKeyKey) ?? '';
    endpointUrl = _prefs.getString(_endpointKey) ?? defaultEndpoint;
    branding = DemoBranding.values.asNameMap()[_prefs.getString(_brandingKey)] ?? DemoBranding.sunset;
    await FeedbackKit.setTheme(branding.theme);
    await _apply();
  }

  Future<void> setApiKey(String value) async {
    apiKey = value;
    await _prefs.setString(_apiKeyKey, value);
    await _apply();
  }

  Future<void> setEndpoint(String value) async {
    endpointUrl = value;
    await _prefs.setString(_endpointKey, value);
    await _apply();
  }

  /// Showcases FeedbackKit.setTheme — takes effect on the next report, no restart.
  Future<void> setBranding(DemoBranding value) async {
    branding = value;
    await _prefs.setString(_brandingKey, value.name);
    await FeedbackKit.setTheme(value.theme);
    notifyListeners();
  }

  Future<void> _apply() async {
    final key = apiKey.trim();
    final endpoint = endpointUrl.trim().isEmpty ? defaultEndpoint : endpointUrl.trim();
    await FeedbackKit.configure(
      key.isEmpty ? null : FeedbackKitConfiguration(endpointUrl: endpoint, projectKey: key),
    );
    notifyListeners();
  }
}
