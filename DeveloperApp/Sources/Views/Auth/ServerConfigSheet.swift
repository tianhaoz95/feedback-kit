import SwiftUI

public struct ServerConfigSheet: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var client = SupabasePortalClient.shared

    @State private var url: String = ""
    @State private var key: String = ""
    @State private var demoMode: Bool = true

    public var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Environment Mode")) {
                    Toggle("Demo / Preview Mode", isOn: $demoMode)
                    if demoMode {
                        Text("Demo mode operates fully offline with realistic mock data and instant mutations. Turn off to connect to your live Supabase database.")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }

                Section(header: Text("Presets")) {
                    Button {
                        url = SupabasePortalClient.defaultProdUrl
                        key = SupabasePortalClient.defaultProdAnonKey
                        demoMode = false
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Production Hosted (Default)")
                                    .foregroundColor(.primary)
                                Text("https://gpucoladcyvijefdjudf.supabase.co")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            if url == SupabasePortalClient.defaultProdUrl {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                    }

                    Button {
                        url = SupabasePortalClient.defaultLocalUrl
                        key = SupabasePortalClient.defaultLocalAnonKey
                        demoMode = false
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Local CLI Stack")
                                    .foregroundColor(.primary)
                                Text("http://127.0.0.1:54321")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            if url == SupabasePortalClient.defaultLocalUrl {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                    }
                }

                Section(header: Text("Supabase Backend Settings"), footer: Text("Changes here take effect immediately for all live API calls, OAuth redirects, and data sync.")) {
                    TextField("Supabase URL", text: $url)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)

                    TextField("Anon / Publishable API Key", text: $key)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                }
            }
            .navigationTitle("Server Configuration")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                url = client.supabaseUrl
                key = client.anonKey
                demoMode = client.isDemoMode
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        client.supabaseUrl = url
                        client.anonKey = key
                        client.isDemoMode = demoMode
                        UINotificationFeedbackGenerator().notificationOccurred(.success)
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
    }
}
