import 'package:flutter/material.dart';

/// Shared cart state, so "Add" on Home shows up on Cart — the same single
/// source of truth the native demos' `CartStore` provides.
class CartStore extends ChangeNotifier {
  CartStore._();
  static final instance = CartStore._();

  final List<CartItem> items = [
    const CartItem('Wireless Headphones', 59.99, 1, Color(0xFF8E44AD)),
    const CartItem('Canvas Tote Bag', 24.99, 2, Color(0xFF2E9E5B)),
    const CartItem('Classic T-Shirt', 19.99, 1, Color(0xFFF07A1A)),
  ];

  double get subtotal => items.fold(0, (sum, item) => sum + item.price * item.quantity);

  /// Adds one of [name], bumping the quantity if it's already in the cart.
  void add(String name, double price, Color tint) {
    final index = items.indexWhere((item) => item.name == name);
    if (index >= 0) {
      final item = items[index];
      items[index] = CartItem(item.name, item.price, item.quantity + 1, item.tint);
    } else {
      items.add(CartItem(name, price, 1, tint));
    }
    notifyListeners();
  }

  void removeAt(int index) {
    items.removeAt(index);
    notifyListeners();
  }
}

class CartItem {
  const CartItem(this.name, this.price, this.quantity, this.tint);
  final String name;
  final double price;
  final int quantity;
  final Color tint;
}

String formatPrice(double value) => '\$${value.toStringAsFixed(2)}';
