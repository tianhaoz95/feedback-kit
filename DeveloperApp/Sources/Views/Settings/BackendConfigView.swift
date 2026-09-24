import SwiftUI
import FeedbackKit

public struct BackendConfigView: View {
    @ObservedObject private var client = SupabasePortalClient.shared
    @State private var isServerConfigPresented = false

    public init() {}

    private var environmentTitle: String {
        if client.isDemoMode {
            return "Demo Mode (Offline)"
        } else if client.supabaseUrl == SupabasePortalClient.defaultProdUrl {
            return "Production Hosted"
        } else if client.supabaseUrl == SupabasePortalClient.defaultLocalUrl {
            return "Local CLI Stack"
        } else {
            return "Custom Endpoint"
        }
    }

    public var body: some View {
        List {
            Section(
                header: Text("Backend Configuration"),
                footer: Text("Default is the hosted FeedbackKit production project (https://gpucoladcyvijefdjudf.supabase.co).")
            ) {
                HStack {
                    Text("Environment")
                    Spacer()
                    Text(environmentTitle)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("Server URL")
                    Spacer()
                    Text(client.supabaseUrl)
                        .lineLimit(1)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                HStack {
                    Text("API Key")
                    Spacer()
                    Text(client.anonKey.isEmpty ? "Not configured" : "\(client.anonKey.prefix(12))...")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.secondary)
                }

                Button {
                    isServerConfigPresented = true
                } label: {
                    HStack {
                        Text("Configure Endpoint & Keys")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Backend Configuration")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isServerConfigPresented) {
            ServerConfigSheet()
        }
        .onAppear {
            FeedbackKit.currentScreen = "Backend Configuration"
        }
    }
}
