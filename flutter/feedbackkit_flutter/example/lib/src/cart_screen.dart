import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';
import 'package:flutter/material.dart';

import 'cart_store.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListenableBuilder(
      listenable: CartStore.instance,
      builder: (context, _) {
        final items = CartStore.instance.items;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
              child: Row(
                children: [
                  Text('Cart', style: theme.textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.info_outline),
                    tooltip: 'About this screen',
                    onPressed: () => showDialog<void>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('About this screen'),
                        content: const Text(
                          'Every screen here is drawn by Flutter. FeedbackKit\'s native SDK captures the whole window, so reporting works exactly like in a native app.',
                        ),
                        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Got it'))],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: items.isEmpty
                  ? Center(
                      child: Text(
                        'Your cart is empty.\nAdd something from Home to see it here.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: theme.colorScheme.onSurfaceVariant),
                      ),
                    )
                  : ListView.separated(
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final item = items[index];
                        return ListTile(
                          leading: Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(color: item.tint, borderRadius: BorderRadius.circular(8)),
                          ),
                          title: Text(item.name),
                          subtitle: Text('Qty ${item.quantity} × ${formatPrice(item.price)}'),
                          trailing: IconButton(
                            icon: const Icon(Icons.delete_outline),
                            tooltip: 'Remove ${item.name}',
                            onPressed: () => CartStore.instance.removeAt(index),
                          ),
                        );
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Subtotal: ${formatPrice(CartStore.instance.subtotal)}',
                      style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: FeedbackKit.presentAndSubmitIfConfigured,
                    child: const Text('Report a Problem'),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
