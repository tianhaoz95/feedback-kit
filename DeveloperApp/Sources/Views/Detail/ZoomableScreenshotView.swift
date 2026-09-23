import SwiftUI
import FeedbackKit

public struct ZoomableScreenshotView: View {
    public let item: PortalFeedbackItem

    public enum DisplayMode: String, CaseIterable, Identifiable {
        case annotated = "Annotated"
        case raw = "Raw"
        case markup = "Vector Markup"

        public var id: String { rawValue }
    }

    @State private var displayMode: DisplayMode = .annotated
    @State private var currentScale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var isFullScreenPresented: Bool = false

    public init(item: PortalFeedbackItem) {
        self.item = item
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header with display mode picker and fullscreen button
            HStack {
                Text("Screenshot & Annotations")
                    .font(.headline)
                Spacer()

                if !item.annotations.isEmpty {
                    Picker("Mode", selection: $displayMode) {
                        ForEach(DisplayMode.allCases) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 240)
                }

                Button {
                    isFullScreenPresented = true
                } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding(6)
                        .background(Color(UIColor.secondarySystemBackground))
                        .clipShape(Circle())
                }
            }

            // Image Container with Zoom & Pan Gestures
            ZStack {
                Color(UIColor.secondarySystemBackground)

                imageContent(for: displayMode)
                    .scaleEffect(currentScale)
                    .offset(offset)
                    .gesture(
                        MagnificationGesture()
                            .onChanged { value in
                                let delta = value / lastScale
                                lastScale = value
                                currentScale = min(max(currentScale * delta, 1.0), 5.0)
                            }
                            .onEnded { _ in
                                lastScale = 1.0
                                if currentScale <= 1.0 {
                                    withAnimation(.spring()) {
                                        offset = .zero
                                    }
                                }
                            }
                            .simultaneously(with:
                                DragGesture()
                                    .onChanged { value in
                                        if currentScale > 1.0 {
                                            offset = CGSize(
                                                width: lastOffset.width + value.translation.width,
                                                height: lastOffset.height + value.translation.height
                                            )
                                        }
                                    }
                                    .onEnded { _ in
                                        lastOffset = offset
                                    }
                            )
                    )
                    .onTapGesture(count: 2) {
                        withAnimation(.spring()) {
                            if currentScale > 1.0 {
                                currentScale = 1.0
                                offset = .zero
                                lastOffset = .zero
                            } else {
                                currentScale = 2.5
                            }
                        }
                    }

                // Zoom reset badge if zoomed
                if currentScale > 1.05 {
                    VStack {
                        HStack {
                            Button {
                                withAnimation(.spring()) {
                                    currentScale = 1.0
                                    offset = .zero
                                    lastOffset = .zero
                                }
                            } label: {
                                Label("Reset Zoom (\(Int(currentScale * 100))%)", systemImage: "arrow.counterclockwise")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(Color.black.opacity(0.75))
                                    .clipShape(Capsule())
                            }
                            Spacer()
                        }
                        .padding(10)
                        Spacer()
                    }
                }
            }
            .frame(height: 380)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color(UIColor.separator).opacity(0.5), lineWidth: 0.5)
            )

            // Annotation chips breakdown
            if !item.annotations.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        Text("Markup:")
                            .font(.caption.weight(.medium))
                            .foregroundColor(.secondary)

                        ForEach(Array(item.annotations.enumerated()), id: \.offset) { idx, ann in
                            HStack(spacing: 5) {
                                Circle()
                                    .fill(Color(hex: ann.colorHex) ?? .red)
                                    .frame(width: 8, height: 8)

                                Text(ann.kind.rawValue.capitalized)
                                    .font(.caption2.weight(.semibold))

                                if let label = ann.label, !label.isEmpty {
                                    Text("\"\(label)\"")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color(UIColor.tertiarySystemFill))
                            .clipShape(Capsule())
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .fullScreenCover(isPresented: $isFullScreenPresented) {
            FullScreenScreenshotModal(item: item)
        }
    }

    @ViewBuilder
    private func imageContent(for mode: DisplayMode) -> some View {
        let shotUrl = (mode == .raw ? (item.signedRawScreenshotUrl ?? item.signedScreenshotUrl) : item.signedScreenshotUrl)
            ?? item.signedScreenshotUrl
            ?? "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=800&auto=format&fit=crop"

        ZStack {
            AsyncImage(url: URL(string: shotUrl)) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                case .failure:
                    VStack(spacing: 8) {
                        Image(systemName: "photo.badge.exclamationmark")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("Screenshot unavailable")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                @unknown default:
                    EmptyView()
                }
            }

            // Dynamic vector markup overlay if mode is .markup
            if mode == .markup {
                AnnotationCanvasOverlayView(annotations: item.annotations)
            }
        }
    }
}

// MARK: - Full Screen Screenshot Modal

private struct FullScreenScreenshotModal: View {
    @Environment(\.dismiss) private var dismiss
    let item: PortalFeedbackItem
    @State private var scale: CGFloat = 1.0

    var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                let urlString = item.signedScreenshotUrl ?? "https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=800&auto=format&fit=crop"

                AsyncImage(url: URL(string: urlString)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .scaleEffect(scale)
                            .gesture(
                                MagnificationGesture()
                                    .onChanged { val in scale = max(val, 1.0) }
                                    .onEnded { _ in if scale < 1.0 { scale = 1.0 } }
                            )
                    case .failure:
                        Text("Failed to load image")
                            .foregroundColor(.white)
                    default:
                        ProgressView()
                            .tint(.white)
                    }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if let urlStr = item.signedScreenshotUrl, let url = URL(string: urlStr) {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up")
                                .foregroundColor(.white)
                        }
                    }
                }
            }
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(Color.black, for: .navigationBar)
        }
    }
}

// MARK: - Color Hex Initializer Helper

private extension Color {
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }
}
