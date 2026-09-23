#if os(iOS)
import UIKit

public enum DemoNotifier {
    public static func notify(title: String, message: String) {
        DispatchQueue.main.async {
            guard let vc = UIApplication.shared.topMostViewController else { return }
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            vc.present(alert, animated: true)
        }
    }
}
#elseif os(macOS)
import AppKit

public enum DemoNotifier {
    public static func notify(title: String, message: String) {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = title
            alert.informativeText = message
            alert.alertStyle = .informational
            alert.addButton(withTitle: "OK")
            if let window = NSApplication.shared.keyWindow {
                alert.beginSheetModal(for: window)
            } else {
                alert.runModal()
            }
        }
    }
}
#endif
