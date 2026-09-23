import Combine
import FeedbackKit
import SwiftUI
import UIKit

/// A plain UIKit screen — see `HomeView` for the SwiftUI equivalent. Both use
/// the exact same FeedbackKit.present(from:) call. Observes the same
/// `CartStore` Home's "Add" buttons write to, via a plain Combine
/// subscription (SwiftUI's `@ObservedObject` isn't available here).
final class CartViewController: UIViewController {
    private let cellReuseIdentifier = "CartItemCell"
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let footerView = UIView()
    private let subtotalLabel = UILabel()
    private let reportButton: UIButton = {
        var config = UIButton.Configuration.filled()
        config.title = "Report a Problem"
        return UIButton(configuration: config)
    }()

    private var items: [CartStore.Item] = []
    private var cancellable: AnyCancellable?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "Cart"

        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "questionmark.circle"),
            style: .plain,
            target: self,
            action: #selector(infoTapped)
        )

        setUpTableView()
        setUpFooter()
        layoutAll()

        cancellable = CartStore.shared.$items
            .receive(on: DispatchQueue.main)
            .sink { [weak self] items in
                self?.items = items
                self?.tableView.reloadData()
                self?.updateEmptyState()
            }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        FeedbackKit.currentScreen = "Cart"
    }

    private func setUpTableView() {
        tableView.dataSource = self
        tableView.rowHeight = 72
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: cellReuseIdentifier)
        view.addSubview(tableView)
    }

    private func setUpFooter() {
        subtotalLabel.font = .preferredFont(forTextStyle: .headline)

        reportButton.addTarget(self, action: #selector(reportTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [subtotalLabel, reportButton])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false

        footerView.backgroundColor = .secondarySystemBackground
        footerView.addSubview(stack)
        view.addSubview(footerView)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: footerView.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: footerView.trailingAnchor, constant: -16),
            stack.topAnchor.constraint(equalTo: footerView.topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: footerView.safeAreaLayoutGuide.bottomAnchor, constant: -16)
        ])
    }

    private func layoutAll() {
        [tableView, footerView].forEach { $0.translatesAutoresizingMaskIntoConstraints = false }

        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: footerView.topAnchor),

            footerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            footerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            footerView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    /// Shows a real empty-state message in place of the row list once
    /// everything's been swiped away, rather than just a blank table.
    private func updateEmptyState() {
        subtotalLabel.text = "Subtotal: \(CartStore.shared.subtotal.formatted(.currency(code: "USD")))"

        guard items.isEmpty else {
            tableView.backgroundView = nil
            return
        }

        let emptyLabel = UILabel()
        emptyLabel.text = "Your cart is empty.\nAdd something from Home to see it here."
        emptyLabel.numberOfLines = 0
        emptyLabel.textAlignment = .center
        emptyLabel.font = .preferredFont(forTextStyle: .subheadline)
        emptyLabel.textColor = .secondaryLabel
        tableView.backgroundView = emptyLabel
    }

    @objc private func infoTapped() {
        let alert = UIAlertController(
            title: "About this screen",
            message: "This screen is plain UIKit, demonstrating that FeedbackKit's screenshot capture works "
                + "identically regardless of whether a screen was built with UIKit or SwiftUI.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Got it", style: .default))
        present(alert, animated: true)
    }

    @objc private func reportTapped() {
        FeedbackKit.presentAndSubmitIfConfigured(from: self) { result in
            guard let result else { return }
            switch result {
            case .success(let report):
                print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
            case .failure(let error):
                print("[FeedbackKit demo] report failed: \(error)")
            }
        }
    }
}

extension CartViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        items.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let item = items[indexPath.row]
        let cell = tableView.dequeueReusableCell(withIdentifier: cellReuseIdentifier, for: indexPath)

        var config = UIListContentConfiguration.subtitleCell()
        config.text = item.name
        config.secondaryText = "Qty \(item.quantity) · \(item.price.formatted(.currency(code: "USD")))"
        config.image = UIImage(systemName: item.icon)
        config.imageProperties.tintColor = UIColor(item.tint)
        cell.contentConfiguration = config

        return cell
    }

    func tableView(
        _ tableView: UITableView,
        commit editingStyle: UITableViewCell.EditingStyle,
        forRowAt indexPath: IndexPath
    ) {
        guard editingStyle == .delete else { return }
        CartStore.shared.remove(at: indexPath.row)
    }
}

struct CartViewControllerRepresentable: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UINavigationController {
        UINavigationController(rootViewController: CartViewController())
    }

    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}
}
