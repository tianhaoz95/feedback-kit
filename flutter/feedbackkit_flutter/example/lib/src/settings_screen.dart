import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'demo_settings.dart';

/// Same sections as the native demos' Settings.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final settings = DemoSettings.instance;
  late final _keyController = TextEditingController(text: settings.apiKey);
  late final _endpointController = TextEditingController(text: settings.endpointUrl);
  String _reporterId = '';

  @override
  void initState() {
    super.initState();
    FeedbackKit.reporterId.then((id) => mounted ? setState(() => _reporterId = id) : null);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Settings', style: theme.textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold)),
          _Section(
            title: 'Web Portal Connection',
            footer:
                'Paste your Project Key from your FeedbackKit web dashboard (Project Settings → SDK setup). When configured, all reports from shake, floating button, or Report a Problem are submitted straight to your project.',
            children: [
              Row(children: [
                Icon(Icons.circle, size: 10, color: settings.isConfigured ? Colors.green : Colors.orange),
                const SizedBox(width: 8),
                Text(settings.isConfigured ? 'Connected to Portal' : 'Local Demo Mode',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                const Spacer(),
                Text(settings.isConfigured ? 'Live Submission' : 'Unconfigured',
                    style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
              ]),
              TextField(
                controller: _keyController,
                decoration: const InputDecoration(labelText: 'Project API Key', hintText: 'pk_…', border: OutlineInputBorder()),
                onChanged: settings.setApiKey,
              ),
              Wrap(spacing: 8, runSpacing: 8, children: [
                FilledButton.tonalIcon(
                  icon: const Icon(Icons.content_paste, size: 18),
                  label: const Text('Paste Key'),
                  onPressed: () async {
                    final text = (await Clipboard.getData(Clipboard.kTextPlain))?.text?.trim();
                    if (text == null || text.isEmpty) return;
                    _keyController.text = text;
                    await settings.setApiKey(text);
                  },
                ),
                FilledButton.tonalIcon(
                  icon: const Icon(Icons.send, size: 18),
                  label: const Text('Test Feedback Flow'),
                  onPressed: FeedbackKit.presentAndSubmitIfConfigured,
                ),
              ]),
            ],
          ),
          _Section(
            title: 'Custom Ingestion Endpoint',
            footer:
                'Defaults to the official FeedbackKit hosted endpoint. Only change this if you run your own local or self-hosted backend.',
            children: [
              TextField(
                controller: _endpointController,
                decoration: const InputDecoration(labelText: 'Ingestion Endpoint URL', border: OutlineInputBorder()),
                onChanged: settings.setEndpoint,
              ),
              if (settings.endpointUrl.trim() != DemoSettings.defaultEndpoint)
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () {
                      _endpointController.text = DemoSettings.defaultEndpoint;
                      settings.setEndpoint(DemoSettings.defaultEndpoint);
                    },
                    child: const Text('Reset to Default Endpoint'),
                  ),
                ),
            ],
          ),
          _Section(
            title: 'Branding',
            footer:
                'FeedbackKit.setTheme customizes the native feedback screen\'s accent colors. Takes effect immediately, no restart needed.',
            children: [
              for (final option in DemoBranding.values)
                InkWell(
                  onTap: () => settings.setBranding(option),
                  child: Row(children: [
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Icon(
                        settings.branding == option ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                        color: settings.branding == option ? theme.colorScheme.primary : null,
                      ),
                    ),
                    Expanded(child: Text(option.displayName)),
                    CircleAvatar(radius: 9, backgroundColor: option.primarySwatch),
                    const SizedBox(width: 4),
                    CircleAvatar(radius: 9, backgroundColor: option.secondarySwatch),
                  ]),
                ),
            ],
          ),
          const _Section(
            title: 'Triggers wired up in this demo',
            children: [
              Text('• Shake the device'),
              Text('• Tap the floating blue button'),
              Text('• "Report a Problem" on Home and Cart, or Test Feedback Flow above'),
            ],
          ),
          _Section(
            title: 'Reporter ID',
            children: [SelectableText(_reporterId, style: TextStyle(color: theme.colorScheme.onSurfaceVariant))],
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children, this.footer});
  final String title;
  final String? footer;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title.toUpperCase(), style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 6),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [for (final child in children) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: child)],
              ),
            ),
          ),
          if (footer != null) ...[
            const SizedBox(height: 6),
            Text(footer!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          ],
        ],
      ),
    );
  }
}
