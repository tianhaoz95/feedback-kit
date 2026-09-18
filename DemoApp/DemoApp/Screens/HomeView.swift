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

                    ForEach(1...3, id: \.self) { index in
                        ProductCardView(title: "Product \(index)")
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
}

private struct ProductCardView: View {
    let title: String

    var body: some View {
        HStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.blue.opacity(0.2))
                .frame(width: 56, height: 56)
            VStack(alignment: .leading) {
                Text(title).font(.headline)
                Text("$19.99").foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
