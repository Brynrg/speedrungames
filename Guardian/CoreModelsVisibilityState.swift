//
//  VisibilityState.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// Guardian's awareness of filesystem and system behavior.
/// G-1B: Enhanced with Codable/Sendable for XPC communication.
enum VisibilityState: String, Codable, Sendable, Equatable {
    
    /// Visibility has not been probed yet
    case notProbed
    
    /// Visibility check is in progress
    case probing
    
    /// Guardian can see filesystem changes (full visibility)
    case visible
    
    /// Guardian has partial visibility (some blind spots detected)
    case partial
    
    /// Guardian is completely blind (cannot see filesystem changes)
    case invisible
    
    /// Visibility check failed or errored
    case unknown
    
    /// Human-readable description
    var description: String {
        switch self {
        case .notProbed: return "Not Probed"
        case .probing: return "Probing..."
        case .visible: return "Visible"
        case .partial: return "Partial Visibility"
        case .invisible: return "Invisible"
        case .unknown: return "Unknown"
        }
    }
    
    /// Whether this visibility state is acceptable
    var isAcceptable: Bool {
        switch self {
        case .visible:
            return true
        case .notProbed, .probing, .partial, .invisible, .unknown:
            return false
        }
    }
}
