import AppKit
import FeedbackKit
import SwiftUI

/// macOS counterpart to the iOS demo's `HomeView` — same catalog, same
/// shared `CartStore`, but triggering the feedback flow via
/// `FeedbackKit.present(from: NSWindow?)` instead of a view controller.
struct MacHomeView: View {
    @State private var recentlyAddedIDs: Set<String> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Welcome back")
                        .font(.largeTitle.bold())
                    Text("Sample screen for exercising FeedbackKit on macOS. Use the floating button, the Help menu's \u{201C}Report a Problem\u{2026}\u{201D} item (\u{2318}\u{21E7}R), or the button below.")
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
                .controlSize(.large)
                .padding(.top, 8)
            }
            .padding()
        }
        .navigationTitle("FeedbackKit Demo")
        .onAppear { FeedbackKit.currentScreen = "Home" }
    }

    private func addToCart(_ product: Product) {
        CartStore.shared.add(name: product.name, price: product.price, icon: product.icon, tint: product.tint)

        withAnimation(.snappy) {
            _ = recentlyAddedIDs.insert(product.id)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            withAnimation(.snappy) {
                _ = recentlyAddedIDs.remove(product.id)
            }
        }
    }

    private func reportProblem() {
        FeedbackKit.present(from: NSApplication.shared.keyWindow) { report in
            guard let report else { return }
            print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
        }
    }

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
                .frame(width: 44, height: 44)
                .overlay {
                    Image(systemName: product.icon)
                        .foregroundStyle(product.tint)
                }

            VStack(alignment: .leading) {
                Text(product.name).font(.headline)
                Text(product.priceText).foregroundStyle(.secondary)
            }

            Spacer()

            Button(action: onAdd) {
                Label(justAdded ? "Added" : "Add", systemImage: justAdded ? "checkmark" : "plus")
                    .frame(minWidth: 68)
            }
            .disabled(justAdded)
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
