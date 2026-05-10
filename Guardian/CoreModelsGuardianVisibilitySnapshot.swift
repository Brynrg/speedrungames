//
//  GuardianVisibilitySnapshot.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// A snapshot of Guardian's filesystem visibility state.
/// G-1B: Placeholder for future filesystem scanning and awareness detection.
/// Tracks whether Guardian can observe filesystem changes and app behaviors.
struct GuardianVisibilitySnapshot: Codable, Sendable, Equatable {
    
    /// Timestamp when this visibility check was performed
    let checkedAt: Date
    
    /// Overall visibility status
    let state: VisibilityState
    
    /// Number of test paths that were successfully monitored (future)
    let monitoredPathCount: Int
    
    /// Number of test paths that failed visibility checks (future)
    let invisiblePathCount: Int
    
    /// Whether TCC permissions are granted (future)
    let hasTCCPermissions: Bool
    
    /// Whether FSEvents monitoring is active (future)
    let fsEventsActive: Bool
    
    /// Baseline snapshot for G-1B (no scanning active)
    nonisolated static let baseline = GuardianVisibilitySnapshot(
        checkedAt: Date(),
        state: .notProbed,
        monitoredPathCount: 0,
        invisiblePathCount: 0,
        hasTCCPermissions: false,
        fsEventsActive: false
    )
}
