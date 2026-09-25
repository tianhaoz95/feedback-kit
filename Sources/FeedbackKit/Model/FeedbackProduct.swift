import Foundation

/// A product or surface associated with a project (e.g. "iOS App", "macOS App", "Backend API").
public struct FeedbackProduct: Codable, Equatable, Sendable, Identifiable {
    public var id: String { key }
    /// Machine-readable identifier / slug (e.g. "ios", "android", "backend").
    public var key: String
    /// Human-readable display name (e.g. "iOS App", "Android App", "Backend API").
    public var name: String
    /// Description and context for the AI coding agent about this surface.
    public var description: String
    /// Whether this is marked as the default product for the project.
    public var isDefault: Bool

    public init(
        key: String,
        name: String,
        description: String = "",
        isDefault: Bool = false
    ) {
        self.key = key
        self.name = name
        self.description = description
        self.isDefault = isDefault
    }

    enum CodingKeys: String, CodingKey {
        case key, name, description
        case isDefault = "is_default"
    }
}
