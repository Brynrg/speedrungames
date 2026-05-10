//
//  GuardianHealthSnapshot.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// A point-in-time snapshot of Guardian's overall health status.
/// G-1B: Shared DTO for future XPC communication between main app and helper.
/// Designed for strict concurrency and cross-process serialization.
struct GuardianHealthSnapshot: Codable, Sendable, Equatable {
    
    /// Timestamp when this snapshot was captured
    let capturedAt: Date
    
    /// Helper process installation and running state
    let helperState: GuardianSubsystemState
    
    /// XPC connection status between main app and helper
    let xpcConnectionState: XPCConnectionState
    
    /// Network capability state (should always be disabled for Guardian)
    let networkState: GuardianCapabilityState
    
    /// Mutation firewall verification state
    let mutationFirewallState: GuardianCapabilityState
    
    /// Filesystem visibility probe state
    let visibilityState: VisibilityState
    
    /// Overall system health assessment
    var isHealthy: Bool {
        helperState == .running &&
        xpcConnectionState == .connected &&
        networkState == .disabled &&
        mutationFirewallState == .verified &&
        visibilityState == .visible
    }
    
    /// Baseline snapshot for G-1B (no functionality active)
    nonisolated static let baseline = GuardianHealthSnapshot(
        capturedAt: Date(),
        helperState: .notInstalled,
        xpcConnectionState: .notConnected,
        networkState: .disabled,
        mutationFirewallState: .notChecked,
        visibilityState: .notProbed
    )
}
