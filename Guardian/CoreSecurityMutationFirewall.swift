//
//  MutationFirewall.swift
//  Guardian
//
//  Created by Jonathan Garnett on 5/7/26.
//

import Foundation

/// Guardian Mutation Firewall - Architectural placeholder for future enforcement.
/// G-1C: Documentation and type definitions only. No runtime blocking yet.
///
/// Purpose:
/// - Document forbidden filesystem mutations
/// - Establish compile-time API contract
/// - Prepare for future helper-level enforcement
///
/// Philosophy:
/// Guardian is READ-ONLY. The permanent layer NEVER mutates the filesystem.
/// All mutation operations are forbidden in the Guardian codebase.

// MARK: - Forbidden Operation Registry

/// Registry of filesystem operations that are FORBIDDEN in Guardian.
/// G-1C: Compile-time documentation only. Runtime enforcement in future phases.
enum ForbiddenFilesystemOperation: String, CaseIterable, Sendable {
    
    // MARK: FileManager Destructive Operations
    
    /// FileManager.removeItem(at:) - FORBIDDEN
    case removeItem = "FileManager.removeItem(at:)"
    
    /// FileManager.trashItem(at:) - FORBIDDEN
    case trashItem = "FileManager.trashItem(at:)"
    
    /// FileManager.moveItem(at:to:) - FORBIDDEN
    case moveItem = "FileManager.moveItem(at:to:)"
    
    /// FileManager.copyItem(at:to:) - FORBIDDEN (creates new data)
    case copyItem = "FileManager.copyItem(at:to:)"
    
    /// FileManager.createDirectory(at:) - FORBIDDEN
    case createDirectory = "FileManager.createDirectory(at:)"
    
    /// FileManager.createFile(atPath:) - FORBIDDEN
    case createFile = "FileManager.createFile(atPath:)"
    
    /// FileManager.setAttributes(_:ofItemAtPath:) - FORBIDDEN
    case setAttributes = "FileManager.setAttributes(_:ofItemAtPath:)"
    
    // MARK: POSIX/C-level Destructive Operations
    
    /// unlink() - FORBIDDEN
    case unlink = "unlink()"
    
    /// remove() - FORBIDDEN
    case remove = "remove()"
    
    /// rmdir() - FORBIDDEN
    case rmdir = "rmdir()"
    
    /// rename() - FORBIDDEN
    case rename = "rename()"
    
    /// clonefile() - FORBIDDEN
    case clonefile = "clonefile()"
    
    /// copyfile() - FORBIDDEN
    case copyfile = "copyfile()"
    
    // MARK: Extended Attribute Operations
    
    /// setxattr() - FORBIDDEN
    case setxattr = "setxattr()"
    
    /// removexattr() - FORBIDDEN
    case removexattr = "removexattr()"
    
    // MARK: File Descriptor Write Operations
    
    /// write() - FORBIDDEN (to filesystem)
    case write = "write()"
    
    /// pwrite() - FORBIDDEN
    case pwrite = "pwrite()"
    
    /// ftruncate() - FORBIDDEN
    case ftruncate = "ftruncate()"
    
    // MARK: Directory Operations
    
    /// mkdir() - FORBIDDEN
    case mkdir = "mkdir()"
    
    /// mkdtemp() - FORBIDDEN
    case mkdtemp = "mkdtemp()"
    
    // MARK: Link Operations
    
    /// symlink() - FORBIDDEN
    case symlink = "symlink()"
    
    /// link() - FORBIDDEN
    case link = "link()"
    
    /// unlink() - FORBIDDEN
    case unlinkDuplicate = "unlink() [symlink removal]"
    
    /// Human-readable description
    var description: String {
        rawValue
    }
    
    /// Category of forbidden operation
    var category: ForbiddenOperationCategory {
        switch self {
        case .removeItem, .trashItem, .unlink, .remove, .rmdir:
            return .deletion
        case .moveItem, .rename:
            return .relocation
        case .copyItem, .clonefile, .copyfile:
            return .duplication
        case .createDirectory, .createFile, .mkdir, .mkdtemp:
            return .creation
        case .setAttributes, .setxattr, .removexattr:
            return .metadataMutation
        case .write, .pwrite, .ftruncate:
            return .contentMutation
        case .symlink, .link, .unlinkDuplicate:
            return .linkManipulation
        }
    }
}

/// Categories of forbidden operations
enum ForbiddenOperationCategory: String, Sendable {
    case deletion = "Deletion"
    case relocation = "Relocation"
    case duplication = "Duplication"
    case creation = "Creation"
    case metadataMutation = "Metadata Mutation"
    case contentMutation = "Content Mutation"
    case linkManipulation = "Link Manipulation"
}

// MARK: - Mutation Firewall State

/// State of the mutation firewall (future runtime enforcement).
/// G-1C: Placeholder for future phases.
struct MutationFirewallState: Codable, Sendable, Equatable {
    
    /// Whether the firewall is enabled (future)
    let isEnabled: Bool
    
    /// Whether the firewall is actively enforcing (future)
    let isEnforcing: Bool
    
    /// Number of blocked attempts since boot (future)
    let blockedAttempts: Int
    
    /// Last verification timestamp
    let lastVerified: Date?
    
    /// Baseline state for G-1C (firewall not implemented yet)
    static let baseline = MutationFirewallState(
        isEnabled: false,
        isEnforcing: false,
        blockedAttempts: 0,
        lastVerified: nil
    )
}

// MARK: - Future Enforcement Architecture

/// Guardian Mutation Firewall Enforcement Strategy (Future Phases)
///
/// Phase G-3: Static Analysis
/// - Add build-time linting to detect forbidden API usage
/// - Fail compilation if mutation APIs are referenced
/// - SwiftLint custom rules for forbidden operations
///
/// Phase G-4: Runtime Enforcement (Helper Level)
/// - Helper process validates all operations
/// - Reject any operation that would mutate filesystem
/// - Log violation attempts
/// - Alert user to malicious behavior
///
/// Phase G-5: Sandboxing
/// - Helper runs with minimal permissions
/// - Sandbox profile prevents write operations
/// - System-level enforcement via entitlements
///
/// Enforcement Layers:
/// 1. Compile-time: Code review + static analysis
/// 2. Runtime: Helper-level validation
/// 3. System-level: Sandbox + entitlements
/// 4. Monitoring: FSEvents detects unexpected mutations

// MARK: - Compile-Time API Contract

/// Marker protocol indicating a type performs READ-ONLY operations.
/// G-1C: Compile-time documentation marker.
protocol ReadOnlyOperation {
    /// All operations in this type are guaranteed to be read-only.
    /// No filesystem mutations are performed.
}

/// Marker protocol indicating a type is FORBIDDEN from Guardian.
/// G-1C: Compile-time documentation marker.
protocol ForbiddenInGuardian {
    /// This operation is explicitly forbidden in Guardian.
    /// Any usage should fail code review.
}

// MARK: - Documentation

/// Guardian Mutation Firewall Rules (G-1C)
///
/// FORBIDDEN OPERATIONS:
/// ❌ Creating files or directories
/// ❌ Deleting files or directories
/// ❌ Moving or renaming files
/// ❌ Copying or cloning files
/// ❌ Modifying file contents
/// ❌ Modifying file attributes or extended attributes
/// ❌ Creating or removing symlinks
/// ❌ Any operation that alters filesystem state
///
/// ALLOWED OPERATIONS:
/// ✅ Reading file contents
/// ✅ Reading file metadata
/// ✅ Reading directory contents
/// ✅ Listing directory entries
/// ✅ Checking file existence
/// ✅ Reading extended attributes
/// ✅ Observing filesystem changes (FSEvents)
/// ✅ Building in-memory indices
///
/// RATIONALE:
/// Guardian is a "nervous system" - it OBSERVES but does NOT ACT.
/// All mutations are external to Guardian's control.
/// This ensures Guardian cannot be weaponized to delete or modify data.
