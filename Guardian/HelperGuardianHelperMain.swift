//
//  GuardianHelperMain.swift
//  GuardianHelper
//
//  Created by Jonathan Garnett on 5/8/26.
//

import Foundation

/// Main entry point for Guardian Helper XPC service.
///
/// G-2C: Minimal XPC service that responds to ping and health requests.
///
/// **Responsibilities:**
/// - Set up XPC listener
/// - Handle incoming connections
/// - Delegate to GuardianHelperService
///
/// **G-2C Limitations:**
/// - No filesystem monitoring
/// - No database access
/// - No FSEvents
/// - No automatic startup
/// - No SMAppService registration
/// - Returns static baseline responses only
@main
struct GuardianHelperMain {
    static func main() {
        // Create XPC listener for mach service
        let listener = NSXPCListener(machServiceName: GuardianXPCService.machServiceName)
        
        // Create delegate
        let delegate = GuardianHelperDelegate()
        listener.delegate = delegate
        
        // Resume listener (blocks until terminated)
        listener.resume()
        
        // Run loop
        RunLoop.current.run()
    }
}

/// Delegate for XPC listener.
///
/// G-2C: Handles incoming XPC connections.
class GuardianHelperDelegate: NSObject, NSXPCListenerDelegate {
    
    func listener(_ listener: NSXPCListener, shouldAcceptNewConnection newConnection: NSXPCConnection) -> Bool {
        // Set up the connection
        newConnection.exportedInterface = NSXPCInterface(with: GuardianXPCProtocol.self)
        
        // Create service object
        let service = GuardianHelperService()
        newConnection.exportedObject = service
        
        // Resume connection
        newConnection.resume()
        
        return true
    }
}
