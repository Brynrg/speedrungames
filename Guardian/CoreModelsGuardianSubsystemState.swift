//
//  GuardianSubsystemState.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// State of a Guardian subsystem (helper, scanner, firewall, etc.).
/// G-1B: Shared enum for tracking lifecycle state of system components.
enum GuardianSubsystemState: String, Codable, Sendable, Equatable {
    
    /// Subsystem is not installed
    case notInstalled
    
    /// Subsystem is installed but not running
    case installed
    
    /// Subsystem is starting up
    case starting
    
    /// Subsystem is running normally
    case running
    
    /// Subsystem is stopping
    case stopping
    
    /// Subsystem has stopped
    case stopped
    
    /// Subsystem encountered an error
    case error
    
    /// Subsystem is in maintenance mode
    case maintenance
    
    /// Human-readable description
    var description: String {
        switch self {
        case .notInstalled: return "Not Installed"
        case .installed: return "Installed"
        case .starting: return "Starting..."
        case .running: return "Running"
        case .stopping: return "Stopping..."
        case .stopped: return "Stopped"
        case .error: return "Error"
        case .maintenance: return "Maintenance"
        }
    }
    
    /// Whether this subsystem state is healthy
    var isHealthy: Bool {
        self == .running
    }
    
    /// Whether subsystem is in a transitional state
    var isTransitioning: Bool {
        switch self {
        case .starting, .stopping:
            return true
        case .notInstalled, .installed, .running, .stopped, .error, .maintenance:
            return false
        }
    }
}
