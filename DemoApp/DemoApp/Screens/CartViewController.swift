import FeedbackKit
import SwiftUI
import UIKit

/// A plain UIKit screen — see `HomeView` for the SwiftUI equivalent. Both use
/// the exact same FeedbackKit.present(from:) call.
final class CartViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "Cart"

        let label = UILabel()
        label.text = "Your cart is empty.\n\nThis screen is plain UIKit, demonstrating that FeedbackKit's screenshot capture works identically regardless of whether a screen was built with UIKit or SwiftUI."
        label.numberOfLines = 0
        label.textAlignment = .center

        var buttonConfig = UIButton.Configuration.filled()
        buttonConfig.title = "Report a Problem"
        let reportButton = UIButton(configuration: buttonConfig)
        reportButton.addTarget(self, action: #selector(reportTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [label, reportButton])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 24
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24)
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        FeedbackKit.currentScreen = "Cart"
    }

    @objc private func reportTapped() {
        FeedbackKit.present(from: self) { report in
            guard let report else { return }
            print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
        }
    }
}

struct CartViewControllerRepresentable: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UINavigationController {
        UINavigationController(rootViewController: CartViewController())
    }

    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}
}
