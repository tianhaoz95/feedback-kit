import FeedbackKit
import SwiftUI

/// A SwiftUI screen, to demonstrate FeedbackKit's window-level screenshot
/// capture works the same for SwiftUI content as it does for UIKit (see
/// `CartViewController`) — the SDK never has to know which one built the screen.
struct HomeView: View {
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Welcome back")
                        .font(.largeTitle.bold())

                    Text("Sample screen for exercising FeedbackKit. Shake the simulator (Device \u{2192} Shake Gesture) or tap the floating button to report an issue with whatever's on screen.")
                        .foregroundStyle(.secondary)

                    ForEach(Self.products) { product in
                        ProductCardView(product: product)
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

    private func reportProblem() {
        guard let presenter = UIApplication.shared.topMostViewController else { return }
        FeedbackKit.present(from: presenter) { report in
            guard let report else { return }
            print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
        }
    }

    // Fake catalog data, just so the sample screen reads like a real product
    // list instead of three identical placeholder rows.
    private static let products: [Product] = [
        Product(name: "Wireless Headphones", price: "$59.99", icon: "headphones", tint: .purple),
        Product(name: "Canvas Tote Bag", price: "$24.99", icon: "bag.fill", tint: .green),
        Product(name: "Classic T-Shirt", price: "$19.99", icon: "tshirt.fill", tint: .orange)
    ]
}

private struct Product: Identifiable {
    let name: String
    let price: String
    let icon: String
    let tint: Color

    var id: String { name }
}

private struct ProductCardView: View {
    let product: Product

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
                Text(product.price).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
