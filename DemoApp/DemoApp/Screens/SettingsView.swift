import FeedbackKit
import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationView {
            Form {
                Section("Hosted dashboard") {
                    Text("Configure FeedbackKit.configure(...) in FeedbackKitDemoApp.swift with your project's ingestion endpoint and project key to have feedback submitted straight to the developer dashboard (see /web and /supabase).")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Section("Triggers wired up in this demo") {
                    Label("Shake the device / simulator", systemImage: "iphone.gen3")
                    Label("Tap the floating blue button", systemImage: "hand.tap")
                    Label("\"Report a Problem\" button on Home/Cart", systemImage: "hand.point.up.left")
                }
            }
            .navigationTitle("Settings")
        }
        .onAppear { FeedbackKit.currentScreen = "Settings" }
    }
}
