# Guardian G-1C: Files to Delete

## Manual Deletion Required

The following files must be manually deleted from the Xcode project.
These are legacy/deprecated files that have been superseded by the new Core/ structure.

### Step 1: Delete Legacy/Deprecated Files

**Delete these files (Move to Trash):**

1. `ContentView.swift`
   - Reason: Original Xcode starter template view
   - Replaced by: `GuardianRootView.swift`
   - Status: Marked @available(*, deprecated)

2. `HealthStatusDTO.swift`
   - Reason: G-1A legacy DTO
   - Replaced by: `Core/Models/GuardianHealthSnapshot.swift`
   - Status: Marked @available(*, deprecated)

3. `VisibilityState.swift` (struct version with LegacyVisibilityState)
   - Reason: G-1A legacy struct
   - Replaced by: `Core/Models/VisibilityState.swift` (enum version)
   - Status: Marked @available(*, deprecated)

4. `GuardianXPCMessages.swift` (with LegacyGuardianXPCMessages)
   - Reason: G-1A legacy placeholder
   - Replaced by: `Core/Protocols/GuardianXPCProtocol.swift`
   - Status: Marked @available(*, deprecated)

5. `UIGuardianRootView.swift` (if exists as separate file)
   - Reason: Duplicate of GuardianRootView.swift
   - Replaced by: `GuardianRootView.swift` (updated)
   - Status: Redundant

### Step 2: Verify No References

Before deleting, ensure no files reference these deprecated types:

```bash
# In Xcode, use Find in Project (⇧⌘F)
Search for: "HealthStatusDTO"
Search for: "LegacyVisibilityState"
Search for: "LegacyGuardianXPCMessages"
Search for: "ContentView"
```

**Expected:** Only found in the deprecated files themselves and this deletion guide.

### Step 3: Delete in Xcode

For each file:
1. Select file in Project Navigator
2. Right-click → **Delete**
3. Choose **"Move to Trash"** (not "Remove Reference")
4. Confirm deletion

### Step 4: Clean Build Folder

After deletion:
1. Product → Clean Build Folder (⇧⌘K)
2. Build project (⌘B)
3. Verify zero warnings

### Expected Result

After deletion, project structure should be:

```
Guardian/
├── Core/
│   ├── Models/
│   │   ├── GuardianHealthSnapshot.swift
│   │   ├── GuardianVisibilitySnapshot.swift
│   │   ├── GuardianRuntimeState.swift
│   │   ├── GuardianCapabilityState.swift
│   │   ├── GuardianSubsystemState.swift
│   │   ├── VisibilityState.swift
│   │   └── XPCConnectionState.swift
│   ├── Protocols/
│   │   └── GuardianXPCProtocol.swift
│   ├── Security/
│   │   ├── MutationFirewall.swift
│   │   └── NoNetworkPolicy.swift
│   ├── GuardianBuildConstants.swift
│   └── ConcurrencyGuidelines.swift
├── UI/
│   ├── GuardianApp.swift
│   └── GuardianRootView.swift
└── Tests/
    ├── GuardianTests.swift
    ├── GuardianUITests.swift
    └── GuardianUITestsLaunchTests.swift
```

### Files Marked for Deletion Summary

| File | Size Estimate | Reason | Replaced By |
|------|---------------|--------|-------------|
| ContentView.swift | ~30 lines | Xcode template | GuardianRootView.swift |
| HealthStatusDTO.swift | ~40 lines | G-1A legacy | GuardianHealthSnapshot.swift |
| VisibilityState.swift | ~30 lines | G-1A legacy struct | VisibilityState.swift (enum) |
| GuardianXPCMessages.swift | ~40 lines | G-1A legacy | GuardianXPCProtocol.swift |
| UIGuardianRootView.swift | ~130 lines | Duplicate | GuardianRootView.swift |

**Total:** ~5 files, ~270 lines of deprecated code

### Post-Deletion Checklist

- [ ] All 5 files deleted from Xcode
- [ ] Files removed from filesystem (Trash)
- [ ] Clean build folder executed
- [ ] Project builds successfully (⌘B)
- [ ] Zero compiler warnings
- [ ] Zero deprecated API warnings
- [ ] GuardianApp launches correctly
- [ ] GuardianRootView displays properly
- [ ] All status cards show expected states
- [ ] Footer shows "G-1C" phase

### If Build Fails After Deletion

1. Check for missed references to deleted types
2. Ensure all Core/Models files are added to target
3. Verify import statements are correct
4. Clean build folder and rebuild

### Completion

Once all files are deleted and build succeeds, G-1C cleanup is complete.
Proceed to create G-1C-COMPLETE.md to document final state.
