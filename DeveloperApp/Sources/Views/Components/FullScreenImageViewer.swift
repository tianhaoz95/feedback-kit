import SwiftUI

public struct FullScreenImageContext: Identifiable {
    public let id = UUID()
    public let url: URL
    public let title: String?
    public let caption: String?

    public init(url: URL, title: String? = nil, caption: String? = nil) {
        self.url = url
        self.title = title
        self.caption = caption
    }
}

public struct FullScreenImageViewer: View {
    @Environment(\.dismiss) private var dismiss

    public let url: URL?
    public let title: String?
    public let caption: String?

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var dragDismissOffset: CGFloat = 0

    public init(url: URL?, title: String? = nil, caption: String? = nil) {
        self.url = url
        self.title = title
        self.caption = caption
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                Color.black.ignoresSafeArea()

                if let url {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            ProgressView()
                                .tint(.white)
                        case .success(let image):
                            image
                                .resizable()
                                .scaledToFit()
                                .scaleEffect(scale)
                                .offset(y: scale > 1.0 ? offset.height : dragDismissOffset)
                                .offset(x: scale > 1.0 ? offset.width : 0)
                                .opacity(dismissOpacity)
                                .gesture(
                                    MagnificationGesture()
                                        .onChanged { value in
                                            let delta = value / lastScale
                                            lastScale = value
                                            scale = min(max(scale * delta, 1.0), 5.0)
                                        }
                                        .onEnded { _ in
                                            lastScale = 1.0
                                            if scale <= 1.0 {
                                                withAnimation(.spring()) {
                                                    scale = 1.0
                                                    offset = .zero
                                                    lastOffset = .zero
                                                }
                                            }
                                        }
                                        .simultaneously(with:
                                            DragGesture()
                                                .onChanged { value in
                                                    if scale > 1.0 {
                                                        offset = CGSize(
                                                            width: lastOffset.width + value.translation.width,
                                                            height: lastOffset.height + value.translation.height
                                                        )
                                                    } else if value.translation.height > 0 {
                                                        dragDismissOffset = value.translation.height
                                                    }
                                                }
                                                .onEnded { value in
                                                    if scale > 1.0 {
                                                        lastOffset = offset
                                                    } else {
                                                        if value.translation.height > 100 {
                                                            dismiss()
                                                        } else {
                                                            withAnimation(.spring()) {
                                                                dragDismissOffset = 0
                                                            }
                                                        }
                                                    }
                                                }
                                        )
                                )
                                .onTapGesture(count: 2) {
                                    withAnimation(.spring()) {
                                        if scale > 1.0 {
                                            scale = 1.0
                                            offset = .zero
                                            lastOffset = .zero
                                        } else {
                                            scale = 2.5
                                        }
                                    }
                                }
                        case .failure:
                            VStack(spacing: 8) {
                                Image(systemName: "photo.badge.exclamationmark")
                                    .font(.largeTitle)
                                    .foregroundColor(.white.opacity(0.7))
                                Text("Failed to load image")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.7))
                            }
                        @unknown default:
                            EmptyView()
                        }
                    }
                } else {
                    Text("No image available")
                        .foregroundColor(.white.opacity(0.7))
                }

                // Zoom reset badge if zoomed
                if scale > 1.05 {
                    VStack {
                        HStack {
                            Button {
                                withAnimation(.spring()) {
                                    scale = 1.0
                                    offset = .zero
                                    lastOffset = .zero
                                }
                            } label: {
                                Label("Reset Zoom (\(Int(scale * 100))%)", systemImage: "arrow.counterclockwise")
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

                // Optional caption at the bottom
                if let caption, !caption.isEmpty {
                    VStack {
                        Spacer()
                        Text(caption)
                            .font(.caption)
                            .foregroundColor(.white)
                            .multilineTextAlignment(.leading)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.black.opacity(0.75))
                    }
                }
            }
            .navigationTitle(title ?? "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    if let url {
                        ShareLink(item: url) {
                            Image(systemName: "square.and.arrow.up")
                                .foregroundColor(.white)
                        }
                    }
                }
            }
            #if os(iOS)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarBackground(Color.black, for: .navigationBar)
            #endif
        }
        #if os(iOS)
        .preferredColorScheme(.dark)
        #endif
    }

    private var dismissOpacity: Double {
        if dragDismissOffset > 0 {
            return max(0.4, 1.0 - Double(dragDismissOffset) / 300.0)
        }
        return 1.0
    }
}
