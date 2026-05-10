//
//  GuardianXPCMessages.swift (Legacy)
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//
//  ⚠️ DEPRECATED in G-1B: Use GuardianXPCProtocol from Core/Protocols/ instead.
//  This file maintained for backward compatibility during transition.
//  Will be removed in G-1C.
//

import Foundation

/// XPC message protocol definitions for Guardian IPC.
/// G-1A: Placeholder only. No XPC server or helper target exists yet.
/// G-1B: Deprecated - use GuardianXPCProtocol and XPCConnectionState enum
@available(*, deprecated, message: "Use GuardianXPCProtocol and new XPC types instead")
enum LegacyGuardianXPCMessages {
    // Future XPC message types will be defined here
    // when helper target and XPC server are implemented in later phases
}

/// XPC connection state for Guardian components.
/// G-1B: Deprecated - use XPCConnectionState enum from Core/Models/
@available(*, deprecated, message: "Use XPCConnectionState enum instead")
struct LegacyXPCConnectionState: Sendable {
    enum Status: Sendable {
        case notConnected
        case unknown
    }
    
    let status: Status
    let lastAttempt: Date?
    
    static let notConnected = LegacyXPCConnectionState(
        status: .notConnected,
        lastAttempt: nil
    )
}
