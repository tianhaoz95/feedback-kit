import SwiftUI

struct RootTabView: View {
    @ObservedObject private var cartStore = CartStore.shared

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }

            CartViewControllerRepresentable()
                .ignoresSafeArea()
                .tabItem { Label("Cart", systemImage: "cart") }
                .badge(cartStore.items.count)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
