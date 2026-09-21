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
    private let includeScreenshotLabel = NSTextField(labelWithString: "Screenshot")
    private let includeScreenshotToggle = NSSwitch()
    private let screenshotBoundsView = ScreenshotBoundsView()
    private let toolbar = AnnotationToolbar()

    // Exactly one of the "ToScreenshot"/"ToHeader" pair is active at a time
    // (see `toggleScreenshotChanged`); `toolbarBottomConstraint` travels with
    // them since it also anchors to `screenshotBoundsView`, which otherwise
    // goes unconstrained on the excluded side.
    private var composerTopToScreenshotConstraint: NSLayoutConstraint!
    private var composerTopToHeaderConstraint: NSLayoutConstraint!
    private var toolbarBottomConstraint: NSLayoutConstraint!

    private let composerContainer = FlippedView()
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
        window.minSize = NSSize(width: 600, height: 520)
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

        includeScreenshotLabel.textColor = .secondaryLabelColor
        includeScreenshotLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        includeScreenshotToggle.state = .on
        includeScreenshotToggle.target = self
        includeScreenshotToggle.action = #selector(toggleScreenshotChanged)
        root.addSubview(includeScreenshotLabel)
        root.addSubview(includeScreenshotToggle)
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
        composerContainer.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        composerContainer.layer?.borderColor = NSColor.separatorColor.cgColor
        composerContainer.layer?.borderWidth = 1
        composerContainer.layer?.cornerRadius = 14

        buildAttachmentChip()

        textView.delegate = self
        textView.isRichText = false
        textView.font = .systemFont(ofSize: NSFont.systemFontSize)
        textView.textColor = .labelColor
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
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        let heightConstraint = scrollView.heightAnchor.constraint(equalToConstant: 24)
        heightConstraint.priority = .defaultHigh
        heightConstraint.isActive = true
        textViewHeightConstraint = heightConstraint

        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        placeholderLabel.textColor = .placeholderTextColor
        placeholderLabel.font = .systemFont(ofSize: NSFont.systemFontSize)
        placeholderLabel.isBordered = false
        placeholderLabel.isEditable = false
        placeholderLabel.backgroundColor = .clear

        let iconConfig = NSImage.SymbolConfiguration(pointSize: 22, weight: .regular)
        attachButton.translatesAutoresizingMaskIntoConstraints = false
        attachButton.image = NSImage(systemSymbolName: "plus.circle.fill", accessibilityDescription: "Attach")?
            .withSymbolConfiguration(iconConfig)
        attachButton.isBordered = false
        attachButton.imagePosition = .imageOnly
        attachButton.contentTintColor = .secondaryLabelColor
        attachButton.target = self
        attachButton.action = #selector(attachTapped)
        attachButton.widthAnchor.constraint(equalToConstant: 24).isActive = true
        attachButton.heightAnchor.constraint(equalToConstant: 24).isActive = true

        sendButton.translatesAutoresizingMaskIntoConstraints = false
        sendButton.image = NSImage(systemSymbolName: "arrow.up.circle.fill", accessibilityDescription: "Send")?
            .withSymbolConfiguration(iconConfig)
        sendButton.isBordered = false
        sendButton.imagePosition = .imageOnly
        sendButton.contentTintColor = .controlAccentColor
        sendButton.target = self
        sendButton.action = #selector(submitTapped)
        sendButton.widthAnchor.constraint(equalToConstant: 24).isActive = true
        sendButton.heightAnchor.constraint(equalToConstant: 24).isActive = true

        let buttonRow = NSView()
        buttonRow.translatesAutoresizingMaskIntoConstraints = false
        buttonRow.addSubview(attachButton)
        buttonRow.addSubview(sendButton)

        NSLayoutConstraint.activate([
            attachButton.leadingAnchor.constraint(equalTo: buttonRow.leadingAnchor),
            attachButton.topAnchor.constraint(equalTo: buttonRow.topAnchor),
            attachButton.bottomAnchor.constraint(equalTo: buttonRow.bottomAnchor),

            sendButton.trailingAnchor.constraint(equalTo: buttonRow.trailingAnchor),
            sendButton.topAnchor.constraint(equalTo: buttonRow.topAnchor),
            sendButton.bottomAnchor.constraint(equalTo: buttonRow.bottomAnchor),

            buttonRow.heightAnchor.constraint(equalToConstant: 24)
        ])

        let composerStack = NSStackView(views: [attachmentChipView, scrollView, buttonRow])
        composerStack.orientation = .vertical
        composerStack.spacing = 8
        composerStack.translatesAutoresizingMaskIntoConstraints = false
        composerContainer.addSubview(composerStack)
        composerContainer.addSubview(placeholderLabel)

        let minHeightConstraint = composerContainer.heightAnchor.constraint(greaterThanOrEqualToConstant: 78)
        minHeightConstraint.priority = .required

        NSLayoutConstraint.activate([
            minHeightConstraint,

            composerStack.leadingAnchor.constraint(equalTo: composerContainer.leadingAnchor, constant: 14),
            composerStack.trailingAnchor.constraint(equalTo: composerContainer.trailingAnchor, constant: -14),
            composerStack.topAnchor.constraint(equalTo: composerContainer.topAnchor, constant: 10),
            composerStack.bottomAnchor.constraint(equalTo: composerContainer.bottomAnchor, constant: -10),

            placeholderLabel.topAnchor.constraint(equalTo: scrollView.topAnchor),
            placeholderLabel.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            placeholderLabel.trailingAnchor.constraint(lessThanOrEqualTo: scrollView.trailingAnchor)
        ])

        composerContainer.setContentCompressionResistancePriority(.required, for: .vertical)
        composerContainer.setContentHuggingPriority(.defaultHigh, for: .vertical)

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
        [cancelButton, includeScreenshotLabel, includeScreenshotToggle,
         screenshotBoundsView, toolbar, composerContainer].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
        }

        composerTopToScreenshotConstraint = composerContainer.topAnchor.constraint(
            equalTo: screenshotBoundsView.bottomAnchor, constant: 12
        )
        composerTopToHeaderConstraint = composerContainer.topAnchor.constraint(
            equalTo: cancelButton.bottomAnchor, constant: 12
        )
        toolbarBottomConstraint = toolbar.bottomAnchor.constraint(
            lessThanOrEqualTo: composerContainer.topAnchor, constant: -12
        )
        composerTopToHeaderConstraint.isActive = false

        screenshotBoundsView.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        screenshotBoundsView.setContentHuggingPriority(.defaultLow, for: .vertical)

        let toolbarMatchScreenshot = toolbar.bottomAnchor.constraint(equalTo: screenshotBoundsView.bottomAnchor)
        toolbarMatchScreenshot.priority = .defaultHigh

        NSLayoutConstraint.activate([
            cancelButton.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            cancelButton.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),

            includeScreenshotToggle.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            includeScreenshotToggle.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            includeScreenshotLabel.centerYAnchor.constraint(equalTo: includeScreenshotToggle.centerYAnchor),
            includeScreenshotLabel.trailingAnchor.constraint(
                equalTo: includeScreenshotToggle.leadingAnchor, constant: -8
            ),

            // screenshotBoundsView itself is Auto-Layout-positioned; the
            // image/canvas pair inside it are frame-based (see
            // ScreenshotBoundsView.layout()) since their aspect-fit rect is
            // computed from the screenshot's aspect ratio, not expressible
            // as a static constraint — same reason the iOS implementation
            // recomputes it in `viewDidLayoutSubviews` instead.
            screenshotBoundsView.topAnchor.constraint(equalTo: cancelButton.bottomAnchor, constant: 12),
            screenshotBoundsView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            screenshotBoundsView.trailingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: -12),
            composerTopToScreenshotConstraint,

            toolbar.topAnchor.constraint(equalTo: screenshotBoundsView.topAnchor),
            toolbar.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            toolbarBottomConstraint,
            toolbarMatchScreenshot,
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

    @objc private func toggleScreenshotChanged() {
        let included = includeScreenshotToggle.state == .on
        screenshotBoundsView.isHidden = !included
        toolbar.isHidden = !included
        composerTopToScreenshotConstraint.isActive = included
        toolbarBottomConstraint.isActive = included
        composerTopToHeaderConstraint.isActive = !included
    }

    @objc private func submitTapped() {
        var rawPNG: Data?
        var annotatedPNG: Data?
        var annotations: [FeedbackAnnotation] = []

        if includeScreenshotToggle.state == .on {
            let flattened = screenshotBoundsView.canvasView.flattenedImage(baseImage: rawScreenshot)
            guard let raw = rawScreenshot.pngData(), let annotated = flattened.pngData() else {
                dismiss()
                onComplete(nil)
                return
            }
            rawPNG = raw
            annotatedPNG = annotated
            annotations = screenshotBoundsView.canvasView.completedAnnotations
        }

        let attachment = pickedAttachment.map {
            FeedbackAttachment(filename: $0.filename, mimeType: $0.mimeType, data: $0.data)
        }

        let report = FeedbackReport(
            text: textView.string,
            screenshotRawPNG: rawPNG,
            screenshotAnnotatedPNG: annotatedPNG,
            annotations: annotations,
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

private final class FlippedView: NSView {
    override var isFlipped: Bool { true }
}
#endif
