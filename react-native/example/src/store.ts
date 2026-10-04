import { useSyncExternalStore } from 'react';

export interface CartItem {
  name: string;
  price: number;
  quantity: number;
  tint: string;
}

/**
 * Shared cart state, so "Add" on Home shows up on Cart — the same single
 * source of truth the native demos' `CartStore` provides.
 */
let items: CartItem[] = [
  { name: 'Wireless Headphones', price: 59.99, quantity: 1, tint: '#8E44AD' },
  { name: 'Canvas Tote Bag', price: 24.99, quantity: 2, tint: '#2E9E5B' },
  { name: 'Classic T-Shirt', price: 19.99, quantity: 1, tint: '#F07A1A' },
];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const CartStore = {
  add(name: string, price: number, tint: string) {
    const existing = items.find((item) => item.name === name);
    items = existing
      ? items.map((item) => (item === existing ? { ...item, quantity: item.quantity + 1 } : item))
      : [...items, { name, price, quantity: 1, tint }];
    notify();
  },
  remove(index: number) {
    items = items.filter((_, i) => i !== index);
    notify();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get items() {
    return items;
  },
};

export function useCart(): CartItem[] {
  return useSyncExternalStore(CartStore.subscribe, () => items);
}

export const formatPrice = (value: number) => `$${value.toFixed(2)}`;
