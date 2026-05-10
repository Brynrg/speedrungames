//
//  NoNetworkPolicy.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// Guardian No-Network Policy - Architectural guarantee of zero network access.
/// G-1C: Documentation and compile-time enforcement placeholders.
///
/// Purpose:
/// - Document forbidden networking operations
/// - Establish compile-time API contract
/// - Prevent accidental networking dependencies
/// - Prepare for build-time enforcement
///
/// Philosophy:
/// Guardian is LOCAL-ONLY. Zero network access. Zero cloud dependencies.
/// All network operations are forbidden in the Guardian codebase.

// MARK: - Forbidden Networking APIs

/// Registry of networking APIs that are FORBIDDEN in Guardian.
/// G-1C: Compile-time documentation only. Build-time enforcement in future phases.
enum ForbiddenNetworkingAPI: String, CaseIterable, Sendable {
    
    // MARK: URLSession Family
    
    /// URLSession - FORBIDDEN
    case urlSession = "URLSession"
    
    /// URLSessionConfiguration - FORBIDDEN
    case urlSessionConfiguration = "URLSessionConfiguration"
    
    /// URLSessionTask - FORBIDDEN
    case urlSessionTask = "URLSessionTask"
    
    /// URLSessionDataTask - FORBIDDEN
    case urlSessionDataTask = "URLSessionDataTask"
    
    /// URLSessionUploadTask - FORBIDDEN
    case urlSessionUploadTask = "URLSessionUploadTask"
    
    /// URLSessionDownloadTask - FORBIDDEN
    case urlSessionDownloadTask = "URLSessionDownloadTask"
    
    // MARK: Network Framework
    
    /// Network.framework - FORBIDDEN
    case networkFramework = "Network.framework"
    
    /// NWConnection - FORBIDDEN
    case nwConnection = "NWConnection"
    
    /// NWListener - FORBIDDEN
    case nwListener = "NWListener"
    
    /// NWEndpoint - FORBIDDEN
    case nwEndpoint = "NWEndpoint"
    
    // MARK: CFNetwork
    
    /// CFNetwork - FORBIDDEN
    case cfNetwork = "CFNetwork"
    
    /// CFHTTPMessage - FORBIDDEN
    case cfHTTPMessage = "CFHTTPMessage"
    
    /// CFHost - FORBIDDEN
    case cfHost = "CFHost"
    
    // MARK: POSIX Sockets
    
    /// socket() - FORBIDDEN
    case socket = "socket()"
    
    /// connect() - FORBIDDEN
    case connect = "connect()"
    
    /// bind() - FORBIDDEN
    case bind = "bind()"
    
    /// listen() - FORBIDDEN
    case listen = "listen()"
    
    /// accept() - FORBIDDEN
    case accept = "accept()"
    
    /// send() - FORBIDDEN
    case send = "send()"
    
    /// recv() - FORBIDDEN
    case recv = "recv()"
    
    // MARK: DNS/Name Resolution
    
    /// gethostbyname() - FORBIDDEN
    case gethostbyname = "gethostbyname()"
    
    /// getaddrinfo() - FORBIDDEN
    case getaddrinfo = "getaddrinfo()"
    
    /// DNSServiceRef - FORBIDDEN
    case dnsService = "DNSServiceRef"
    
    /// Human-readable description
    var description: String {
        rawValue
    }
    
    /// Category of forbidden API
    var category: ForbiddenNetworkingCategory {
        switch self {
        case .urlSession, .urlSessionConfiguration, .urlSessionTask,
             .urlSessionDataTask, .urlSessionUploadTask, .urlSessionDownloadTask:
            return .urlSession
        case .networkFramework, .nwConnection, .nwListener, .nwEndpoint:
            return .networkFramework
        case .cfNetwork, .cfHTTPMessage, .cfHost:
            return .cfNetwork
        case .socket, .connect, .bind, .listen, .accept, .send, .recv:
            return .posixSockets
        case .gethostbyname, .getaddrinfo, .dnsService:
            return .dnsResolution
        }
    }
}

/// Categories of forbidden networking APIs
enum ForbiddenNetworkingCategory: String, Sendable {
    case urlSession = "URLSession"
    case networkFramework = "Network Framework"
    case cfNetwork = "CFNetwork"
    case posixSockets = "POSIX Sockets"
    case dnsResolution = "DNS Resolution"
}

// MARK: - No-Network Policy State

/// State of the no-network policy enforcement (future runtime verification).
/// G-1C: Placeholder for future phases.
struct NoNetworkPolicyState: Codable, Sendable, Equatable {
    
    /// Whether policy verification is enabled (future)
    let isVerificationEnabled: Bool
    
    /// Whether the app/helper has zero network frameworks linked (future)
    let hasZeroNetworkFrameworks: Bool
    
    /// Whether runtime network calls were detected (future)
    let networkCallsDetected: Int
    
    /// Last verification timestamp
    let lastVerified: Date?
    
    /// Baseline state for G-1C (verification not implemented yet)
    static let baseline = NoNetworkPolicyState(
        isVerificationEnabled: false,
        hasZeroNetworkFrameworks: true, // by design
        networkCallsDetected: 0,
        lastVerified: nil
    )
}

// MARK: - Future Enforcement Architecture

/// Guardian No-Network Policy Enforcement Strategy (Future Phases)
///
/// Phase G-3: Build-Time Enforcement
/// - Add build script to verify zero network framework linkage
/// - Fail build if URLSession or Network.framework is linked
/// - Static analysis to detect networking API imports
/// - SwiftLint rules for forbidden imports
///
/// Phase G-4: Linker-Level Enforcement
/// - Configure helper target to NOT link networking frameworks
/// - Use -Xlinker flags to prevent accidental linkage
/// - Validate dynamic library dependencies
///
/// Phase G-5: Runtime Verification
/// - At launch, verify no network frameworks loaded
/// - Check dyld loaded images for forbidden libraries
/// - Alert if unexpected networking detected
///
/// Phase G-6: System-Level Enforcement
/// - Sandbox profile denies network access
/// - Entitlements: com.apple.security.network.client = NO
/// - System enforces zero network access
///
/// Enforcement Layers:
/// 1. Code review: Manual inspection of imports
/// 2. Static analysis: Build-time API detection
/// 3. Linker: Prevent framework linkage
/// 4. Runtime: Verify loaded libraries
/// 5. Sandbox: System-level network denial

// MARK: - Compile-Time API Contract

/// Marker protocol indicating a type performs NO networking.
/// G-1C: Compile-time documentation marker.
protocol NoNetworkOperation {
    /// All operations in this type are guaranteed to be local-only.
    /// No network access is performed.
}

/// Marker protocol indicating a framework/type is FORBIDDEN from Guardian.
/// G-1C: Compile-time documentation marker.
protocol ForbiddenNetworkFramework {
    /// This framework is explicitly forbidden in Guardian.
    /// Any import should fail code review and build.
}

// MARK: - Documentation

/// Guardian No-Network Policy Rules (G-1C)
///
/// FORBIDDEN FRAMEWORKS:
/// ❌ URLSession
/// ❌ Network.framework
/// ❌ CFNetwork
/// ❌ Any HTTP/HTTPS client library
/// ❌ Any socket-based networking
/// ❌ Any DNS resolution library
/// ❌ Any cloud service SDK (AWS, Google Cloud, Azure, etc.)
/// ❌ Any analytics framework
/// ❌ Any crash reporting service
/// ❌ Any telemetry library
///
/// FORBIDDEN OPERATIONS:
/// ❌ Making HTTP/HTTPS requests
/// ❌ Opening network sockets
/// ❌ DNS lookups
/// ❌ Connecting to remote servers
/// ❌ Listening on network ports
/// ❌ Sending or receiving network data
/// ❌ Downloading or uploading files
/// ❌ WebSocket connections
/// ❌ Any outbound or inbound network traffic
///
/// ALLOWED OPERATIONS:
/// ✅ Reading local files
/// ✅ Writing to local database (future)
/// ✅ Local IPC (XPC between Guardian processes only)
/// ✅ Reading system logs (local only)
/// ✅ Local filesystem monitoring
/// ✅ Local process monitoring
///
/// RATIONALE:
/// - Privacy: User data never leaves the machine
/// - Security: No remote attack surface
/// - Trust: Verifiable local-only behavior
/// - Reliability: No dependency on external services
/// - Permanence: Works offline forever
///
/// This is a PERMANENT architectural constraint.
/// Guardian will NEVER have network access, in any form, ever.

// MARK: - Build-Time Verification (Future)

/// Placeholder for future build-time network policy verification.
/// G-3+: Will verify zero networking dependencies at build time.
enum NetworkPolicyBuildVerification {
    
    /// Frameworks that must NOT be linked in Guardian target
    static let forbiddenFrameworks: Set<String> = [
        "CFNetwork",
        "Network",
        // Foundation is allowed but URLSession usage is forbidden
    ]
    
    /// Symbols that must NOT appear in Guardian binary
    static let forbiddenSymbols: Set<String> = [
        "_OBJC_CLASS_$_NSURLSession",
        "_OBJC_CLASS_$_NSURLSessionConfiguration",
        "___CFSocketCreateWithNative",
        "_socket",
        "_connect",
        "_bind",
        "_listen",
    ]
    
    /// Future: Build script will verify these constraints
    static func verifyNoNetworking() -> Bool {
        // G-3+: Implementation will:
        // 1. Parse binary with otool/nm
        // 2. Check linked frameworks
        // 3. Search for forbidden symbols
        // 4. Return false if any networking detected
        return true // Placeholder
    }
}
