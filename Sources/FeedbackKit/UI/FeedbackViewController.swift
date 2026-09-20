#if os(iOS)
import AVFoundation
import UIKit
import UniformTypeIdentifiers

/// The full-screen capture/annotate/describe/submit flow. Not part of the
/// public API — presented and dismissed by `FeedbackKit`.
final class FeedbackViewController: UIViewController {
    private let rawScreenshot: UIImage
    private let screenNameOverride: String?
    private let onComplete: (FeedbackReport?) -> Void

    private let headerView = UIView()
    private let titleLabel = UILabel()
    private let cancelButton = UIButton(type: .system)
    private let includeScreenshotLabel = UILabel()
    private let includeScreenshotToggle = UISwitch()

    private let screenshotBoundsView = UIView()
    private let imageView = UIImageView()
    private let deviceFrameView = UIView()
    private let cameraIslandView = UIView()
    private let canvasView = AnnotationCanvasView()

    private let toolbar = AnnotationToolbar()

    // A compact, chat-style composer: an optional attachment chip, a
    // single-line-by-default text view that grows as the user types, and a
    // second row below it with an attach button and a send button — rather
    // than a big fixed-height text box with a full-width submit button below.
    private let composerContainer = UIView()
    private let composerStack = UIStackView()
    private let attachmentChipView = UIView()
    private let attachmentNameLabel = UILabel()
    private let removeAttachmentButton = UIButton(type: .system)
    private let placeholderLabel = UILabel()
    private let textView = UITextView()
    private let attachButton = UIButton(type: .system)
    private let sendButton = UIButton(type: .system)

    private var pickedAttachment: (filename: String, mimeType: String, data: Data)?

    // The composer's top edge either follows the screenshot area (screenshot
    // included) or sits right under the header (screenshot excluded) —
    // exactly one of these is active at a time, swapped in `toggleChanged()`.
    private var composerTopToScreenshotConstraint: NSLayoutConstraint!
    private var composerTopToHeaderConstraint: NSLayoutConstraint!
    private var toolbarTopConstraint: NSLayoutConstraint!
    private var toolbarBottomConstraint: NSLayoutConstraint!

    init(rawScreenshot: UIImage, screenNameOverride: String?, onComplete: @escaping (FeedbackReport?) -> Void) {
        self.rawScreenshot = rawScreenshot
        self.screenNameOverride = screenNameOverride
        self.onComplete = onComplete
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        imageView.image = rawScreenshot
        imageView.contentMode = .scaleAspectFit
        buildHeader()
        buildScreenshotArea()
        buildToolbar()
        buildComposer()
        layoutAll()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        let outerRect = AVMakeRect(
            aspectRatio: rawScreenshot.size,
            insideRect: screenshotBoundsView.bounds
        )

        // A real bezel sits outside the screen, not painted over it, so the
        // screenshot is inset within the frame rather than sharing its bounds
        // — otherwise a bezel thick enough to read as a phone body would eat
        // into the screenshot content instead of surrounding it.
        let bezelWidth = outerRect.width * 0.045
        let innerRect = outerRect.insetBy(dx: bezelWidth, dy: bezelWidth)

        imageView.frame = innerRect
        canvasView.frame = innerRect

        deviceFrameView.frame = outerRect
        deviceFrameView.layer.borderWidth = bezelWidth
        deviceFrameView.layer.cornerRadius = outerRect.width * 0.13

        let innerCornerRadius = max(deviceFrameView.layer.cornerRadius - bezelWidth, 0)
        imageView.layer.cornerRadius = innerCornerRadius
        canvasView.layer.cornerRadius = innerCornerRadius

        // Positioned/sized proportionally to the screen area so it tracks an
        // iPhone's actual Dynamic Island proportions regardless of the
        // screenshot's own resolution.
        let islandWidth = innerRect.width * 0.32
        let islandHeight = islandWidth * 0.29
        cameraIslandView.frame = CGRect(
            x: innerRect.minX + (innerRect.width - islandWidth) / 2,
            y: innerRect.minY + islandHeight * 0.4,
            width: islandWidth,
            height: islandHeight
        )
        cameraIslandView.layer.cornerRadius = islandHeight / 2
    }

    // MARK: - Building

    private func buildHeader() {
        titleLabel.text = "Report Feedback"
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.addAction(UIAction { [weak self] _ in self?.cancelTapped() }, for: .touchUpInside)

        includeScreenshotLabel.text = "Screenshot"
        includeScreenshotLabel.font = .preferredFont(forTextStyle: .footnote)
        includeScreenshotLabel.textColor = .secondaryLabel
        includeScreenshotToggle.isOn = true
        includeScreenshotToggle.addAction(UIAction { [weak self] _ in self?.toggleScreenshotChanged() }, for: .valueChanged)

        headerView.addSubview(titleLabel)
        headerView.addSubview(cancelButton)
        headerView.addSubview(includeScreenshotLabel)
        headerView.addSubview(includeScreenshotToggle)
        view.addSubview(headerView)
    }

    private func buildScreenshotArea() {
        // An actual iPhone-shaped bezel — thick and dark, like a real device
        // body — traced around the fitted screenshot, including a Dynamic
        // Island cutout, so this genuinely reads as "a phone" rather than a
        // faint outline, and shows where the screen/camera island would sit.
        deviceFrameView.isUserInteractionEnabled = false
        deviceFrameView.backgroundColor = .clear
        deviceFrameView.layer.borderColor = UIColor.black.cgColor
        deviceFrameView.layer.cornerCurve = .continuous

        imageView.clipsToBounds = true
        imageView.layer.cornerCurve = .continuous
        canvasView.clipsToBounds = true
        canvasView.layer.cornerCurve = .continuous

        cameraIslandView.isUserInteractionEnabled = false
        cameraIslandView.backgroundColor = .black

        screenshotBoundsView.addSubview(imageView)
        screenshotBoundsView.addSubview(deviceFrameView)
        canvasView.onRequestTextInput = { [weak self] location, completion in
            self?.presentTextPrompt(completion: completion)
        }
        screenshotBoundsView.addSubview(canvasView)
        screenshotBoundsView.addSubview(cameraIslandView)
        view.addSubview(screenshotBoundsView)
    }

    private func buildToolbar() {
        toolbar.layer.cornerRadius = 12
        toolbar.clipsToBounds = true
        toolbar.onToolSelected = { [weak self] tool in self?.canvasView.tool = tool }
        toolbar.onColorSelected = { [weak self] color in self?.canvasView.strokeColor = color }
        toolbar.onUndo = { [weak self] in self?.canvasView.undoLast() }
        view.addSubview(toolbar)
    }

    private func buildComposer() {
        composerContainer.layer.borderColor = UIColor.separator.cgColor
        composerContainer.layer.borderWidth = 1
        composerContainer.layer.cornerRadius = 16

        buildAttachmentChip()

        textView.font = .preferredFont(forTextStyle: .body)
        textView.backgroundColor = .clear
        textView.delegate = self
        textView.isScrollEnabled = false
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.heightAnchor.constraint(greaterThanOrEqualToConstant: 24).isActive = true
        textView.heightAnchor.constraint(lessThanOrEqualToConstant: 120).isActive = true

        placeholderLabel.text = "What's the problem?"
        placeholderLabel.font = .preferredFont(forTextStyle: .body)
        placeholderLabel.textColor = .placeholderText

        let iconConfig = UIImage.SymbolConfiguration(pointSize: 26)
        attachButton.setImage(UIImage(systemName: "plus.circle.fill"), for: .normal)
        attachButton.setPreferredSymbolConfiguration(iconConfig, forImageIn: .normal)
        attachButton.tintColor = .secondaryLabel
        attachButton.addAction(UIAction { [weak self] _ in self?.attachTapped() }, for: .touchUpInside)

        sendButton.setImage(UIImage(systemName: "arrow.up.circle.fill"), for: .normal)
        sendButton.setPreferredSymbolConfiguration(iconConfig, forImageIn: .normal)
        sendButton.tintColor = .systemBlue
        sendButton.addAction(UIAction { [weak self] _ in self?.submitTapped() }, for: .touchUpInside)

        // Attach on the left, send on the right — the composer's "second row".
        let buttonRow = UIStackView(arrangedSubviews: [attachButton, UIView(), sendButton])
        buttonRow.axis = .horizontal
        buttonRow.alignment = .center

        composerStack.axis = .vertical
        composerStack.spacing = 8
        composerStack.addArrangedSubview(attachmentChipView)
        composerStack.addArrangedSubview(textView)
        composerStack.addArrangedSubview(buttonRow)
        composerContainer.addSubview(composerStack)
        composerContainer.addSubview(placeholderLabel)
        view.addSubview(composerContainer)
    }

    private func buildAttachmentChip() {
        attachmentChipView.backgroundColor = .secondarySystemBackground
        attachmentChipView.layer.cornerRadius = 8
        attachmentChipView.isHidden = true

        let paperclip = UIImageView(image: UIImage(systemName: "paperclip"))
        paperclip.tintColor = .secondaryLabel
        paperclip.setContentHuggingPriority(.required, for: .horizontal)

        attachmentNameLabel.font = .preferredFont(forTextStyle: .caption1)
        attachmentNameLabel.textColor = .secondaryLabel
        attachmentNameLabel.numberOfLines = 1
        attachmentNameLabel.lineBreakMode = .byTruncatingMiddle

        removeAttachmentButton.setImage(UIImage(systemName: "xmark.circle.fill"), for: .normal)
        removeAttachmentButton.tintColor = .secondaryLabel
        removeAttachmentButton.setContentHuggingPriority(.required, for: .horizontal)
        removeAttachmentButton.addAction(UIAction { [weak self] _ in self?.clearAttachment() }, for: .touchUpInside)

        let chipStack = UIStackView(arrangedSubviews: [paperclip, attachmentNameLabel, removeAttachmentButton])
        chipStack.axis = .horizontal
        chipStack.spacing = 6
        chipStack.alignment = .center
        chipStack.translatesAutoresizingMaskIntoConstraints = false
        attachmentChipView.addSubview(chipStack)

        NSLayoutConstraint.activate([
            chipStack.leadingAnchor.constraint(equalTo: attachmentChipView.leadingAnchor, constant: 8),
            chipStack.trailingAnchor.constraint(equalTo: attachmentChipView.trailingAnchor, constant: -8),
            chipStack.topAnchor.constraint(equalTo: attachmentChipView.topAnchor, constant: 4),
            chipStack.bottomAnchor.constraint(equalTo: attachmentChipView.bottomAnchor, constant: -4)
        ])
    }

    private func layoutAll() {
        [headerView, titleLabel, cancelButton, includeScreenshotLabel, includeScreenshotToggle,
         screenshotBoundsView, toolbar, composerContainer, composerStack, textView, placeholderLabel].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
        }

        let safe = view.safeAreaLayoutGuide

        // Exactly one of these is active at a time (see `toggleScreenshotChanged`).
        // `toolbarBottomConstraint` travels with the screenshot-included state
        // too — without it, the toolbar's top (pinned to the header) would sit
        // below its bottom (pinned to the composer) once the composer moves up
        // to fill the excluded screenshot's space, an unsatisfiable constraint.
        composerTopToScreenshotConstraint = composerContainer.topAnchor.constraint(
            equalTo: screenshotBoundsView.bottomAnchor, constant: 8
        )
        composerTopToHeaderConstraint = composerContainer.topAnchor.constraint(
            equalTo: headerView.bottomAnchor, constant: 8
        )
        toolbarTopConstraint = toolbar.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 8)
        toolbarBottomConstraint = toolbar.bottomAnchor.constraint(equalTo: composerContainer.topAnchor, constant: -8)
        composerTopToHeaderConstraint.isActive = false

        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: safe.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 44),

            titleLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            cancelButton.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            cancelButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            includeScreenshotToggle.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -16),
            includeScreenshotToggle.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            includeScreenshotLabel.trailingAnchor.constraint(
                equalTo: includeScreenshotToggle.leadingAnchor, constant: -8
            ),
            includeScreenshotLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            // The toolbar sits beside the screenshot, not under it — a portrait
            // screenshot's aspect-fit frame rarely uses the full width, so this
            // reclaims that leftover horizontal margin as vertical space for
            // the screenshot instead of spending a horizontal strip on it.
            screenshotBoundsView.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 8),
            screenshotBoundsView.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            screenshotBoundsView.trailingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: -4),
            composerTopToScreenshotConstraint,

            toolbarTopConstraint,
            toolbar.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -4),
            toolbarBottomConstraint,
            toolbar.widthAnchor.constraint(equalToConstant: 56),

            // No fixed height here on purpose: the composer sizes itself from
            // its content (attachment chip + text view + button row), so it
            // stays compact as a single line and only grows as the user types.
            composerContainer.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            composerContainer.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -16),
            composerContainer.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -12),

            composerStack.leadingAnchor.constraint(equalTo: composerContainer.leadingAnchor, constant: 12),
            composerStack.trailingAnchor.constraint(equalTo: composerContainer.trailingAnchor, constant: -12),
            composerStack.topAnchor.constraint(equalTo: composerContainer.topAnchor, constant: 10),
            composerStack.bottomAnchor.constraint(equalTo: composerContainer.bottomAnchor, constant: -10),

            placeholderLabel.topAnchor.constraint(equalTo: textView.topAnchor),
            placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor),
            placeholderLabel.trailingAnchor.constraint(lessThanOrEqualTo: textView.trailingAnchor)
        ])
    }

    // MARK: - Actions

    private func presentTextPrompt(completion: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: "Add a note", message: nil, preferredStyle: .alert)
        alert.addTextField()
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completion(nil) })
        alert.addAction(UIAlertAction(title: "Add", style: .default) { _ in
            completion(alert.textFields?.first?.text)
        })
        present(alert, animated: true)
    }

    private func cancelTapped() {
        dismiss(animated: true) { [weak self] in self?.onComplete(nil) }
    }

    private func attachTapped() {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.delegate = self
        present(picker, animated: true)
    }

    private func clearAttachment() {
        pickedAttachment = nil
        attachmentChipView.isHidden = true
    }

    private func toggleScreenshotChanged() {
        let included = includeScreenshotToggle.isOn
        screenshotBoundsView.isHidden = !included
        toolbar.isHidden = !included
        composerTopToScreenshotConstraint.isActive = included
        toolbarTopConstraint.isActive = included
        toolbarBottomConstraint.isActive = included
        composerTopToHeaderConstraint.isActive = !included

        UIView.animate(withDuration: 0.2) { [self] in
            view.layoutIfNeeded()
        }
    }

    private func submitTapped() {
        var rawPNG: Data?
        var annotatedPNG: Data?
        var annotations: [FeedbackAnnotation] = []

        if includeScreenshotToggle.isOn {
            let flattened = canvasView.flattenedImage(baseImage: rawScreenshot)
            guard let raw = rawScreenshot.pngData(), let annotated = flattened.pngData() else {
                dismiss(animated: true) { [weak self] in self?.onComplete(nil) }
                return
            }
            rawPNG = raw
            annotatedPNG = annotated
            annotations = canvasView.completedAnnotations
        }

        let attachment = pickedAttachment.map {
            FeedbackAttachment(filename: $0.filename, mimeType: $0.mimeType, data: $0.data)
        }

        let report = FeedbackReport(
            text: textView.text ?? "",
            screenshotRawPNG: rawPNG,
            screenshotAnnotatedPNG: annotatedPNG,
            annotations: annotations,
            environment: EnvironmentInfo.current(screenName: screenNameOverride),
            attachment: attachment
        )

        dismiss(animated: true) { [weak self] in self?.onComplete(report) }
    }
}

extension FeedbackViewController: UITextViewDelegate {
    func textViewDidChange(_ textView: UITextView) {
        placeholderLabel.isHidden = !textView.text.isEmpty
        textView.invalidateIntrinsicContentSize()
        let contentHeight = textView.sizeThatFits(CGSize(width: textView.bounds.width, height: .greatestFiniteMagnitude)).height
        textView.isScrollEnabled = contentHeight > 120
    }
}

extension FeedbackViewController: UIDocumentPickerDelegate {
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first, let data = try? Data(contentsOf: url) else { return }
        let filename = url.lastPathComponent
        let mimeType = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        pickedAttachment = (filename: filename, mimeType: mimeType, data: data)
        attachmentNameLabel.text = filename
        attachmentChipView.isHidden = false
    }
}
#endif
