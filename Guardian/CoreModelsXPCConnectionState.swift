//
//  XPCConnectionState.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// State of XPC connection between Guardian main app and helper process.
/// G-1B: Enhanced enum for future XPC communication tracking.
enum XPCConnectionState: String, Codable, Sendable, Equatable {
    
    /// XPC connection has not been attempted
    case notConnected
    
    /// XPC connection is being established
    case connecting
    
    /// XPC connection is active and healthy
    case connected
    
    /// XPC connection was interrupted
    case interrupted
    
    /// XPC connection failed to establish
    case failed
    
    /// XPC connection is invalid or terminated
    case invalid
    
    /// Human-readable description
    var description: String {
        switch self {
        case .notConnected: return "Not Connected"
        case .connecting: return "Connecting..."
        case .connected: return "Connected"
        case .interrupted: return "Interrupted"
        case .failed: return "Failed"
        case .invalid: return "Invalid"
        }
    }
    
    /// Whether this connection state is healthy
    var isHealthy: Bool {
        self == .connected
    }
}
