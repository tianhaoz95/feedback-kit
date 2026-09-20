#if os(macOS)
import AVFoundation
import AppKit
import UniformTypeIdentifiers

/// The capture/annotate/describe/submit flow, macOS counterpart to
/// `FeedbackViewController` (iOS). Presented as a sheet on the window passed
/// to `FeedbackKit.present(from:)` rather than full-screen — a sheet is the
/// native "modal over this window" idiom on macOS, playing the same role a
/// full-screen presentation does on a phone-sized screen. There's no fake
/// device bezel around the screenshot here (unlike iOS) since "this is a
/// phone screenshot" isn't a thing that needs establishing on a Mac.
final class FeedbackWindowController: NSWindowController {
    private let rawScreenshot: NSImage
    private let screenNameOverride: String?
    private let onComplete: (FeedbackReport?) -> Void

    private let cancelButton = NSButton(title: "Cancel", target: nil, action: nil)
    private let screenshotBoundsView = ScreenshotBoundsView()
    private let toolbar = AnnotationToolbar()

    private let composerContainer = NSView()
    private let attachmentChipView = NSView()
    private let attachmentNameLabel = NSTextField(labelWithString: "")
    private let placeholderLabel = NSTextField(labelWithString: "What's the problem?")
    private let textView = NSTextView()
    private let attachButton = NSButton(title: "", target: nil, action: nil)
    private let sendButton = NSButton(title: "", target: nil, action: nil)
    private var textViewHeightConstraint: NSLayoutConstraint?

    private var pickedAttachment: (filename: String, mimeType: String, data: Data)?

    init(rawScreenshot: NSImage, screenNameOverride: String?, onComplete: @escaping (FeedbackReport?) -> Void) {
        self.rawScreenshot = rawScreenshot
        self.screenNameOverride = screenNameOverride
        self.onComplete = onComplete

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 760, height: 640),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Report Feedback"
        window.minSize = NSSize(width: 560, height: 480)
        super.init(window: window)

        buildContent()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func buildContent() {
        guard let window else { return }
        let root = NSView(frame: window.contentView?.bounds ?? .zero)
        window.contentView = root

        buildHeader(in: root)
        buildScreenshotArea(in: root)
        buildToolbar(in: root)
        buildComposer(in: root)
        layoutAll(in: root)
    }

    // MARK: - Building

    private func buildHeader(in root: NSView) {
        cancelButton.bezelStyle = .regularSquare
        cancelButton.isBordered = false
        cancelButton.contentTintColor = .controlAccentColor
        cancelButton.target = self
        cancelButton.action = #selector(cancelTapped)
        root.addSubview(cancelButton)
    }

    private func buildScreenshotArea(in root: NSView) {
        let imageView = screenshotBoundsView.imageView
        imageView.image = rawScreenshot
        imageView.imageScaling = .scaleProportionallyUpOrDown
        imageView.wantsLayer = true
        imageView.layer?.cornerRadius = 8
        imageView.layer?.borderWidth = 1
        imageView.layer?.borderColor = NSColor.separatorColor.cgColor

        screenshotBoundsView.aspectRatio = rawScreenshot.size
        screenshotBoundsView.canvasView.onRequestTextInput = { [weak self] location, completion in
            self?.presentTextPrompt(completion: completion)
        }
        root.addSubview(screenshotBoundsView)
    }

    private func buildToolbar(in root: NSView) {
        toolbar.wantsLayer = true
        toolbar.layer?.cornerRadius = 12
        toolbar.onToolSelected = { [weak self] tool in self?.screenshotBoundsView.canvasView.tool = tool }
        toolbar.onColorSelected = { [weak self] color in self?.screenshotBoundsView.canvasView.strokeColor = color }
        toolbar.onUndo = { [weak self] in self?.screenshotBoundsView.canvasView.undoLast() }
        root.addSubview(toolbar)
    }

    private func buildComposer(in root: NSView) {
        composerContainer.wantsLayer = true
        composerContainer.layer?.borderColor = NSColor.separatorColor.cgColor
        composerContainer.layer?.borderWidth = 1
        composerContainer.layer?.cornerRadius = 16

        buildAttachmentChip()

        textView.delegate = self
        textView.isRichText = false
        textView.font = .systemFont(ofSize: NSFont.systemFontSize)
        textView.drawsBackground = false
        textView.textContainerInset = .zero
        textView.textContainer?.lineFragmentPadding = 0
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]

        let scrollView = NSScrollView()
        scrollView.documentView = textView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        let heightConstraint = scrollView.heightAnchor.constraint(equalToConstant: 24)
        heightConstraint.isActive = true
        textViewHeightConstraint = heightConstraint

        placeholderLabel.textColor = .placeholderTextColor
        placeholderLabel.isBordered = false
        placeholderLabel.isEditable = false
        placeholderLabel.backgroundColor = .clear

        let iconConfig = NSImage.SymbolConfiguration(pointSize: 22, weight: .regular)
        attachButton.image = NSImage(systemSymbolName: "plus.circle.fill", accessibilityDescription: "Attach")?
            .withSymbolConfiguration(iconConfig)
        attachButton.isBordered = false
        attachButton.imagePosition = .imageOnly
        attachButton.contentTintColor = .secondaryLabelColor
        attachButton.target = self
        attachButton.action = #selector(attachTapped)

        sendButton.image = NSImage(systemSymbolName: "arrow.up.circle.fill", accessibilityDescription: "Send")?
            .withSymbolConfiguration(iconConfig)
        sendButton.isBordered = false
        sendButton.imagePosition = .imageOnly
        sendButton.contentTintColor = .controlAccentColor
        sendButton.target = self
        sendButton.action = #selector(submitTapped)

        let spacer = NSView()
        let buttonRow = NSStackView(views: [attachButton, spacer, sendButton])
        buttonRow.orientation = .horizontal
        buttonRow.alignment = .centerY

        let composerStack = NSStackView(views: [attachmentChipView, scrollView, buttonRow])
        composerStack.orientation = .vertical
        composerStack.spacing = 8
        composerStack.translatesAutoresizingMaskIntoConstraints = false
        composerContainer.addSubview(composerStack)
        composerContainer.addSubview(placeholderLabel)

        NSLayoutConstraint.activate([
            composerStack.leadingAnchor.constraint(equalTo: composerContainer.leadingAnchor, constant: 12),
            composerStack.trailingAnchor.constraint(equalTo: composerContainer.trailingAnchor, constant: -12),
            composerStack.topAnchor.constraint(equalTo: composerContainer.topAnchor, constant: 10),
            composerStack.bottomAnchor.constraint(equalTo: composerContainer.bottomAnchor, constant: -10),
            placeholderLabel.topAnchor.constraint(equalTo: scrollView.topAnchor, constant: 2),
            placeholderLabel.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor, constant: 4)
        ])

        root.addSubview(composerContainer)
    }

    private func buildAttachmentChip() {
        attachmentChipView.wantsLayer = true
        attachmentChipView.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        attachmentChipView.layer?.cornerRadius = 8
        attachmentChipView.isHidden = true

        attachmentNameLabel.textColor = .secondaryLabelColor
        attachmentNameLabel.lineBreakMode = .byTruncatingMiddle
        attachmentNameLabel.isBordered = false
        attachmentNameLabel.isEditable = false
        attachmentNameLabel.backgroundColor = .clear

        let removeButton = NSButton(
            image: NSImage(systemSymbolName: "xmark.circle.fill", accessibilityDescription: "Remove attachment") ?? NSImage(),
            target: self,
            action: #selector(clearAttachment)
        )
        removeButton.isBordered = false
        removeButton.contentTintColor = .secondaryLabelColor

        let chipStack = NSStackView(views: [attachmentNameLabel, removeButton])
        chipStack.orientation = .horizontal
        chipStack.spacing = 6
        chipStack.translatesAutoresizingMaskIntoConstraints = false
        attachmentChipView.addSubview(chipStack)

        NSLayoutConstraint.activate([
            chipStack.leadingAnchor.constraint(equalTo: attachmentChipView.leadingAnchor, constant: 8),
            chipStack.trailingAnchor.constraint(equalTo: attachmentChipView.trailingAnchor, constant: -8),
            chipStack.topAnchor.constraint(equalTo: attachmentChipView.topAnchor, constant: 4),
            chipStack.bottomAnchor.constraint(equalTo: attachmentChipView.bottomAnchor, constant: -4)
        ])
    }

    private func layoutAll(in root: NSView) {
        [cancelButton, screenshotBoundsView, toolbar, composerContainer].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
        }

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            cancelButton.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),

            // screenshotBoundsView itself is Auto-Layout-positioned; the
            // image/canvas pair inside it are frame-based (see
            // ScreenshotBoundsView.layout()) since their aspect-fit rect is
            // computed from the screenshot's aspect ratio, not expressible
            // as a static constraint — same reason the iOS implementation
            // recomputes it in `viewDidLayoutSubviews` instead.
            screenshotBoundsView.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 12),
            screenshotBoundsView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            screenshotBoundsView.trailingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: -12),
            screenshotBoundsView.bottomAnchor.constraint(equalTo: composerContainer.topAnchor, constant: -12),

            toolbar.topAnchor.constraint(equalTo: screenshotBoundsView.topAnchor),
            toolbar.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            toolbar.bottomAnchor.constraint(equalTo: screenshotBoundsView.bottomAnchor),
            toolbar.widthAnchor.constraint(equalToConstant: 64),

            composerContainer.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            composerContainer.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            composerContainer.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -16)
        ])
    }

    // MARK: - Presentation

    /// Presents as a sheet on `hostWindow` if given, otherwise as a
    /// standalone window — `hostWindow` is what `FeedbackKit.present(from:)`
    /// passes when the caller has one; a menu-bar-only app might not.
    func show(on hostWindow: NSWindow?) {
        guard let window else { return }
        if let hostWindow {
            hostWindow.beginSheet(window)
        } else {
            window.center()
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func dismiss() {
        guard let window else { return }
        if let sheetParent = window.sheetParent {
            sheetParent.endSheet(window)
        } else {
            window.close()
        }
    }

    // MARK: - Actions

    private func presentTextPrompt(completion: @escaping (String?) -> Void) {
        let alert = NSAlert()
        alert.messageText = "Add a note"
        alert.addButton(withTitle: "Add")
        alert.addButton(withTitle: "Cancel")

        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 240, height: 22))
        alert.accessoryView = field
        alert.window.initialFirstResponder = field

        // App-modal rather than a nested sheet on our own (already-a-sheet)
        // window, to avoid juggling two levels of sheet completion handlers
        // for what's a rare, quick interaction.
        let response = alert.runModal()
        completion(response == .alertFirstButtonReturn ? field.stringValue : nil)
    }

    @objc private func cancelTapped() {
        dismiss()
        onComplete(nil)
    }

    @objc private func attachTapped() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        guard let window else { return }
        panel.beginSheetModal(for: window) { [weak self] response in
            guard let self, response == .OK, let url = panel.url, let data = try? Data(contentsOf: url) else { return }
            let filename = url.lastPathComponent
            let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            self.pickedAttachment = (filename: filename, mimeType: mimeType, data: data)
            self.attachmentNameLabel.stringValue = filename
            self.attachmentChipView.isHidden = false
        }
    }

    @objc private func clearAttachment() {
        pickedAttachment = nil
        attachmentChipView.isHidden = true
    }

    @objc private func submitTapped() {
        let flattened = screenshotBoundsView.canvasView.flattenedImage(baseImage: rawScreenshot)
        guard
            let rawPNG = rawScreenshot.pngData(),
            let annotatedPNG = flattened.pngData()
        else {
            dismiss()
            onComplete(nil)
            return
        }

        let attachment = pickedAttachment.map {
            FeedbackAttachment(filename: $0.filename, mimeType: $0.mimeType, data: $0.data)
        }

        let report = FeedbackReport(
            text: textView.string,
            screenshotRawPNG: rawPNG,
            screenshotAnnotatedPNG: annotatedPNG,
            annotations: screenshotBoundsView.canvasView.completedAnnotations,
            environment: EnvironmentInfo.current(screenName: screenNameOverride),
            attachment: attachment
        )

        dismiss()
        onComplete(report)
    }
}

extension FeedbackWindowController: NSTextViewDelegate {
    func textDidChange(_ notification: Notification) {
        placeholderLabel.isHidden = !textView.string.isEmpty

        guard let layoutManager = textView.layoutManager, let textContainer = textView.textContainer else { return }
        layoutManager.ensureLayout(for: textContainer)
        let usedHeight = layoutManager.usedRect(for: textContainer).height
        textViewHeightConstraint?.constant = min(max(usedHeight, 24), 120)
    }
}

/// Hosts the screenshot + annotation overlay pair and keeps them aspect-fit
/// within its own bounds, recomputed on every layout pass (window resizes,
/// unlike iOS's fixed device screen). Frame-based rather than constrained,
/// same as `FeedbackViewController`'s `viewDidLayoutSubviews` on iOS — an
/// aspect-fit rect isn't naturally expressible as a static constraint.
private final class ScreenshotBoundsView: NSView {
    let imageView = NSImageView()
    let canvasView = AnnotationCanvasView()
    var aspectRatio = CGSize(width: 1, height: 1) {
        didSet { needsLayout = true }
    }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        addSubview(imageView)
        addSubview(canvasView)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        addSubview(imageView)
        addSubview(canvasView)
    }

    override func layout() {
        super.layout()
        let innerRect = AVMakeRect(aspectRatio: aspectRatio, insideRect: bounds)
        imageView.frame = innerRect
        canvasView.frame = innerRect
    }
}

private extension NSImage {
    func pngData() -> Data? {
        guard let tiff = tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff) else { return nil }
        return bitmap.representation(using: .png, properties: [:])
    }
}
#endif
