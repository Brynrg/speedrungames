//
//  GuardianXPCTests.swift
//  GuardianTests
//
//  Created by Jonathan Garnett on 5/8/26.
//

import Testing
@testable import Guardian

/// Tests for XPC message encoding/decoding and protocol compliance.
///
/// G-2C: Verify XPC DTOs are properly Codable and Sendable.
@Suite("XPC Message Tests")
struct GuardianXPCTests {
    
    // MARK: - Ping Request/Response Tests
    
    @Test("Ping request encoding")
    func pingRequestEncoding() throws {
        let request = GuardianPingRequest(
            sentAt: Date(),
            sequenceNumber: 42,
            appVersion: "1.0.0"
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        
        #expect(!data.isEmpty)
    }
    
    @Test("Ping request decoding")
    func pingRequestDecoding() throws {
        let request = GuardianPingRequest(
            sentAt: Date(),
            sequenceNumber: 42,
            appVersion: "1.0.0"
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(request)
        
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(GuardianPingRequest.self, from: data)
        
        #expect(decoded.sequenceNumber == request.sequenceNumber)
        #expect(decoded.appVersion == request.appVersion)
    }
    
    @Test("Ping response encoding")
    func pingResponseEncoding() throws {
        let response = GuardianPingResponse(
            receivedAt: Date(),
            respondedAt: Date(),
            sequenceNumber: 42,
            helperVersion: "1.0.0",
            helperPID: 12345,
            isReady: true
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(response)
        
        #expect(!data.isEmpty)
    }
    
    @Test("Ping response decoding")
    func pingResponseDecoding() throws {
        let response = GuardianPingResponse(
            receivedAt: Date(),
            respondedAt: Date(),
            sequenceNumber: 42,
            helperVersion: "1.0.0",
            helperPID: 12345,
            isReady: true
        )
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(response)
        
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(GuardianPingResponse.self, from: data)
        
        #expect(decoded.sequenceNumber == response.sequenceNumber)
        #expect(decoded.helperVersion == response.helperVersion)
        #expect(decoded.helperPID == response.helperPID)
        #expect(decoded.isReady == response.isReady)
    }
    
    // MARK: - XPC Message Tests
    
    @Test("XPC message ping request encoding")
    func xpcMessagePingRequestEncoding() throws {
        let request = GuardianPingRequest(
            sentAt: Date(),
            sequenceNumber: 1,
            appVersion: "1.0.0"
        )
        
        let message = GuardianXPCMessage.pingRequest(request)
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(message)
        
        #expect(!data.isEmpty)
    }
    
    @Test("XPC message ping response encoding")
    func xpcMessagePingResponseEncoding() throws {
        let response = GuardianPingResponse(
            receivedAt: Date(),
            respondedAt: Date(),
            sequenceNumber: 1,
            helperVersion: "1.0.0",
            helperPID: 12345,
            isReady: true
        )
        
        let message = GuardianXPCMessage.pingResponse(response)
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(message)
        
        #expect(!data.isEmpty)
    }
    
    @Test("XPC message health request encoding")
    func xpcMessageHealthRequestEncoding() throws {
        let message = GuardianXPCMessage.healthRequest
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(message)
        
        #expect(!data.isEmpty)
    }
    
    @Test("XPC message health response encoding")
    func xpcMessageHealthResponseEncoding() throws {
        let health = GuardianHealthSnapshot.baseline
        let message = GuardianXPCMessage.healthResponse(health)
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(message)
        
        #expect(!data.isEmpty)
    }
    
    @Test("XPC message round trip")
    func xpcMessageRoundTrip() throws {
        let request = GuardianPingRequest(
            sentAt: Date(),
            sequenceNumber: 99,
            appVersion: "2.0.0"
        )
        
        let message = GuardianXPCMessage.pingRequest(request)
        
        let encoder = JSONEncoder()
        let data = try encoder.encode(message)
        
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(GuardianXPCMessage.self, from: data)
        
        guard case .pingRequest(let decodedRequest) = decoded else {
            Issue.record("Expected pingRequest message")
            return
        }
        
        #expect(decodedRequest.sequenceNumber == request.sequenceNumber)
        #expect(decodedRequest.appVersion == request.appVersion)
    }
    
    // MARK: - Sendable Conformance Tests
    
    @Test("Ping request is Sendable")
    func pingRequestIsSendable() {
        func requiresSendable<T: Sendable>(_: T.Type) {}
        requiresSendable(GuardianPingRequest.self)
    }
    
    @Test("Ping response is Sendable")
    func pingResponseIsSendable() {
        func requiresSendable<T: Sendable>(_: T.Type) {}
        requiresSendable(GuardianPingResponse.self)
    }
    
    @Test("XPC message is Sendable")
    func xpcMessageIsSendable() {
        func requiresSendable<T: Sendable>(_: T.Type) {}
        requiresSendable(GuardianXPCMessage.self)
    }
    
    // MARK: - Equatable Tests
    
    @Test("Ping request equality")
    func pingRequestEquality() {
        let date = Date()
        let request1 = GuardianPingRequest(sentAt: date, sequenceNumber: 1, appVersion: "1.0")
        let request2 = GuardianPingRequest(sentAt: date, sequenceNumber: 1, appVersion: "1.0")
        let request3 = GuardianPingRequest(sentAt: date, sequenceNumber: 2, appVersion: "1.0")
        
        #expect(request1 == request2)
        #expect(request1 != request3)
    }
    
    @Test("Ping response equality")
    func pingResponseEquality() {
        let date = Date()
        let response1 = GuardianPingResponse(
            receivedAt: date,
            respondedAt: date,
            sequenceNumber: 1,
            helperVersion: "1.0",
            helperPID: 100,
            isReady: true
        )
        let response2 = GuardianPingResponse(
            receivedAt: date,
            respondedAt: date,
            sequenceNumber: 1,
            helperVersion: "1.0",
            helperPID: 100,
            isReady: true
        )
        let response3 = GuardianPingResponse(
            receivedAt: date,
            respondedAt: date,
            sequenceNumber: 2,
            helperVersion: "1.0",
            helperPID: 100,
            isReady: true
        )
        
        #expect(response1 == response2)
        #expect(response1 != response3)
    }
}
