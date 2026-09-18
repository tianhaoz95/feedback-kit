import AVFoundation
import UIKit

/// The full-screen capture/annotate/describe/submit flow. Not part of the
/// public API — presented and dismissed by `FeedbackKit`.
final class FeedbackViewController: UIViewController {
    private let rawScreenshot: UIImage
    private let screenNameOverride: String?
    private let onComplete: (FeedbackReport?) -> Void

    private let headerView = UIView()
    private let titleLabel = UILabel()
    private let cancelButton = UIButton(type: .system)

    private let screenshotBoundsView = UIView()
    private let imageView = UIImageView()
    private let deviceFrameView = UIView()
    private let cameraIslandView = UIView()
    private let canvasView = AnnotationCanvasView()

    private let toolbar = AnnotationToolbar()

    private let textViewContainer = UIView()
    private let placeholderLabel = UILabel()
    private let textView = UITextView()

    private let submitButton = UIButton(type: .system)

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
        buildTextInput()
        buildSubmitButton()
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
        headerView.addSubview(titleLabel)
        headerView.addSubview(cancelButton)
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

    private func buildTextInput() {
        textViewContainer.layer.borderColor = UIColor.separator.cgColor
        textViewContainer.layer.borderWidth = 1
        textViewContainer.layer.cornerRadius = 8

        textView.font = .preferredFont(forTextStyle: .body)
        textView.backgroundColor = .clear
        textView.delegate = self

        placeholderLabel.text = "What's the problem? Be as specific as you can."
        placeholderLabel.font = .preferredFont(forTextStyle: .body)
        placeholderLabel.textColor = .placeholderText
        placeholderLabel.numberOfLines = 0

        textViewContainer.addSubview(textView)
        textViewContainer.addSubview(placeholderLabel)
        view.addSubview(textViewContainer)
    }

    private func buildSubmitButton() {
        var config = UIButton.Configuration.filled()
        config.title = "Submit Feedback"
        config.cornerStyle = .medium
        submitButton.configuration = config
        submitButton.addAction(UIAction { [weak self] _ in self?.submitTapped() }, for: .touchUpInside)
        view.addSubview(submitButton)
    }

    private func layoutAll() {
        [headerView, titleLabel, cancelButton, screenshotBoundsView, toolbar,
         textViewContainer, textView, placeholderLabel, submitButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
        }

        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: safe.topAnchor),
            headerView.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            headerView.heightAnchor.constraint(equalToConstant: 44),

            titleLabel.centerXAnchor.constraint(equalTo: headerView.centerXAnchor),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            cancelButton.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            cancelButton.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),

            // The toolbar sits beside the screenshot, not under it — a portrait
            // screenshot's aspect-fit frame rarely uses the full width, so this
            // reclaims that leftover horizontal margin as vertical space for
            // the screenshot instead of spending a horizontal strip on it.
            screenshotBoundsView.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 8),
            screenshotBoundsView.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            screenshotBoundsView.trailingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: -4),
            screenshotBoundsView.bottomAnchor.constraint(equalTo: textViewContainer.topAnchor, constant: -8),

            toolbar.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 8),
            toolbar.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -4),
            toolbar.bottomAnchor.constraint(equalTo: textViewContainer.topAnchor, constant: -8),
            toolbar.widthAnchor.constraint(equalToConstant: 56),

            textViewContainer.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            textViewContainer.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -16),
            textViewContainer.heightAnchor.constraint(equalToConstant: 100),
            textViewContainer.bottomAnchor.constraint(equalTo: submitButton.topAnchor, constant: -12),

            textView.topAnchor.constraint(equalTo: textViewContainer.topAnchor, constant: 4),
            textView.leadingAnchor.constraint(equalTo: textViewContainer.leadingAnchor, constant: 8),
            textView.trailingAnchor.constraint(equalTo: textViewContainer.trailingAnchor, constant: -8),
            textView.bottomAnchor.constraint(equalTo: textViewContainer.bottomAnchor, constant: -4),

            placeholderLabel.topAnchor.constraint(equalTo: textView.topAnchor, constant: 8),
            placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor, constant: 4),
            placeholderLabel.trailingAnchor.constraint(equalTo: textView.trailingAnchor, constant: -4),

            submitButton.leadingAnchor.constraint(equalTo: safe.leadingAnchor, constant: 16),
            submitButton.trailingAnchor.constraint(equalTo: safe.trailingAnchor, constant: -16),
            submitButton.bottomAnchor.constraint(equalTo: safe.bottomAnchor, constant: -12),
            submitButton.heightAnchor.constraint(equalToConstant: 48)
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

    private func submitTapped() {
        let flattened = canvasView.flattenedImage(baseImage: rawScreenshot)
        guard
            let rawPNG = rawScreenshot.pngData(),
            let annotatedPNG = flattened.pngData()
        else {
            dismiss(animated: true) { [weak self] in self?.onComplete(nil) }
            return
        }

        let report = FeedbackReport(
            text: textView.text ?? "",
            screenshotRawPNG: rawPNG,
            screenshotAnnotatedPNG: annotatedPNG,
            annotations: canvasView.completedAnnotations,
            environment: EnvironmentInfo.current(screenName: screenNameOverride)
        )

        dismiss(animated: true) { [weak self] in self?.onComplete(report) }
    }
}

extension FeedbackViewController: UITextViewDelegate {
    func textViewDidChange(_ textView: UITextView) {
        placeholderLabel.isHidden = !textView.text.isEmpty
    }
}
