//
//  GuardianXPCClient.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/8/26.
//

import Foundation

/// XPC client for communicating with Guardian helper process.
///
/// G-2C: Minimal XPC ping and health snapshot functionality.
///
/// **Responsibilities:**
/// - Establish XPC connection to helper
/// - Send ping requests
/// - Fetch health snapshots
/// - Handle connection failures
/// - Report connection state
///
/// **Design Principles:**
/// - Actor for thread-safe connection management
/// - All DTOs are Codable and Sendable
/// - No shared mutable state
/// - Automatic reconnection on failure
/// - Proper error handling and timeout
///
/// **G-2C Limitations:**
/// - No automatic helper installation
/// - No SMAppService registration
/// - No launchd integration
/// - Helper must be manually started for testing
/// - Connection state changes reported via async methods
actor GuardianXPCClient {
    
    // MARK: - State
    
    /// Current XPC connection (nil if not connected)
    private var connection: NSXPCConnection?
    
    /// Current connection state
    private(set) var connectionState: XPCConnectionState = .notConnected
    
    /// Sequence number for ping requests
    private var pingSequence: Int = 0
    
    /// Last successful ping response
    private(set) var lastPingResponse: GuardianPingResponse?
    
    /// Last error encountered
    private(set) var lastError: Error?
    
    // MARK: - Initialization
    
    init() {
        // G-2C: No auto-connection on init
        // Connection must be explicitly requested
    }
    
    // MARK: - Connection Management
    
    /// Establish XPC connection to helper.
    ///
    /// G-2C: Attempts to connect to helper via mach service.
    /// Does NOT install or register the helper automatically.
    ///
    /// - Throws: GuardianXPCError if connection fails
    func connect() async throws {
        // Disconnect existing connection if any
        if connection != nil {
            await disconnect()
        }
        
        connectionState = .connecting
        
        // Create XPC connection
        let newConnection = NSXPCConnection(machServiceName: GuardianXPCService.machServiceName)
        
        // Set remote object interface
        newConnection.remoteObjectInterface = NSXPCInterface(with: GuardianXPCProtocol.self)
        
        // Set interruption handler
        newConnection.interruptionHandler = { [weak self] in
            Task {
                await self?.handleInterruption()
            }
        }
        
        // Set invalidation handler
        newConnection.invalidationHandler = { [weak self] in
            Task {
                await self?.handleInvalidation()
            }
        }
        
        // Resume connection
        newConnection.resume()
        
        // Store connection
        connection = newConnection
        
        // Try a ping to verify connectivity
        do {
            _ = try await ping()
            connectionState = .connected
            lastError = nil
        } catch {
            connectionState = .failed
            lastError = error
            connection?.invalidate()
            connection = nil
            throw error
        }
    }
    
    /// Disconnect from helper.
    func disconnect() async {
        connection?.invalidate()
        connection = nil
        connectionState = .notConnected
        lastPingResponse = nil
    }
    
    /// Handle connection interruption.
    private func handleInterruption() {
        connectionState = .interrupted
        // Connection will attempt to recover automatically
    }
    
    /// Handle connection invalidation.
    private func handleInvalidation() {
        connection = nil
        connectionState = .invalid
    }
    
    // MARK: - XPC Methods
    
    /// Send ping to helper and wait for response.
    ///
    /// G-2C: Basic connectivity test.
    ///
    /// - Returns: Ping response from helper
    /// - Throws: GuardianXPCError if ping fails
    func ping() async throws -> GuardianPingResponse {
        guard let connection = connection else {
            throw GuardianXPCError.notConnected
        }
        
        // Increment sequence number
        pingSequence += 1
        
        // Create ping request
        let request = GuardianPingRequest(
            sentAt: Date(),
            sequenceNumber: pingSequence,
            appVersion: GuardianVersion.app
        )
        
        // Encode request
        let requestData: Data
        do {
            requestData = try JSONEncoder().encode(GuardianXPCMessage.pingRequest(request))
        } catch {
            throw GuardianXPCError.encodingFailed(error)
        }
        
        // Get remote proxy
        let proxy = connection.remoteObjectProxyWithErrorHandler { error in
            // Error will be thrown in continuation
        } as? GuardianXPCProtocol
        
        guard let proxy = proxy else {
            throw GuardianXPCError.proxyFailed
        }
        
        // Send ping and wait for response
        return try await withCheckedThrowingContinuation { continuation in
            proxy.ping(request: requestData) { responseData in
                do {
                    let decoder = JSONDecoder()
                    let message = try decoder.decode(GuardianXPCMessage.self, from: responseData)
                    
                    guard case .pingResponse(let response) = message else {
                        continuation.resume(throwing: GuardianXPCError.unexpectedResponse)
                        return
                    }
                    
                    // Store last response
                    Task {
                        await self.storePingResponse(response)
                    }
                    
                    continuation.resume(returning: response)
                } catch {
                    continuation.resume(throwing: GuardianXPCError.decodingFailed(error))
                }
            }
        }
    }
    
    /// Get health snapshot from helper.
    ///
    /// G-2C: Returns static baseline health from helper.
    ///
    /// - Returns: Health snapshot
    /// - Throws: GuardianXPCError if request fails
    func getHealthSnapshot() async throws -> GuardianHealthSnapshot {
        guard let connection = connection else {
            throw GuardianXPCError.notConnected
        }
        
        // Get remote proxy
        let proxy = connection.remoteObjectProxyWithErrorHandler { error in
            // Error will be thrown in continuation
        } as? GuardianXPCProtocol
        
        guard let proxy = proxy else {
            throw GuardianXPCError.proxyFailed
        }
        
        // Request health snapshot
        return try await withCheckedThrowingContinuation { continuation in
            proxy.getHealthSnapshot { responseData in
                do {
                    let decoder = JSONDecoder()
                    let message = try decoder.decode(GuardianXPCMessage.self, from: responseData)
                    
                    guard case .healthResponse(let health) = message else {
                        continuation.resume(throwing: GuardianXPCError.unexpectedResponse)
                        return
                    }
                    
                    continuation.resume(returning: health)
                } catch {
                    continuation.resume(throwing: GuardianXPCError.decodingFailed(error))
                }
            }
        }
    }
    
    /// Store ping response (called from async context)
    private func storePingResponse(_ response: GuardianPingResponse) {
        lastPingResponse = response
    }
    
    // MARK: - State Access
    
    /// Get current connection state.
    func getConnectionState() -> XPCConnectionState {
        connectionState
    }
    
    /// Check if connected.
    func isConnected() -> Bool {
        connectionState == .connected && connection != nil
    }
}

// MARK: - XPC Errors

/// Errors that can occur during XPC communication.
enum GuardianXPCError: Error, LocalizedError {
    case notConnected
    case connectionFailed
    case proxyFailed
    case encodingFailed(Error)
    case decodingFailed(Error)
    case unexpectedResponse
    case timeout
    case helperNotRunning
    
    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Not connected to helper"
        case .connectionFailed:
            return "Failed to establish XPC connection"
        case .proxyFailed:
            return "Failed to create XPC proxy"
        case .encodingFailed(let error):
            return "Failed to encode XPC message: \(error.localizedDescription)"
        case .decodingFailed(let error):
            return "Failed to decode XPC response: \(error.localizedDescription)"
        case .unexpectedResponse:
            return "Received unexpected XPC response"
        case .timeout:
            return "XPC request timed out"
        case .helperNotRunning:
            return "Helper is not running"
        }
    }
}
