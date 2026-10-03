import { Alert, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { FeedbackKit } from 'feedbackkit-react-native';
import { CartStore, formatPrice, useCart } from './store';
import { palette } from './theme';

export function CartScreen() {
  const items = useCart();
  const colors = palette(useColorScheme() === 'dark');
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Cart</Text>
        <Pressable
          accessibilityLabel="About this screen"
          onPress={() =>
            Alert.alert(
              'About this screen',
              "Every screen here is drawn by React Native. FeedbackKit's native SDK captures the whole window, so reporting works exactly like in a native app."
            )
          }
        >
          <Text style={[styles.info, { color: colors.primary }]}>ⓘ</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.name}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.secondaryText }]}>
            Your cart is empty.{'\n'}Add something from Home to see it here.
          </Text>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.row, { backgroundColor: colors.card }]}>
            <View style={[styles.swatch, { backgroundColor: item.tint }]} />
            <View style={styles.rowBody}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
              <Text style={{ color: colors.secondaryText }}>
                Qty {item.quantity} × {formatPrice(item.price)}
              </Text>
            </View>
            <Pressable accessibilityLabel={`Remove ${item.name}`} onPress={() => CartStore.remove(index)}>
              <Text style={styles.remove}>🗑</Text>
            </Pressable>
          </View>
        )}
      />
      <View style={styles.footer}>
        <Text style={[styles.subtotal, { color: colors.text }]}>Subtotal: {formatPrice(subtotal)}</Text>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => FeedbackKit.presentAndSubmitIfConfigured()}
        >
          <Text style={styles.buttonText}>Report a Problem</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 34, fontWeight: '800' },
  info: { fontSize: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  swatch: { width: 40, height: 40, borderRadius: 8 },
  rowBody: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 17 },
  remove: { fontSize: 20, padding: 8 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  empty: { textAlign: 'center', marginTop: 80, fontSize: 16, lineHeight: 22 },
  footer: { padding: 16, gap: 12 },
  subtotal: { fontSize: 18, fontWeight: '700' },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
