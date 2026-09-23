import AppKit
import FeedbackKit
import SwiftUI

/// macOS counterpart to the iOS demo's UIKit `CartViewController` — same
/// shared `CartStore`, built with SwiftUI's `List` instead (there's no
/// AppKit-vs-SwiftUI split to demonstrate here the way iOS shows UIKit vs.
/// SwiftUI; the point on this platform is the shared model + `NSWindow?`
/// presentation, not a second UI framework).
struct MacCartView: View {
    @ObservedObject private var cartStore = CartStore.shared

    var body: some View {
        VStack(spacing: 0) {
            if cartStore.items.isEmpty {
                // Not `ContentUnavailableView` — that needs macOS 13, one
                // above this target's macOS 12 deployment target (matching
                // the SDK's own `Package.swift`).
                VStack(spacing: 8) {
                    Image(systemName: "cart")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("Your cart is empty").font(.headline)
                    Text("Add something from Home to see it here.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(cartStore.items) { item in
                        HStack {
                            Image(systemName: item.icon)
                                .foregroundStyle(item.tint)
                                .frame(width: 24)
                            VStack(alignment: .leading) {
                                Text(item.name)
                                Text("Qty \(item.quantity) · \(item.price.formatted(.currency(code: "USD")))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete { offsets in
                        offsets.forEach { cartStore.remove(at: $0) }
                    }
                }
            }

            Divider()

            HStack {
                Text("Subtotal: \(cartStore.subtotal.formatted(.currency(code: "USD")))")
                    .font(.headline)
                Spacer()
                Button("Report a Problem") { reportProblem() }
            }
            .padding()
        }
        .navigationTitle("Cart")
        .onAppear { FeedbackKit.currentScreen = "Cart" }
    }

    private func reportProblem() {
        FeedbackKit.presentAndSubmitIfConfigured(from: NSApplication.shared.keyWindow) { result in
            guard let result else { return }
            switch result {
            case .success(let report):
                print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
            case .failure(let error):
                print("[FeedbackKit demo] report failed: \(error)")
            }
        }
    }
}
