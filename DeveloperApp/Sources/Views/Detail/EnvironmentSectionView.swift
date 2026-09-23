import SwiftUI
import FeedbackKit

public struct EnvironmentSectionView: View {
    public let env: FeedbackEnvironment

    public init(env: FeedbackEnvironment) {
        self.env = env
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Environment & Diagnostics")
                .font(.headline)

            VStack(spacing: 8) {
                HStack(spacing: 12) {
                    metricCard(title: "Device", value: env.deviceModel, icon: "iphone")
                    metricCard(title: "Operating System", value: "\(env.osName) \(env.osVersion)", icon: "gearshape")
                }

                HStack(spacing: 12) {
                    metricCard(title: "App Version", value: "\(env.appVersion) (\(env.appBuild))", icon: "app.badge")
                    metricCard(title: "Screen", value: env.screenName ?? "—", icon: "macwindow")
                }

                HStack(spacing: 12) {
                    metricCard(
                        title: "Resolution",
                        value: "\(Int(env.screenWidthPoints))×\(Int(env.screenHeightPoints)) pt @ \(Int(env.screenScale))x",
                        icon: "aspectratio"
                    )
                    metricCard(title: "Locale", value: env.locale, icon: "globe")
                }
            }
        }
    }

    private func metricCard(title: String, value: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text(title)
                    .font(.caption2.weight(.medium))
                    .foregroundColor(.secondary)
            }
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(.primary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(Color(UIColor.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}
