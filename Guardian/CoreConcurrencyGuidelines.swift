//
//  ConcurrencyGuidelines.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

// MARK: - Guardian Swift 6 Concurrency Guidelines
//
// This file documents concurrency safety principles for Guardian.
// All code must adhere to Swift 6 strict concurrency checking.

/// Guardian Concurrency Principles (G-1B Baseline)
///
/// 1. ALL TYPES SENDABLE
///    - All DTOs, enums, and value types MUST conform to Sendable
///    - Ensures safe cross-actor and cross-process communication
///
/// 2. NO SHARED MUTABLE STATE
///    - No global mutable variables
///    - No singletons with mutable state
///    - Use value types (struct/enum) over classes when possible
///
/// 3. ACTORS FOR MUTABLE STATE (Future)
///    - When mutable state is needed, use actors
///    - One actor per logical subsystem
///    - Examples: GuardianStateActor, HelperConnectionActor
///
/// 4. ASYNC/AWAIT FOR CONCURRENCY
///    - All async operations use async/await
///    - No callbacks or completion handlers
///    - No Dispatch or GCD for new code
///
/// 5. XPC SAFETY
///    - All XPC DTOs must be Codable + Sendable
///    - No shared memory across process boundaries
///    - All XPC methods async throws
///
/// 6. MAIN ACTOR FOR UI
///    - All SwiftUI views implicitly @MainActor
///    - Explicit @MainActor for UI-related logic
///    - Keep UI updates on main actor
///
/// 7. ISOLATED STATE
///    - Each subsystem owns its state
///    - State changes via immutable snapshots
///    - No direct mutation across subsystems

// MARK: - Prohibited Patterns

/// ❌ DO NOT USE: Global mutable state
// var globalState = SomeState() // FORBIDDEN

/// ❌ DO NOT USE: Singleton with mutable state
// class Singleton {
//     static let shared = Singleton()
//     var mutableProperty: String // FORBIDDEN
// }

/// ❌ DO NOT USE: Classes without Sendable conformance for shared data
// class SharedData { } // FORBIDDEN for cross-actor sharing

/// ❌ DO NOT USE: Dispatch/GCD for new code
// DispatchQueue.global().async { } // FORBIDDEN - use Task instead

/// ❌ DO NOT USE: Completion handlers
// func doSomething(completion: @escaping (Result) -> Void) // FORBIDDEN

// MARK: - Approved Patterns

/// ✅ APPROVED: Sendable value types
struct GuardianData: Sendable {
    let immutableProperty: String
}

/// ✅ APPROVED: Sendable enums
enum GuardianState: Sendable {
    case inactive
    case active
}

/// ✅ APPROVED: Actor for mutable state (future)
// actor GuardianStateActor {
//     private var state: GuardianRuntimeState
//     
//     func updateState(_ newState: GuardianRuntimeState) {
//         self.state = newState
//     }
// }

/// ✅ APPROVED: Async/await methods
// func fetchState() async throws -> GuardianRuntimeState {
//     // Implementation
// }

/// ✅ APPROVED: MainActor for UI
// @MainActor
// class GuardianViewModel: ObservableObject {
//     @Published var state: GuardianRuntimeState
// }

// MARK: - Future Concurrency Architecture

/// Phase G-2A: State Management
/// - Introduce GuardianStateActor for centralized state
/// - Add @MainActor view model
/// - Implement state observation pattern

/// Phase G-2B: XPC Communication
/// - Add XPCConnectionActor
/// - Implement async XPC protocol methods
/// - Add cross-process state synchronization

/// Phase G-3: Background Monitoring
/// - Add MonitoringActor for FSEvents
/// - Implement Task-based background work
/// - Add structured concurrency for lifecycle

// MARK: - Current Status (G-1B)

/// G-1B Concurrency Status:
/// ✅ All DTOs are Sendable + Codable + Equatable
/// ✅ All enums are Sendable
/// ✅ No global mutable state
/// ✅ No shared mutable singletons
/// ✅ XPC protocol defined with async methods
/// ⚠️ No actors yet (static state only)
/// ⚠️ No async operations yet (no functionality)
/// ⚠️ No background tasks yet
