import CoreGraphics
import Foundation

#if os(iOS)
import UIKit

typealias PlatformFont = UIFont
typealias PlatformColor = UIColor
#elseif os(macOS)
import AppKit

typealias PlatformFont = NSFont
typealias PlatformColor = NSColor
#endif

// `UIColor` and `NSColor` happen to share the exact same
// `init(red:green:blue:alpha:)` / `getRed(_:green:blue:alpha:)` signatures,
// so this hex <-> color conversion (used by the annotation tool color
// swatches and by `AnnotationRenderer`) is written once here rather than
// duplicated per platform.
extension PlatformColor {
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        guard hexSanitized.count == 6, let rgb = UInt32(hexSanitized, radix: 16) else { return nil }
        self.init(
            red: CGFloat((rgb & 0xFF0000) >> 16) / 255,
            green: CGFloat((rgb & 0x00FF00) >> 8) / 255,
            blue: CGFloat(rgb & 0x0000FF) / 255,
            alpha: 1
        )
    }

    var hexString: String {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        #if os(macOS)
        (usingColorSpace(.deviceRGB) ?? self).getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        #else
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        #endif
        return String(format: "#%02X%02X%02X", Int(red * 255), Int(green * 255), Int(blue * 255))
    }
}
