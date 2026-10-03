import 'package:feedbackkit_flutter/feedbackkit_flutter.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'cart_store.dart';

class _Product {
  const _Product(this.name, this.price, this.icon, this.tint);
  final String name;
  final double price;
  final IconData icon;
  final Color tint;
}

// What's available to browse. "Add" feeds CartStore, so it shows up on Cart.
const _catalog = [
  _Product('Wireless Headphones', 59.99, Icons.headphones, Color(0xFF8E44AD)),
  _Product('Canvas Tote Bag', 24.99, Icons.shopping_bag, Color(0xFF2E9E5B)),
  _Product('Classic T-Shirt', 19.99, Icons.checkroom, Color(0xFFF07A1A)),
];

/// The counterpart of the native demos' Home screen — drawn by Flutter, and
/// captured by the native SDK all the same.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  Future<void> _reportProblem() async {
    final result = await FeedbackKit.presentAndSubmitIfConfigured();
    switch (result) {
      case FeedbackSubmissionSuccess(:final report):
        debugPrint('[FeedbackKit demo] captured report ${report.id} — "${report.text}"');
      case FeedbackSubmissionFailure(:final message):
        debugPrint('[FeedbackKit demo] report failed: $message');
      case null:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('FeedbackKit Flutter Demo', style: theme.textTheme.labelLarge?.copyWith(color: theme.colorScheme.primary)),
        const SizedBox(height: 4),
        Text('Welcome back', style: theme.textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(
          'Sample screen for exercising FeedbackKit from Flutter. Shake the device or tap the floating button to report an issue with whatever\'s on screen — the capture and editor are the native iOS/Android SDK.',
          style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        for (final product in _catalog) ...[
          _ProductCard(product: product),
          const SizedBox(height: 12),
        ],
        const SizedBox(height: 8),
        FilledButton.icon(
          onPressed: _reportProblem,
          icon: const Icon(Icons.feedback_outlined),
          label: const Text('Report a Problem'),
        ),
      ],
    );
  }
}

class _ProductCard extends StatefulWidget {
  const _ProductCard({required this.product});
  final _Product product;

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard> {
  bool _justAdded = false;

  Future<void> _add() async {
    final product = widget.product;
    CartStore.instance.add(product.name, product.price, product.tint);
    HapticFeedback.mediumImpact();
    setState(() => _justAdded = true);
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    if (mounted) setState(() => _justAdded = false);
  }

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    final theme = Theme.of(context);
    return Card(
      elevation: 1,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(color: product.tint.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(8)),
              child: Icon(product.icon, color: product.tint),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, style: theme.textTheme.titleMedium),
                  Text(formatPrice(product.price), style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
            OutlinedButton.icon(
              onPressed: _justAdded ? null : _add,
              icon: Icon(_justAdded ? Icons.check : Icons.add, size: 18),
              label: Text(_justAdded ? 'Added' : 'Add'),
              style: OutlinedButton.styleFrom(foregroundColor: product.tint),
            ),
          ],
        ),
      ),
    );
  }
}
