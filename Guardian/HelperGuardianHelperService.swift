//
//  GuardianHelperService.swift
//  GuardianHelper
//
//  Created by Jonathan Garnett on 5/8/26.
//

import Foundation

/// XPC service implementation for Guardian Helper.
///
/// G-2C: Minimal XPC service that responds to ping and health requests.
///
/// **Responsibilities:**
/// - Implement GuardianXPCProtocol
/// - Respond to ping requests
/// - Provide health snapshots
/// - Maintain helper state
///
/// **G-2C Limitations:**
/// - Returns static baseline health only
/// - No filesystem monitoring
/// - No database access
/// - No FSEvents
/// - No mutation operations
/// - No networking
/// - No background tasks
///
/// **Security Guarantees:**
/// - Read-only operations only
/// - No file modifications
/// - No network access
/// - Local-only operation
/// - No shared mutable state
class GuardianHelperService: NSObject, GuardianXPCProtocol {
    
    // MARK: - State
    
    /// Helper version (matches app version)
    private let helperVersion = GuardianVersion.app
    
    /// Helper process ID
    private let helperPID = ProcessInfo.processInfo.processIdentifier
    
    /// Helper start time
    private let startTime = Date()
    
    /// Number of pings received
    private var pingCount: Int = 0
    
    // MARK: - Initialization
    
    override init() {
        super.init()
        
        // G-2C: No initialization needed
        // Future: May load configuration, etc.
    }
    
    // MARK: - GuardianXPCProtocol Implementation
    
    /// Handle ping request from app.
    ///
    /// G-2C: Echo back ping with helper info.
    func ping(request requestData: Data, withReply reply: @escaping (Data) -> Void) {
        do {
            // Decode request
            let decoder = JSONDecoder()
            let message = try decoder.decode(GuardianXPCMessage.self, from: requestData)
            
            guard case .pingRequest(let request) = message else {
                // Invalid request format
                let errorData = Data()
                reply(errorData)
                return
            }
            
            // Increment ping count
            pingCount += 1
            
            // Create response
            let response = GuardianPingResponse(
                receivedAt: Date(),
                respondedAt: Date(),
                sequenceNumber: request.sequenceNumber,
                helperVersion: helperVersion,
                helperPID: helperPID,
                isReady: true
            )
            
            // Encode response
            let encoder = JSONEncoder()
            let responseMessage = GuardianXPCMessage.pingResponse(response)
            let responseData = try encoder.encode(responseMessage)
            
            // Send reply
            reply(responseData)
            
        } catch {
            // Encoding/decoding error - send empty data
            let errorData = Data()
            reply(errorData)
        }
    }
    
    /// Get health snapshot.
    ///
    /// G-2C: Returns static baseline health (no real checks).
    func getHealthSnapshot(withReply reply: @escaping (Data) -> Void) {
        do {
            // Create baseline health snapshot
            // G-2C: All values are static/baseline - no actual checking
            let health = GuardianHealthSnapshot(
                capturedAt: Date(),
                helperState: .running,           // Helper is running if we can respond
                xpcConnectionState: .connected,   // XPC is connected if we're here
                networkState: .disabled,          // Always disabled (design principle)
                mutationFirewallState: .verified, // Static verification (no runtime check)
                visibilityState: .notProbed       // Not checked in G-2C
            )
            
            // Encode response
            let encoder = JSONEncoder()
            let message = GuardianXPCMessage.healthResponse(health)
            let responseData = try encoder.encode(message)
            
            // Send reply
            reply(responseData)
            
        } catch {
            // Encoding error - send empty data
            let errorData = Data()
            reply(errorData)
        }
    }
    
    // MARK: - G-2C: No Forbidden Operations
    
    // This service explicitly does NOT:
    // - Import Network framework
    // - Use URLSession
    // - Use FileManager for scanning
    // - Use FSEvents
    // - Perform file mutations (removeItem, moveItem, etc.)
    // - Access SQLite/GRDB
    // - Load AI/ML models
    // - Start background tasks
    // - Request permissions
    // - Modify system files
    
    // All operations are read-only status reporting only.
}
