//
//  GuardianCapabilityState.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// State of a specific Guardian capability or security feature.
/// G-1B: Shared enum for tracking various Guardian subsystem states.
enum GuardianCapabilityState: String, Codable, Sendable, Equatable {
    
    /// Capability has not been checked yet
    case notChecked
    
    /// Capability check is in progress
    case checking
    
    /// Capability is verified and working correctly
    case verified
    
    /// Capability is intentionally disabled (expected for network)
    case disabled
    
    /// Capability check failed
    case failed
    
    /// Capability is in degraded/partial state
    case degraded
    
    /// Capability is unavailable on this system
    case unavailable
    
    /// Human-readable description
    var description: String {
        switch self {
        case .notChecked: return "Not Checked"
        case .checking: return "Checking..."
        case .verified: return "Verified"
        case .disabled: return "Disabled"
        case .failed: return "Failed"
        case .degraded: return "Degraded"
        case .unavailable: return "Unavailable"
        }
    }
    
    /// Whether this state indicates a healthy/expected condition
    var isHealthy: Bool {
        switch self {
        case .verified, .disabled:
            return true
        case .notChecked, .checking, .failed, .degraded, .unavailable:
            return false
        }
    }
}
