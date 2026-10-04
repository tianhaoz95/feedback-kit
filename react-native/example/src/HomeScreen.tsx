import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, Vibration, View, useColorScheme } from 'react-native';
import { FeedbackKit } from 'feedbackkit-react-native';
import { CartStore, formatPrice } from './store';
import { palette } from './theme';

// What's available to browse. "Add" feeds CartStore, so it shows up on Cart.
const CATALOG = [
  { name: 'Wireless Headphones', price: 59.99, icon: '🎧', tint: '#8E44AD' },
  { name: 'Canvas Tote Bag', price: 24.99, icon: '👜', tint: '#2E9E5B' },
  { name: 'Classic T-Shirt', price: 19.99, icon: '👕', tint: '#F07A1A' },
];

async function reportProblem() {
  const result = await FeedbackKit.presentAndSubmitIfConfigured();
  if (result?.status === 'success') {
    console.log(`[FeedbackKit demo] captured report ${result.report.id} — "${result.report.text}"`);
  } else if (result) {
    console.warn(`[FeedbackKit demo] report failed: ${result.error}`);
  }
}

/** The counterpart of the native demos' Home screen, drawn by React Native. */
export function HomeScreen() {
  const colors = palette(useColorScheme() === 'dark');
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>FeedbackKit React Native Demo</Text>
      <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
      <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
        Sample screen for exercising FeedbackKit from React Native. Shake the device or tap the floating button to
        report an issue with whatever's on screen — the capture and editor are the native iOS/Android SDK.
      </Text>
      {CATALOG.map((product) => (
        <ProductCard key={product.name} product={product} />
      ))}
      <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={reportProblem}>
        <Text style={styles.primaryButtonText}>Report a Problem</Text>
      </Pressable>
    </ScrollView>
  );
}

function ProductCard({ product }: { product: (typeof CATALOG)[number] }) {
  const colors = palette(useColorScheme() === 'dark');
  const [justAdded, setJustAdded] = useState(false);
  const add = () => {
    CartStore.add(product.name, product.price, product.tint);
    Vibration.vibrate(10);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.icon, { backgroundColor: `${product.tint}26` }]}>
        <Text style={styles.iconText}>{product.icon}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{product.name}</Text>
        <Text style={{ color: colors.secondaryText }}>{formatPrice(product.price)}</Text>
      </View>
      <Pressable
        disabled={justAdded}
        onPress={add}
        style={[styles.addButton, { borderColor: justAdded ? '#2E9E5B' : product.tint }]}
      >
        <Text style={{ color: justAdded ? '#2E9E5B' : product.tint, fontWeight: '600' }}>{justAdded ? '✓ Added' : '+ Add'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  eyebrow: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 34, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 21, marginBottom: 4 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  icon: { width: 56, height: 56, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 26 },
  cardBody: { flex: 1, marginHorizontal: 12 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  addButton: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, minWidth: 84, alignItems: 'center' },
  primaryButton: { marginTop: 8, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
