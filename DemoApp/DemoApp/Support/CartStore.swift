import Combine
import SwiftUI

/// Shared cart state so tapping "Add" on the SwiftUI Home screen actually
/// shows up on the UIKit Cart screen (and vice versa for removals) — a
/// single source of truth both screens observe, rather than each holding
/// its own disconnected fake data. `ObservableObject`/`@Published` works
/// for both consumers: SwiftUI via `@ObservedObject`, UIKit via a plain
/// Combine subscription to `$items`.
final class CartStore: ObservableObject {
    static let shared = CartStore()

    struct Item: Identifiable {
        let name: String
        let price: Double
        var quantity: Int
        let icon: String
        let tint: Color

        var id: String { name }
    }

    @Published private(set) var items: [Item] = [
        Item(name: "Wireless Headphones", price: 59.99, quantity: 1, icon: "headphones", tint: .purple),
        Item(name: "Canvas Tote Bag", price: 24.99, quantity: 2, icon: "bag.fill", tint: .green),
        Item(name: "Classic T-Shirt", price: 19.99, quantity: 1, icon: "tshirt.fill", tint: .orange)
    ]

    var subtotal: Double {
        items.reduce(0) { $0 + $1.price * Double($1.quantity) }
    }

    /// Adds one of `name`, bumping quantity if it's already in the cart.
    func add(name: String, price: Double, icon: String, tint: Color) {
        if let index = items.firstIndex(where: { $0.name == name }) {
            items[index].quantity += 1
        } else {
            items.append(Item(name: name, price: price, quantity: 1, icon: icon, tint: tint))
        }
    }

    func remove(at index: Int) {
        guard items.indices.contains(index) else { return }
        items.remove(at: index)
    }
}
