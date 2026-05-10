//
//  GuardianRootView.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import SwiftUI

/// Root view for Guardian application.
///
/// G-1C: Updated to use GuardianRuntimeState and build constants.
/// G-2A: Updated to use GuardianViewModel for observable state management.
///
/// **State Management:**
/// - Observes GuardianViewModel (@Observable)
/// - Loads state on appear
/// - Updates automatically when state changes
/// - Provides manual refresh capability (future)
///
/// **Actor Isolation:**
/// - GuardianRootView runs on MainActor (all SwiftUI views do)
/// - GuardianViewModel is @MainActor, safe for direct binding
/// - State updates from GuardianStateActor propagate automatically
struct GuardianRootView: View {
    
    // G-2A: Observable view model for state management
    @State private var viewModel = GuardianViewModel()
    
    /// Computed property for easy access to runtime state
    private var runtimeState: GuardianRuntimeState {
        viewModel.runtimeState
    }
    
    var body: some View {
        VStack(spacing: 24) {
            // Header
            VStack(spacing: 8) {
                Text("Guardian")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Local Mac Nervous System")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                // G-2A: Show loading indicator
                if viewModel.isLoading {
                    ProgressView()
                        .controlSize(.small)
                }
            }
            .padding(.top, 32)
            
            Divider()
                .padding(.horizontal)
            
            // Status Cards
            VStack(spacing: 12) {
                StatusCard(
                    title: "Helper",
                    status: runtimeState.health.helperState.description,
                    systemImage: "gearshape.fill",
                    statusColor: statusColor(for: runtimeState.health.helperState.isHealthy)
                )
                
                StatusCard(
                    title: "XPC",
                    status: runtimeState.health.xpcConnectionState.description,
                    systemImage: "cable.connector",
                    statusColor: statusColor(for: runtimeState.health.xpcConnectionState.isHealthy)
                )
                
                StatusCard(
                    title: "Network",
                    status: runtimeState.health.networkState.description,
                    systemImage: "network.slash",
                    statusColor: statusColor(for: runtimeState.health.networkState.isHealthy)
                )
                
                StatusCard(
                    title: "Mutation Firewall",
                    status: runtimeState.health.mutationFirewallState.description,
                    systemImage: "shield.fill",
                    statusColor: statusColor(for: runtimeState.health.mutationFirewallState.isHealthy)
                )
                
                StatusCard(
                    title: "Visibility",
                    status: runtimeState.visibility.state.description,
                    systemImage: "eye.fill",
                    statusColor: statusColor(for: runtimeState.visibility.state.isAcceptable)
                )
            }
            .padding(.horizontal)
            
            // G-2C: XPC Debug Controls
            VStack(spacing: 8) {
                Text("XPC Debug Controls")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                HStack(spacing: 12) {
                    Button("Connect") {
                        Task {
                            await viewModel.connectToHelper()
                        }
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Ping") {
                        Task {
                            await viewModel.pingHelper()
                        }
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Health") {
                        Task {
                            await viewModel.fetchHelperHealth()
                        }
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Disconnect") {
                        Task {
                            await viewModel.disconnectFromHelper()
                        }
                    }
                    .buttonStyle(.bordered)
                }
                
                if let error = viewModel.lastError {
                    Text("Error: \(error.localizedDescription)")
                        .font(.caption2)
                        .foregroundStyle(.red)
                        .lineLimit(2)
                }
            }
            .padding(.horizontal)
            
            Spacer()
            
            // Footer
            VStack(spacing: 4) {
                Text("\(GuardianVersion.phase) • \(GuardianVersion.phaseDescription)")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                
                if runtimeState.isSafeMode {
                    Text("Safe Mode • No Active Functionality")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
                
                // G-2A: Show last updated timestamp
                Text("Updated: \(runtimeState.lastUpdated.formatted(date: .omitted, time: .shortened))")
                    .font(.caption2)
                    .foregroundStyle(.quaternary)
                
                Text("v\(GuardianVersion.app) • Read-Only • Local-Only • Private")
                    .font(.caption2)
                    .foregroundStyle(.quaternary)
            }
            .padding(.bottom, 16)
        }
        .frame(minWidth: 400, minHeight: 550)
        // G-2A: Load state when view appears
        .task {
            await viewModel.loadState()
        }
    }
    
    /// Determine status color based on health
    private func statusColor(for isHealthy: Bool) -> Color {
        isHealthy ? .green : .secondary
    }
}

/// Status card component for displaying Guardian component states.
private struct StatusCard: View {
    let title: String
    let status: String
    let systemImage: String
    let statusColor: Color
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundStyle(statusColor)
                .frame(width: 32)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                
                Text(status)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

#Preview {
    GuardianRootView()
}

