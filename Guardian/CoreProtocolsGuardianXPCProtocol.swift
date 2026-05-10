//
//  GuardianXPCProtocol.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// Protocol contract for XPC communication between Guardian main app and helper.
/// G-1B: Placeholder protocol definition for future XPC implementation.
/// G-2C: Minimal ping/health snapshot methods added.
///
/// This protocol defines the interface for:
/// - Ping/connectivity tests
/// - Health status queries
/// - Visibility probes (future)
/// - Configuration updates (future)
/// - Runtime state synchronization (future)
///
/// Design principles:
/// - All methods async for Swift concurrency
/// - All parameters and return types must be Sendable
/// - All DTOs must be Codable for XPC serialization
/// - No shared mutable state across processes
@objc protocol GuardianXPCProtocol {
    
    // MARK: - G-2C: Minimal Ping & Health
    
    /// Ping the helper to verify XPC connectivity.
    ///
    /// G-2C: Basic connectivity test with minimal request/response.
    ///
    /// - Parameter request: Ping request with timestamp
    /// - Returns: Ping response with helper info
    func ping(request: Data, withReply reply: @escaping (Data) -> Void)
    
    /// Get current health snapshot from helper.
    ///
    /// G-2C: Returns static baseline health (no real checks yet).
    ///
    /// - Parameter reply: Completion handler with health snapshot data
    func getHealthSnapshot(withReply reply: @escaping (Data) -> Void)
    
    // MARK: - Future Methods (G-3+)
    
    // func getVisibilitySnapshot() async throws -> GuardianVisibilitySnapshot
    // func getRuntimeState() async throws -> GuardianRuntimeState
    // func startMonitoring() async throws
    // func stopMonitoring() async throws
    // func enterSafeMode() async throws
    // func updateConfiguration(_ config: GuardianConfiguration) async throws
    // func validateConfiguration() async throws -> Bool
    // func performVisibilityProbe() async throws -> GuardianVisibilitySnapshot
}

/// XPC service name for Guardian helper.
/// G-1B: Placeholder - no actual XPC service exists yet.
/// G-2C: Service names defined for XPC connection.
/// G-2C.5: Updated to use com.garnettlabs namespace.
enum GuardianXPCService {
    /// Bundle identifier for the helper XPC service
    static let helperBundleID = "com.garnettlabs.GuardianHelper"
    
    /// Mach service name for XPC connection
    static let machServiceName = "com.garnettlabs.Guardian.xpc"
}

// MARK: - G-2C: XPC Message DTOs

/// Ping request sent from app to helper.
///
/// G-2C: Minimal ping to verify XPC connectivity.
struct GuardianPingRequest: Codable, Sendable, Equatable {
    /// Timestamp when ping was sent
    let sentAt: Date
    
    /// Sequence number for tracking
    let sequenceNumber: Int
    
    /// App version sending the ping
    let appVersion: String
}

/// Ping response from helper to app.
///
/// G-2C: Helper confirms connectivity and provides basic info.
struct GuardianPingResponse: Codable, Sendable, Equatable {
    /// Timestamp when ping was received by helper
    let receivedAt: Date
    
    /// Timestamp when response was sent
    let respondedAt: Date
    
    /// Sequence number echoed back
    let sequenceNumber: Int
    
    /// Helper version
    let helperVersion: String
    
    /// Helper process identifier
    let helperPID: Int32
    
    /// Whether helper is ready
    let isReady: Bool
}

/// XPC request/response message types.
/// G-1B: Placeholder for future typed XPC messages.
/// G-2C: Ping and health snapshot messages added.
enum GuardianXPCMessage: Codable, Sendable, Equatable {
    
    // G-2C: Minimal ping functionality
    case pingRequest(GuardianPingRequest)
    case pingResponse(GuardianPingResponse)
    
    // G-2C: Health snapshot query
    case healthRequest
    case healthResponse(GuardianHealthSnapshot)
    
    // Future message types:
    // case visibilityRequest
    // case visibilityResponse(GuardianVisibilitySnapshot)
    // case startMonitoring
    // case stopMonitoring
    // case error(String)
}
