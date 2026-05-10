//
//  GuardianStateActor.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/8/26.
//

import Foundation

/// Central state management actor for Guardian application state.
///
/// G-2A: Safe state management with Swift concurrency.
///
/// **Responsibilities:**
/// - Owns and manages the current `GuardianRuntimeState`
/// - Provides async read/update methods for state access
/// - Serializes all state mutations through actor isolation
/// - Prepares for future XPC integration with helper process
///
/// **Actor Isolation Boundaries:**
/// - This actor runs on its own executor (not MainActor)
/// - UI components must use async methods to read/update state
/// - All state updates are serialized through the actor
/// - Cross-actor communication uses Sendable DTOs only
///
/// **Future XPC Integration:**
/// - Helper process will send state updates via XPC
/// - Updates will be received as Sendable DTOs
/// - Actor will merge helper state with app state
/// - UI observes state changes through GuardianViewModel
///
/// **G-2A Design Constraints:**
/// - No timers (future phases)
/// - No file access (future phases)
/// - No networking (permanent prohibition)
/// - No database access (future phases)
/// - No global mutable state
/// - No singleton pattern
actor GuardianStateActor {
    
    // MARK: - State
    
    /// Current runtime state of the Guardian system.
    /// Only accessible through actor isolation.
    private(set) var currentState: GuardianRuntimeState
    
    // MARK: - Initialization
    
    /// Initialize with baseline state.
    ///
    /// G-2A: Starts with baseline state (no active functionality).
    /// Future phases will add:
    /// - State restoration from disk
    /// - Initial helper connection
    /// - Permission checks
    init() {
        self.currentState = .baseline
    }
    
    /// Initialize with a specific state (for testing).
    ///
    /// - Parameter initialState: The initial runtime state
    init(initialState: GuardianRuntimeState) {
        self.currentState = initialState
    }
    
    // MARK: - State Access
    
    /// Read the current runtime state.
    ///
    /// This method is safe to call from any isolation domain.
    /// The returned state is a Sendable value type, so it can be
    /// safely used across actor boundaries.
    ///
    /// - Returns: Current runtime state snapshot
    func getState() -> GuardianRuntimeState {
        currentState
    }
    
    /// Read a specific aspect of the current state.
    ///
    /// - Returns: Current health snapshot
    func getHealth() -> GuardianHealthSnapshot {
        currentState.health
    }
    
    /// Read visibility state.
    ///
    /// - Returns: Current visibility snapshot
    func getVisibility() -> GuardianVisibilitySnapshot {
        currentState.visibility
    }
    
    /// Check if Guardian is in safe mode.
    ///
    /// - Returns: True if in safe mode (degraded functionality)
    func isSafeMode() -> Bool {
        currentState.isSafeMode
    }
    
    /// Check if Guardian is actively monitoring.
    ///
    /// - Returns: True if monitoring is active (always false in G-2A)
    func isMonitoring() -> Bool {
        currentState.isMonitoring
    }
    
    // MARK: - State Updates
    
    /// Update the complete runtime state.
    ///
    /// This is the primary method for updating state from XPC messages
    /// or other sources. Since GuardianRuntimeState is a value type,
    /// this performs a complete replacement.
    ///
    /// G-2A: Not used yet, but architecture is ready for future phases.
    ///
    /// - Parameter newState: The new runtime state
    func updateState(_ newState: GuardianRuntimeState) {
        currentState = newState
    }
    
    /// Update only the health snapshot.
    ///
    /// G-2A: Not used yet. Future phases will call this when:
    /// - Helper process sends health updates via XPC
    /// - Local health checks complete
    /// - Permission states change
    ///
    /// - Parameter health: New health snapshot
    func updateHealth(_ health: GuardianHealthSnapshot) {
        currentState = GuardianRuntimeState(
            stateVersion: currentState.stateVersion,
            lastUpdated: Date(),
            health: health,
            visibility: currentState.visibility,
            isMonitoring: currentState.isMonitoring,
            isSafeMode: currentState.isSafeMode
        )
    }
    
    /// Update only the visibility snapshot.
    ///
    /// G-2A: Not used yet. Future phases will call this when:
    /// - Visibility probes complete
    /// - TCC permissions change
    /// - FSEvents state changes
    ///
    /// - Parameter visibility: New visibility snapshot
    func updateVisibility(_ visibility: GuardianVisibilitySnapshot) {
        currentState = GuardianRuntimeState(
            stateVersion: currentState.stateVersion,
            lastUpdated: Date(),
            health: currentState.health,
            visibility: visibility,
            isMonitoring: currentState.isMonitoring,
            isSafeMode: currentState.isSafeMode
        )
    }
    
    /// Update monitoring state.
    ///
    /// G-2A: Not used yet. Future phases will call this when:
    /// - User enables/disables monitoring
    /// - Helper starts/stops monitoring
    /// - System enters/exits sleep
    ///
    /// - Parameter isMonitoring: Whether monitoring is active
    func updateMonitoringState(_ isMonitoring: Bool) {
        currentState = GuardianRuntimeState(
            stateVersion: currentState.stateVersion,
            lastUpdated: Date(),
            health: currentState.health,
            visibility: currentState.visibility,
            isMonitoring: isMonitoring,
            isSafeMode: currentState.isSafeMode
        )
    }
    
    /// Update safe mode state.
    ///
    /// G-2A: Not used yet. Future phases will call this when:
    /// - Entering safe mode due to errors
    /// - Recovering from safe mode
    /// - Detecting system incompatibilities
    ///
    /// - Parameter isSafeMode: Whether Guardian is in safe mode
    func updateSafeMode(_ isSafeMode: Bool) {
        currentState = GuardianRuntimeState(
            stateVersion: currentState.stateVersion,
            lastUpdated: Date(),
            health: currentState.health,
            visibility: currentState.visibility,
            isMonitoring: currentState.isMonitoring,
            isSafeMode: isSafeMode
        )
    }
    
    // MARK: - Future XPC Integration Points
    
    /// Handle state update received from helper via XPC.
    ///
    /// G-2A: Not implemented yet. Future phases will implement this to:
    /// - Receive GuardianRuntimeState from helper via XPC
    /// - Validate state version compatibility
    /// - Merge helper state with app state
    /// - Notify observers of changes
    ///
    /// - Parameter helperState: State received from helper process
    func handleHelperStateUpdate(_ helperState: GuardianRuntimeState) async {
        // G-2A: Placeholder for future implementation
        // Future: Validate version compatibility
        // Future: Merge states if needed
        // Future: Update current state
        // For now, just update directly
        updateState(helperState)
    }
    
    /// Reset to baseline state.
    ///
    /// G-2A: Useful for testing and error recovery.
    ///
    /// - Returns: The baseline state that was set
    @discardableResult
    func resetToBaseline() -> GuardianRuntimeState {
        currentState = .baseline
        return currentState
    }
}

// MARK: - Actor Isolation Documentation

/*
 Actor Isolation Boundaries in Guardian:
 
 ┌─────────────────────────────────────────────────────────────────┐
 │                        MainActor                                │
 │  ┌──────────────────────────────────────────────────────────┐  │
 │  │  GuardianViewModel (@Observable, @MainActor)             │  │
 │  │  - Holds display state                                   │  │
 │  │  - Calls GuardianStateActor async methods                │  │
 │  │  - Updates UI on state changes                           │  │
 │  └──────────────────────────────────────────────────────────┘  │
 │                           ↓ async calls                         │
 └───────────────────────────┼─────────────────────────────────────┘
                             │
 ┌───────────────────────────┼─────────────────────────────────────┐
 │                GuardianStateActor                               │
 │  ┌──────────────────────────────────────────────────────────┐  │
 │  │  currentState: GuardianRuntimeState                      │  │
 │  │  - Serializes all mutations                              │  │
 │  │  - Provides async read/write methods                     │  │
 │  │  - Safe for concurrent access                            │  │
 │  └──────────────────────────────────────────────────────────┘  │
 │                           ↑ future XPC                          │
 └───────────────────────────┼─────────────────────────────────────┘
                             │
 ┌───────────────────────────┼─────────────────────────────────────┐
 │                  Helper Process (Future)                        │
 │  ┌──────────────────────────────────────────────────────────┐  │
 │  │  GuardianHelper (XPC Service)                            │  │
 │  │  - Runs in separate process                              │  │
 │  │  - Sends Sendable DTOs via XPC                           │  │
 │  │  - Never directly accesses app state                     │  │
 │  └──────────────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────────┘
 
 Data Flow:
 1. GuardianRootView observes GuardianViewModel (@Observable)
 2. GuardianViewModel calls GuardianStateActor async methods
 3. GuardianStateActor serializes state updates
 4. Future: Helper sends state via XPC → GuardianStateActor
 5. State changes propagate back to UI through observation
 
 Thread Safety:
 - All state mutations go through actor isolation
 - All DTOs are Sendable value types
 - No shared mutable state between actors
 - No global singletons with mutable state
 - XPC boundary enforces Sendable requirement
 */
