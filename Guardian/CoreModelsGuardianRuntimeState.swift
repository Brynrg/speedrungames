//
//  GuardianRuntimeState.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// Complete runtime state of the Guardian system.
/// G-1B: Top-level state container for all Guardian subsystems.
/// Designed for atomic updates and cross-process synchronization.
struct GuardianRuntimeState: Codable, Sendable, Equatable {
    
    /// State version for compatibility checking across XPC boundaries
    let stateVersion: Int
    
    /// When this state was last updated
    let lastUpdated: Date
    
    /// Current health snapshot
    let health: GuardianHealthSnapshot
    
    /// Current visibility snapshot
    let visibility: GuardianVisibilitySnapshot
    
    /// Whether Guardian is actively monitoring (future)
    let isMonitoring: Bool
    
    /// Whether Guardian is in safe mode (degraded functionality)
    let isSafeMode: Bool
    
    /// Current state version for G-1B
    nonisolated static let currentVersion = 1
    
    /// Baseline runtime state for G-1B (no active functionality)
    nonisolated static var baseline: GuardianRuntimeState {
        GuardianRuntimeState(
            stateVersion: currentVersion,
            lastUpdated: Date(),
            health: .baseline,
            visibility: .baseline,
            isMonitoring: false,
            isSafeMode: true
        )
    }
}
