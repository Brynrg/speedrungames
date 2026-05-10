//
//  HealthStatusDTO.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//
//  ⚠️ DEPRECATED in G-1B: Use GuardianHealthSnapshot instead.
//  This file maintained for backward compatibility during transition.
//  Will be removed in G-1C.
//

import Foundation

/// Health status data transfer object for Guardian system components.
/// G-1A: Placeholder only. No actual health checking logic.
/// G-1B: Deprecated - use GuardianHealthSnapshot from Core/Models/
@available(*, deprecated, message: "Use GuardianHealthSnapshot instead")
struct HealthStatusDTO: Sendable {
    enum ComponentStatus: Sendable {
        case notInstalled
        case notConnected
        case disabled
        case notChecked
    }
    
    let helperStatus: ComponentStatus
    let xpcStatus: ComponentStatus
    let networkStatus: ComponentStatus
    let mutationFirewallStatus: ComponentStatus
    let visibilityStatus: ComponentStatus
    let lastUpdate: Date?
    
    static let baseline = HealthStatusDTO(
        helperStatus: .notInstalled,
        xpcStatus: .notConnected,
        networkStatus: .disabled,
        mutationFirewallStatus: .notChecked,
        visibilityStatus: .notChecked,
        lastUpdate: nil
    )
}
