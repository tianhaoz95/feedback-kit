import SwiftUI

/// Sidebar + detail is the idiomatic Mac shape for what the iOS demo does
/// with a tab bar — same two screens (Home, Cart), same shared `CartStore`.
struct MacContentView: View {
    private enum Screen: String, Identifiable, CaseIterable {
        case home = "Home"
        case cart = "Cart"

        var id: String { rawValue }
        var systemImage: String {
            switch self {
            case .home: "house"
            case .cart: "cart"
            }
        }
    }

    @ObservedObject private var cartStore = CartStore.shared
    @State private var selection: Screen? = .home

    var body: some View {
        NavigationSplitView {
            List(Screen.allCases, selection: $selection) { screen in
                Label(screen.rawValue, systemImage: screen.systemImage)
                    .badge(screen == .cart ? cartStore.items.count : 0)
                    .tag(screen)
            }
            .navigationSplitViewColumnWidth(min: 160, ideal: 180)
        } detail: {
            switch selection {
            case .cart:
                MacCartView()
            default:
                MacHomeView()
            }
        }
        .frame(minWidth: 640, minHeight: 480)
    }
}
