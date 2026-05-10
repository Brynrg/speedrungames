//
//  GuardianBuildConstants.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// Centralized build-time constants for Guardian application.
/// G-1C: Version tracking and identifier management.
///
/// All version numbers, service identifiers, and schema versions
/// are defined here for consistency across the codebase.

// MARK: - Application Version

enum GuardianVersion {
    
    /// Current application version
    /// Format: MAJOR.MINOR.PATCH
    static let app = "0.1.0"
    
    /// Current build number
    static let build = "1"
    
    /// Version components
    static let major = 0
    static let minor = 1
    static let patch = 0
    
    /// Full version string with build
    static var fullVersion: String {
        "\(app) (\(build))"
    }
    
    /// Current development phase
    static let phase = "G-2C"
    
    /// Phase description
    static let phaseDescription = "XPC Ping Foundation"
}

// MARK: - Protocol Versions

enum GuardianProtocolVersion {
    
    /// XPC protocol version between main app and helper
    /// Increment when XPC message format changes (breaking)
    static let xpc = 1
    
    /// State snapshot serialization version
    /// Increment when DTO structure changes (breaking)
    static let stateSnapshot = 1
    
    /// Configuration format version (future)
    /// Increment when configuration schema changes
    static let configuration = 1
    
    /// Minimum compatible XPC protocol version
    /// Helper must support at least this version
    static let minimumCompatibleXPC = 1
}

// MARK: - Schema Versions

enum GuardianSchemaVersion {
    
    /// Database schema version (future - when persistence is added)
    /// Increment when database structure changes
    static let database = 1
    
    /// File index schema version (future)
    /// Increment when index structure changes
    static let fileIndex = 1
    
    /// Event log schema version (future)
    /// Increment when event structure changes
    static let eventLog = 1
}

// MARK: - Service Identifiers

enum GuardianServiceIdentifier {
    
    /// Main application bundle identifier
    /// G-2C.5: Updated to use com.garnettlabs namespace
    static let mainApp = "com.garnettlabs.Guardian"
    
    /// Helper XPC service bundle identifier
    /// G-2C.5: Updated to use com.garnettlabs namespace
    static let helper = "com.garnettlabs.GuardianHelper"
    
    /// Helper mach service name for XPC
    /// G-2C.5: Updated to use com.garnettlabs namespace
    static let helperMachService = "com.garnettlabs.Guardian.xpc"
    
    /// Helper launchd label (future)
    /// G-2C.5: Updated to use com.garnettlabs namespace
    static let helperLaunchdLabel = "com.garnettlabs.GuardianHelper"
}

// MARK: - Feature Flags

/// Feature flags for Guardian functionality.
/// G-1C: All features disabled (architectural baseline only).
/// G-2C: XPC ping functionality enabled.
enum GuardianFeatureFlags {
    
    /// Whether helper process is implemented
    /// G-2C: true (minimal helper with XPC)
    static let hasHelper = true
    
    /// Whether XPC communication is implemented
    /// G-2C: true (ping and health snapshot only)
    static let hasXPC = true
    
    /// Whether database persistence is implemented
    /// G-2C: false (no persistence yet)
    static let hasDatabase = false
    
    /// Whether filesystem monitoring is implemented
    /// G-2C: false (no FSEvents yet)
    static let hasFilesystemMonitoring = false
    
    /// Whether mutation firewall is enforced
    /// G-2C: false (documentation only)
    static let hasMutationFirewall = false
    
    /// Whether network policy is enforced
    /// G-2C: false (documentation only, but inherently true by design)
    static let hasNetworkPolicyEnforcement = false
    
    /// Whether visibility probing is implemented
    /// G-2C: false (no probing yet)
    static let hasVisibilityProbing = false
}

// MARK: - Build Configuration

/// Build configuration information.
enum GuardianBuildConfiguration {
    
    /// Current build type
    #if DEBUG
    static let isDebug = true
    static let isRelease = false
    static let buildType = "Debug"
    #else
    static let isDebug = false
    static let isRelease = true
    static let buildType = "Release"
    #endif
    
    /// Whether this is a development build
    static let isDevelopment = isDebug
    
    /// Whether this is a production build
    static let isProduction = isRelease
    
    /// Build timestamp (set at compile time)
    static let buildDate = Date()
    
    /// Compiler version (informational)
    #if swift(>=6.0)
    static let swiftVersion = "6.0+"
    #else
    static let swiftVersion = "< 6.0"
    #endif
}

// MARK: - Architectural Constants

/// Architectural constraints and guarantees.
/// G-1C: Permanent design principles.
enum GuardianArchitecturalConstants {
    
    /// Guardian is read-only (never mutates filesystem)
    static let isReadOnly = true
    
    /// Guardian is local-only (never accesses network)
    static let isLocalOnly = true
    
    /// Guardian is privacy-first (data never leaves machine)
    static let isPrivacyFirst = true
    
    /// Guardian is permanent (no cloud dependencies)
    static let isPermanent = true
    
    /// Guardian uses strict concurrency
    static let usesStrictConcurrency = true
    
    /// Minimum macOS version required
    static let minimumMacOSVersion = "13.0"
    
    /// Target macOS version
    static let targetMacOSVersion = "14.0"
}

// MARK: - Debug Information

/// Debug and diagnostic information.
extension GuardianBuildConfiguration {
    
    /// Full build information string
    static var fullBuildInfo: String {
        """
        Guardian \(GuardianVersion.fullVersion)
        Phase: \(GuardianVersion.phase) - \(GuardianVersion.phaseDescription)
        Build Type: \(buildType)
        Swift Version: \(swiftVersion)
        XPC Protocol: v\(GuardianProtocolVersion.xpc)
        State Snapshot: v\(GuardianProtocolVersion.stateSnapshot)
        Architectural Guarantees:
          • Read-Only: \(GuardianArchitecturalConstants.isReadOnly)
          • Local-Only: \(GuardianArchitecturalConstants.isLocalOnly)
          • Privacy-First: \(GuardianArchitecturalConstants.isPrivacyFirst)
          • Permanent: \(GuardianArchitecturalConstants.isPermanent)
          • Strict Concurrency: \(GuardianArchitecturalConstants.usesStrictConcurrency)
        """
    }
    
    /// Short version string
    static var shortVersion: String {
        "Guardian \(GuardianVersion.app) (\(GuardianVersion.phase))"
    }
}

// MARK: - Sendable Conformance

extension GuardianVersion: Sendable {}
extension GuardianProtocolVersion: Sendable {}
extension GuardianSchemaVersion: Sendable {}
extension GuardianServiceIdentifier: Sendable {}
extension GuardianFeatureFlags: Sendable {}
extension GuardianBuildConfiguration: Sendable {}
extension GuardianArchitecturalConstants: Sendable {}
