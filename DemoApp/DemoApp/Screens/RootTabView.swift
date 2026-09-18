import SwiftUI

struct RootTabView: View {
    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }

            CartViewControllerRepresentable()
                .ignoresSafeArea()
                .tabItem { Label("Cart", systemImage: "cart") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
