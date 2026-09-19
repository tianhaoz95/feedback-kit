import FeedbackKit
import SwiftUI
import UIKit

/// A SwiftUI screen, to demonstrate FeedbackKit's window-level screenshot
/// capture works the same for SwiftUI content as it does for UIKit (see
/// `CartViewController`) — the SDK never has to know which one built the screen.
struct HomeView: View {
    @State private var recentlyAddedIDs: Set<String> = []

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Welcome back")
                            .font(.largeTitle.bold())
                        Text("Sample screen for exercising FeedbackKit. Shake the simulator (Device \u{2192} Shake Gesture) or tap the floating button to report an issue with whatever's on screen.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    VStack(spacing: 12) {
                        ForEach(Self.catalog) { product in
                            ProductCardView(
                                product: product,
                                justAdded: recentlyAddedIDs.contains(product.id),
                                onAdd: { addToCart(product) }
                            )
                        }
                    }

                    Button {
                        reportProblem()
                    } label: {
                        Label("Report a Problem", systemImage: "exclamationmark.bubble")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 8)
                }
                .padding()
            }
            .navigationTitle("FeedbackKit Demo")
        }
        .onAppear { FeedbackKit.currentScreen = "Home" }
    }

    private func addToCart(_ product: Product) {
        CartStore.shared.add(name: product.name, price: product.price, icon: product.icon, tint: product.tint)

        UINotificationFeedbackGenerator().notificationOccurred(.success)
        withAnimation(.snappy) {
            _ = recentlyAddedIDs.insert(product.id)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation(.snappy) {
                recentlyAddedIDs.remove(product.id)
            }
        }
    }

    private func reportProblem() {
        guard let presenter = UIApplication.shared.topMostViewController else { return }
        FeedbackKit.present(from: presenter) { report in
            guard let report else { return }
            print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
        }
    }

    // What's available to browse. Tapping "Add" feeds into `CartStore`, so
    // this actually shows up on the Cart tab rather than being disconnected
    // fake data — the whole point of giving the demo a shared cart store.
    private static let catalog: [Product] = [
        Product(name: "Wireless Headphones", price: 59.99, icon: "headphones", tint: .purple),
        Product(name: "Canvas Tote Bag", price: 24.99, icon: "bag.fill", tint: .green),
        Product(name: "Classic T-Shirt", price: 19.99, icon: "tshirt.fill", tint: .orange)
    ]
}

private struct Product: Identifiable {
    let name: String
    let price: Double
    let icon: String
    let tint: Color

    var id: String { name }

    var priceText: String { price.formatted(.currency(code: "USD")) }
}

private struct ProductCardView: View {
    let product: Product
    let justAdded: Bool
    let onAdd: () -> Void

    var body: some View {
        HStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(product.tint.opacity(0.15))
                .frame(width: 56, height: 56)
                .overlay {
                    Image(systemName: product.icon)
                        .font(.title2)
                        .foregroundStyle(product.tint)
                }

            VStack(alignment: .leading) {
                Text(product.name).font(.headline)
                Text(product.priceText).foregroundStyle(.secondary)
            }

            Spacer()

            Button(action: onAdd) {
                Label(justAdded ? "Added" : "Add", systemImage: justAdded ? "checkmark" : "plus")
                    .font(.subheadline.weight(.semibold))
                    .frame(minWidth: 68)
            }
            .buttonStyle(.bordered)
            .tint(justAdded ? .green : product.tint)
            .disabled(justAdded)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.06), radius: 6, y: 3)
    }
}
