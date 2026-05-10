//
//  VisibilityState.swift (Legacy)
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//
//  ⚠️ DEPRECATED in G-1B: Use VisibilityState enum from Core/Models/ instead.
//  This file maintained for backward compatibility during transition.
//  Will be removed in G-1C.
//

import Foundation

/// Visibility state for Guardian's awareness of filesystem and system behavior.
/// G-1A: Placeholder only. No actual scanning or probing logic.
/// G-1B: Deprecated - use VisibilityState enum and GuardianVisibilitySnapshot
@available(*, deprecated, message: "Use VisibilityState enum and GuardianVisibilitySnapshot instead")
struct LegacyVisibilityState: Sendable {
    enum Status: Sendable {
        case notProbed
        case unknown
    }
    
    let status: Status
    let timestamp: Date?
    
    static let notProbed = LegacyVisibilityState(
        status: .notProbed,
        timestamp: nil
    )
}
