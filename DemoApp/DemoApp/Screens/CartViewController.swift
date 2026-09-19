import FeedbackKit
import SwiftUI
import UIKit

/// A plain UIKit screen — see `HomeView` for the SwiftUI equivalent. Both use
/// the exact same FeedbackKit.present(from:) call.
final class CartViewController: UIViewController {
    private struct CartItem {
        let name: String
        let price: Double
        let quantity: Int
        let icon: String
        let tint: UIColor
    }

    // Fake cart contents, just so this reads like a real shopping cart
    // instead of an empty-state placeholder.
    private let items: [CartItem] = [
        CartItem(name: "Wireless Headphones", price: 59.99, quantity: 1, icon: "headphones", tint: .systemPurple),
        CartItem(name: "Canvas Tote Bag", price: 24.99, quantity: 2, icon: "bag.fill", tint: .systemGreen),
        CartItem(name: "Classic T-Shirt", price: 19.99, quantity: 1, icon: "tshirt.fill", tint: .systemOrange)
    ]

    private let cellReuseIdentifier = "CartItemCell"
    private let tableView = UITableView(frame: .zero, style: .plain)
    private let footerView = UIView()
    private let subtotalLabel = UILabel()
    private let reportButton: UIButton = {
        var config = UIButton.Configuration.filled()
        config.title = "Report a Problem"
        return UIButton(configuration: config)
    }()

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
        subtotalLabel.text = "Subtotal: \(subtotalText)"

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

    private var subtotalText: String {
        items.reduce(0) { $0 + $1.price * Double($1.quantity) }.formatted(.currency(code: "USD"))
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
        FeedbackKit.present(from: self) { report in
            guard let report else { return }
            print("[FeedbackKit demo] captured report \(report.id) — \"\(report.text)\"")
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
        config.imageProperties.tintColor = item.tint
        cell.contentConfiguration = config

        return cell
    }
}

struct CartViewControllerRepresentable: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UINavigationController {
        UINavigationController(rootViewController: CartViewController())
    }

    func updateUIViewController(_ uiViewController: UINavigationController, context: Context) {}
}
