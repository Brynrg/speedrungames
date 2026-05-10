//
//  GuardianViewModel.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/8/26.
//

import SwiftUI

/// View model for Guardian UI state observation.
///
/// G-2A: Observable state management for SwiftUI views.
///
/// **Responsibilities:**
/// - Holds display state for GuardianRootView
/// - Loads state from GuardianStateActor
/// - Provides UI-friendly computed properties
/// - Handles future state refresh/reload actions
///
/// **@Observable vs ObservableObject:**
/// - Uses @Observable (iOS 17+, macOS 14+)
/// - Provides automatic fine-grained observation
/// - Better performance than ObservableObject
/// - Requires no manual @Published annotations
///
/// **MainActor Isolation:**
/// - All properties and methods run on MainActor
/// - Safe for direct SwiftUI binding
/// - State updates automatically trigger view updates
/// - Async calls to GuardianStateActor are safe
///
/// **State Flow:**
/// 1. UI reads viewModel.runtimeState
/// 2. ViewModel fetches from GuardianStateActor (async)
/// 3. State updates trigger UI refresh
/// 4. Future: Background refresh updates state periodically
///
/// **G-2A Design Constraints:**
/// - No timers yet (future phases)
/// - No automatic refresh yet (future phases)
/// - No persistence yet (future phases)
/// - No networking (permanent prohibition)
/// - No file operations (future phases)
@MainActor
@Observable
final class GuardianViewModel {
    
    // MARK: - State
    
    /// Current runtime state for display.
    ///
    /// This is the primary state property that UI components observe.
    /// It's updated asynchronously from GuardianStateActor.
    private(set) var runtimeState: GuardianRuntimeState
    
    /// Whether state is currently being loaded/refreshed.
    ///
    /// G-2A: Always false for now (no background refresh).
    /// Future: Will be true during async state fetch.
    private(set) var isLoading: Bool = false
    
    /// Last error encountered during state operations.
    ///
    /// G-2A: Always nil for now (no error scenarios yet).
    /// Future: Will capture XPC errors, permission errors, etc.
    private(set) var lastError: Error? = nil
    
    // MARK: - Dependencies
    
    /// State actor for accessing Guardian runtime state.
    ///
    /// This is not stored as a property to avoid actor isolation issues.
    /// Instead, it's passed to async methods that need it.
    private let stateActor: GuardianStateActor
    
    /// XPC client for communicating with helper.
    ///
    /// G-2C: XPC client for ping and health snapshot requests.
    private let xpcClient: GuardianXPCClient
    
    // MARK: - Initialization
    
    /// Initialize with a state actor.
    ///
    /// G-2A: Creates view model with baseline state, then loads from actor.
    /// G-2C: Also creates XPC client for helper communication.
    ///
    /// - Parameter stateActor: The state actor to read from
    /// - Parameter xpcClient: The XPC client for helper communication
    init(stateActor: GuardianStateActor, xpcClient: GuardianXPCClient = GuardianXPCClient()) {
        self.stateActor = stateActor
        self.xpcClient = xpcClient
        self.runtimeState = .baseline
        
        // G-2A: Load initial state synchronously from baseline
        // Future: This will be async and load from actor
    }
    
    /// Convenience initializer that creates a new state actor.
    ///
    /// G-2A: Default initializer for production use.
    /// G-2C: Also creates XPC client.
    convenience init() {
        self.init(stateActor: GuardianStateActor(), xpcClient: GuardianXPCClient())
    }
    
    // MARK: - State Loading
    
    /// Load current state from the state actor.
    ///
    /// G-2A: Async method to fetch state from actor.
    /// This will be called:
    /// - On view appear
    /// - When user manually refreshes
    /// - Periodically in future phases
    ///
    /// **Thread Safety:**
    /// - This method is @MainActor
    /// - Calls to stateActor are async and safe
    /// - State updates happen on MainActor, triggering UI updates
    func loadState() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            // Fetch current state from actor
            let currentState = await stateActor.getState()
            
            // Update on MainActor (we're already on it)
            runtimeState = currentState
            lastError = nil
            
        } catch {
            // G-2A: No errors possible yet, but architecture is ready
            lastError = error
            // Keep existing state on error
        }
    }
    
    /// Refresh state from the state actor.
    ///
    /// G-2A: Same as loadState for now.
    /// Future: May trigger helper refresh before loading.
    func refreshState() async {
        await loadState()
    }
    
    // MARK: - Computed Properties for UI
    
    /// Current health snapshot.
    var health: GuardianHealthSnapshot {
        runtimeState.health
    }
    
    /// Current visibility snapshot.
    var visibility: GuardianVisibilitySnapshot {
        runtimeState.visibility
    }
    
    /// Whether Guardian is in safe mode.
    var isSafeMode: Bool {
        runtimeState.isSafeMode
    }
    
    /// Whether Guardian is actively monitoring.
    var isMonitoring: Bool {
        runtimeState.isMonitoring
    }
    
    /// Last state update timestamp.
    var lastUpdated: Date {
        runtimeState.lastUpdated
    }
    
    /// Overall health status (boolean).
    var isHealthy: Bool {
        health.isHealthy
    }
    
    // MARK: - UI Helper Methods
    
    /// Get status color for a boolean health indicator.
    ///
    /// - Parameter isHealthy: Whether the component is healthy
    /// - Returns: Green for healthy, secondary for unhealthy
    func statusColor(for isHealthy: Bool) -> Color {
        isHealthy ? .green : .secondary
    }
    
    /// Get system image name for helper state.
    ///
    /// G-2A: UI helper for displaying appropriate icons.
    ///
    /// - Parameter state: The subsystem state
    /// - Returns: SF Symbol name
    func systemImage(for state: GuardianSubsystemState) -> String {
        switch state {
        case .notInstalled:
            return "gearshape"
        case .installed:
            return "gearshape.fill"
        case .starting:
            return "gearshape.fill"
        case .running:
            return "gearshape.fill"
        case .stopping:
            return "gearshape"
        case .stopped:
            return "gearshape"
        case .error:
            return "exclamationmark.triangle.fill"
        case .maintenance:
            return "wrench.and.screwdriver.fill"
        }
    }
    
    /// Get system image name for XPC connection state.
    ///
    /// - Parameter state: The connection state
    /// - Returns: SF Symbol name
    func systemImage(for state: XPCConnectionState) -> String {
        switch state {
        case .notConnected:
            return "cable.connector"
        case .connecting:
            return "cable.connector"
        case .connected:
            return "cable.connector"
        case .failed:
            return "exclamationmark.triangle.fill"
        }
    }
    
    /// Get system image name for capability state.
    ///
    /// - Parameter state: The capability state
    /// - Returns: SF Symbol name
    func systemImage(for state: GuardianCapabilityState) -> String {
        switch state {
        case .notChecked:
            return "questionmark.circle"
        case .checking:
            return "arrow.trianglehead.2.clockwise.rotate.90.circle"
        case .disabled:
            return "checkmark.shield.fill"
        case .verified:
            return "checkmark.shield.fill"
        case .failed:
            return "xmark.shield.fill"
        case .degraded:
            return "exclamationmark.shield.fill"
        case .unavailable:
            return "nosign"
        }
    }
    
    // MARK: - Future Actions (Placeholders)
    
    /// Request helper installation.
    ///
    /// G-2A: Not implemented yet.
    /// Future: Will trigger SMAppService registration.
    func installHelper() async {
        // G-2A: Placeholder for future implementation
        // Future: Use SMAppService to register helper
        // Future: Update state after installation
    }
    
    /// Start monitoring.
    ///
    /// G-2A: Not implemented yet.
    /// Future: Will send XPC message to helper to start monitoring.
    func startMonitoring() async {
        // G-2A: Placeholder for future implementation
        // Future: Send XPC message to helper
        // Future: Update monitoring state
    }
    
    /// Stop monitoring.
    ///
    /// G-2A: Not implemented yet.
    /// Future: Will send XPC message to helper to stop monitoring.
    func stopMonitoring() async {
        // G-2A: Placeholder for future implementation
        // Future: Send XPC message to helper
        // Future: Update monitoring state
    }
    
    /// Reset to baseline state.
    ///
    /// G-2A: Useful for testing and debugging.
    func resetToBaseline() async {
        isLoading = true
        defer { isLoading = false }
        
        let baseline = await stateActor.resetToBaseline()
        runtimeState = baseline
        lastError = nil
    }
    
    // MARK: - G-2C: XPC Actions
    
    /// Connect to helper via XPC.
    ///
    /// G-2C: Establish XPC connection to helper process.
    func connectToHelper() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            try await xpcClient.connect()
            
            // Update connection state in runtime state
            let connectionState = await xpcClient.getConnectionState()
            await stateActor.updateHealth(
                GuardianHealthSnapshot(
                    capturedAt: Date(),
                    helperState: .running,
                    xpcConnectionState: connectionState,
                    networkState: .disabled,
                    mutationFirewallState: .notChecked,
                    visibilityState: .notProbed
                )
            )
            
            // Reload state
            await loadState()
            lastError = nil
            
        } catch {
            lastError = error
            
            // Update state to show failure
            await stateActor.updateHealth(
                GuardianHealthSnapshot(
                    capturedAt: Date(),
                    helperState: .notInstalled,
                    xpcConnectionState: .failed,
                    networkState: .disabled,
                    mutationFirewallState: .notChecked,
                    visibilityState: .notProbed
                )
            )
            
            await loadState()
        }
    }
    
    /// Disconnect from helper.
    ///
    /// G-2C: Close XPC connection.
    func disconnectFromHelper() async {
        await xpcClient.disconnect()
        
        // Update state
        await stateActor.updateHealth(
            GuardianHealthSnapshot(
                capturedAt: Date(),
                helperState: .stopped,
                xpcConnectionState: .notConnected,
                networkState: .disabled,
                mutationFirewallState: .notChecked,
                visibilityState: .notProbed
            )
        )
        
        await loadState()
    }
    
    /// Send ping to helper.
    ///
    /// G-2C: Test XPC connectivity with ping request.
    ///
    /// - Returns: True if ping successful, false otherwise
    @discardableResult
    func pingHelper() async -> Bool {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let response = try await xpcClient.ping()
            
            // Update state with successful ping
            let connectionState = await xpcClient.getConnectionState()
            await stateActor.updateHealth(
                GuardianHealthSnapshot(
                    capturedAt: Date(),
                    helperState: .running,
                    xpcConnectionState: connectionState,
                    networkState: .disabled,
                    mutationFirewallState: .notChecked,
                    visibilityState: .notProbed
                )
            )
            
            await loadState()
            lastError = nil
            return true
            
        } catch {
            lastError = error
            
            // Update state with failed ping
            await stateActor.updateHealth(
                GuardianHealthSnapshot(
                    capturedAt: Date(),
                    helperState: .error,
                    xpcConnectionState: .failed,
                    networkState: .disabled,
                    mutationFirewallState: .notChecked,
                    visibilityState: .notProbed
                )
            )
            
            await loadState()
            return false
        }
    }
    
    /// Get health snapshot from helper via XPC.
    ///
    /// G-2C: Fetch health status from helper.
    func fetchHelperHealth() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let health = try await xpcClient.getHealthSnapshot()
            
            // Update state with helper health
            await stateActor.updateHealth(health)
            await loadState()
            lastError = nil
            
        } catch {
            lastError = error
        }
    }
}

// MARK: - ViewModel Architecture Documentation

/*
 GuardianViewModel Architecture:
 
 Purpose:
 - Bridge between GuardianStateActor and SwiftUI views
 - Provide @Observable state for automatic UI updates
 - Handle async state loading from actor
 - Prepare for future XPC state updates
 
 State Flow:
 ┌─────────────────────────────────────────────────────────────────┐
 │                   GuardianRootView                              │
 │  - Observes GuardianViewModel                                   │
 │  - Automatically updates on state changes                       │
 │  - Calls async actions (refresh, load)                          │
 └───────────────────────────┬─────────────────────────────────────┘
                             │ @Observable
                             ↓
 ┌─────────────────────────────────────────────────────────────────┐
 │              GuardianViewModel (@MainActor)                     │
 │  - runtimeState: GuardianRuntimeState                           │
 │  - isLoading: Bool                                              │
 │  - lastError: Error?                                            │
 │  - Provides UI-friendly computed properties                     │
 └───────────────────────────┬─────────────────────────────────────┘
                             │ async/await
                             ↓
 ┌─────────────────────────────────────────────────────────────────┐
 │                  GuardianStateActor                             │
 │  - currentState: GuardianRuntimeState                           │
 │  - Serializes all state mutations                               │
 │  - Safe for concurrent access                                   │
 └───────────────────────────┬─────────────────────────────────────┘
                             │ future: XPC
                             ↓
 ┌─────────────────────────────────────────────────────────────────┐
 │                  Helper Process (Future)                        │
 │  - Sends state updates via XPC                                  │
 │  - Performs filesystem monitoring                               │
 │  - Runs independently from main app                             │
 └─────────────────────────────────────────────────────────────────┘
 
 Thread Safety Guarantees:
 - GuardianViewModel is @MainActor → all UI updates on main thread
 - GuardianStateActor is actor → serialized state access
 - All DTOs are Sendable → safe to pass between actors
 - No shared mutable state
 - No global singletons
 - XPC enforces Sendable boundaries
 
 G-2A vs Future:
 - G-2A: Manual state loading only
 - Future: Automatic periodic refresh
 - Future: XPC state updates from helper
 - Future: Background state observation
 - Future: Persistence and restoration
 */
