import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { FeedbackKit } from 'feedbackkit-react-native';
import { BRANDINGS, DEFAULT_ENDPOINT, DemoSettings, useDemoSettings } from './settings';
import { palette } from './theme';

/** Same sections as the native demos' Settings. */
export function SettingsScreen() {
  const settings = useDemoSettings();
  const colors = palette(useColorScheme() === 'dark');
  const configured = settings.apiKey.trim().length > 0;
  const input = [styles.input, { color: colors.text, borderColor: colors.separator }];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <Section
        title="Web Portal Connection"
        footer="Paste your Project Key from your FeedbackKit web dashboard (Project Settings → SDK setup). When configured, all reports from shake, floating button, or Report a Problem are submitted straight to your project."
      >
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: configured ? '#34C759' : '#FF9500' }]} />
          <Text style={[styles.bold, { color: colors.text }]}>{configured ? 'Connected to Portal' : 'Local Demo Mode'}</Text>
          <Text style={[styles.flexEnd, { color: colors.secondaryText }]}>{configured ? 'Live Submission' : 'Unconfigured'}</Text>
        </View>
        <TextInput
          style={input}
          placeholder="Project API Key (pk_…)"
          placeholderTextColor={colors.secondaryText}
          autoCapitalize="none"
          autoCorrect={false}
          value={settings.apiKey}
          onChangeText={(apiKey) => DemoSettings.update({ apiKey })}
        />
        <Pressable style={[styles.tonal, { backgroundColor: `${colors.primary}22` }]} onPress={() => FeedbackKit.presentAndSubmitIfConfigured()}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Test Feedback Flow</Text>
        </Pressable>
      </Section>

      <Section
        title="Custom Ingestion Endpoint"
        footer="Defaults to the official FeedbackKit hosted endpoint. Only change this if you run your own local or self-hosted backend."
      >
        <TextInput
          style={input}
          autoCapitalize="none"
          autoCorrect={false}
          value={settings.endpointUrl}
          onChangeText={(endpointUrl) => DemoSettings.update({ endpointUrl })}
        />
        {settings.endpointUrl.trim() !== DEFAULT_ENDPOINT && (
          <Pressable onPress={() => DemoSettings.update({ endpointUrl: DEFAULT_ENDPOINT })}>
            <Text style={{ color: colors.primary }}>Reset to Default Endpoint</Text>
          </Pressable>
        )}
      </Section>

      <Section
        title="Branding"
        footer="FeedbackKit.setTheme customizes the native feedback screen's accent colors. Takes effect immediately, no restart needed."
      >
        {BRANDINGS.map((branding) => (
          <Pressable key={branding.id} style={styles.brandRow} onPress={() => DemoSettings.update({ branding: branding.id })}>
            <Text style={{ color: colors.primary, width: 24 }}>{settings.branding === branding.id ? '◉' : '○'}</Text>
            <Text style={[styles.flex, { color: colors.text }]}>{branding.name}</Text>
            <View style={[styles.swatch, { backgroundColor: branding.theme?.primaryColorHex ?? '#007AFF' }]} />
            <View style={[styles.swatch, { backgroundColor: branding.theme?.secondaryColorHex ?? '#8E8E93' }]} />
          </Pressable>
        ))}
      </Section>

      <Section title="Triggers wired up in this demo">
        <Text style={{ color: colors.text }}>• Shake the device</Text>
        <Text style={{ color: colors.text }}>• Tap the floating blue button</Text>
        <Text style={{ color: colors.text }}>• "Report a Problem" on Home and Cart, or Test Feedback Flow above</Text>
      </Section>

      <Section title="Reporter ID">
        <Text selectable style={{ color: colors.secondaryText }}>{FeedbackKit.reporterId}</Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const colors = palette(useColorScheme() === 'dark');
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.secondaryText }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>{children}</View>
      {footer ? <Text style={[styles.footer, { color: colors.secondaryText }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 34, fontWeight: '800' },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginLeft: 4 },
  card: { borderRadius: 12, padding: 14, gap: 10 },
  footer: { fontSize: 12, marginTop: 6, marginHorizontal: 4, lineHeight: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  bold: { fontWeight: '600' },
  flex: { flex: 1 },
  flexEnd: { marginLeft: 'auto' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  tonal: { borderRadius: 18, paddingVertical: 10, alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
});
