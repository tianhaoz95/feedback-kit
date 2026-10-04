import { useEffect, useState } from 'react';
import { Alert, Pressable, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedbackKit } from 'feedbackkit-react-native';
import { HomeScreen } from './HomeScreen';
import { CartScreen } from './CartScreen';
import { SettingsScreen } from './SettingsScreen';
import { useCart } from './store';
import { DemoSettings } from './settings';
import { palette } from './theme';

const TABS = ['Home', 'Cart', 'Settings'] as const;
type Tab = (typeof TABS)[number];

// Configures FeedbackKit (if a key was entered) and the default brand.
DemoSettings.start();

// The same three triggers as the native demos — all native UI.
FeedbackKit.showFloatingTriggerButton();
FeedbackKit.enableShakeToReport();
// Closes the loop: once a fix for something reported from this device ships
// and this build includes it, asks "is it fixed?".
FeedbackKit.enableFixVerification();

// Lets scripts drive the demo from the debugger (simulators can't be tapped
// from the command line), e.g. `FeedbackKit.present()` via Runtime.evaluate.
if (__DEV__) {
  (globalThis as { FeedbackKit?: typeof FeedbackKit }).FeedbackKit = FeedbackKit;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('Home');
  const cart = useCart();
  const dark = useColorScheme() === 'dark';
  const colors = palette(dark);

  // Showcases onSubmissionResult, including reports from the native floating
  // button or a shake.
  useEffect(
    () =>
      FeedbackKit.onSubmissionResult((result) => {
        if (result.status === 'success') {
          Alert.alert(
            'Feedback Submitted',
            `Your feedback was sent to your web dashboard project (ID: ${result.report.id.slice(0, 8)}).`
          );
        } else {
          Alert.alert('Submission Failed', `${result.error}\n\nPlease verify your API key in Settings.`);
        }
      }),
    []
  );

  // Label reports with the visible tab (apps using React Navigation can call
  // setCurrentScreen from the navigation container's onStateChange instead).
  useEffect(() => FeedbackKit.setCurrentScreen(tab), [tab]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        {tab === 'Home' && <HomeScreen />}
        {tab === 'Cart' && <CartScreen />}
        {tab === 'Settings' && <SettingsScreen />}
      </View>
      <SafeAreaView edges={['bottom']} style={[styles.tabBar, { backgroundColor: colors.card, borderTopColor: colors.separator }]}>
        <View style={styles.tabRow}>
          {TABS.map((name) => (
            <Pressable key={name} style={styles.tab} onPress={() => setTab(name)} accessibilityRole="tab">
              <Text style={[styles.tabIcon, { opacity: tab === name ? 1 : 0.5 }]}>
                {name === 'Home' ? '🏠' : name === 'Cart' ? '🛒' : '⚙️'}
                {name === 'Cart' && cart.length > 0 ? ` ${cart.length}` : ''}
              </Text>
              <Text style={[styles.tabLabel, { color: tab === name ? colors.primary : colors.secondaryText }]}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabRow: { flexDirection: 'row', paddingTop: 8, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
});
