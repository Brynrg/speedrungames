# Guardian G-2C.5: Helper Target Creation & Build Verification

## Phase: G-2C.5

### Objective
Create the GuardianHelper Xcode target and verify both app and helper build successfully.

---

## ⚠️ MANUAL XCODE CONFIGURATION REQUIRED

The code is ready, but **Xcode target creation must be done manually** because:
- Target creation modifies `.xcodeproj` internal structure
- Requires Xcode's build system configuration
- Cannot be done programmatically via file edits

---

## Step-by-Step Target Creation Instructions

### Step 1: Create New Target

1. **Open Xcode project**
2. **Select the project** in Project Navigator (top-level blue icon)
3. **Click the "+" button** at the bottom of the targets list
4. **Select:** macOS → Application Extension → **XPC Service**
5. **Click "Next"**

### Step 2: Configure Target Settings

**Product Name:** `GuardianHelper`

**Organization Name:** Garnett Labs

**Organization Identifier:** `com.garnettlabs`

**Bundle Identifier:** `com.garnettlabs.GuardianHelper`

**Language:** Swift

**Click "Finish"**

### Step 3: Configure Build Settings

Select `GuardianHelper` target → Build Settings:

**Swift Language Version:**
- Set to: **Swift 6**

**Swift Compiler - Code Generation:**
- Strict Concurrency Checking: **Complete**

**Deployment Info:**
- Minimum Deployment Target: **macOS 13.0**

**Architectures:**
- Build Active Architecture Only (Debug): **Yes**
- Architectures: **Standard (arm64, x86_64)**

### Step 4: Configure Info.plist

Edit `GuardianHelper/Info.plist` (or add these keys):

```xml
<key>CFBundleIdentifier</key>
<string>com.garnettlabs.GuardianHelper</string>

<key>MachServices</key>
<dict>
    <key>com.garnettlabs.Guardian.xpc</key>
    <true/>
</dict>

<key>NSPrincipalClass</key>
<string>$(PRODUCT_MODULE_NAME).GuardianHelperMain</string>
```

### Step 5: Add Files to Target

**Remove default files:**
- Delete the auto-generated `main.swift` if present

**Add Helper-Only Files:**

Select these files and check **GuardianHelper** target membership:
- `Helper/GuardianHelperMain.swift`
- `Helper/GuardianHelperService.swift`

**Add Shared Files to BOTH Targets:**

Select these files and check **BOTH** `Guardian` and `GuardianHelper` target membership:
- `Core/Protocols/GuardianXPCProtocol.swift`
- `Core/GuardianBuildConstants.swift`
- All files in `Core/Models/`:
  - `GuardianHealthSnapshot.swift`
  - `GuardianVisibilitySnapshot.swift`
  - `GuardianRuntimeState.swift`
  - `GuardianCapabilityState.swift`
  - `GuardianSubsystemState.swift`
  - `VisibilityState.swift`
  - `XPCConnectionState.swift`

**Verify Target Membership:**

For each file above:
1. Select the file in Project Navigator
2. Open File Inspector (⌘⌥1)
3. Under "Target Membership", verify correct checkboxes

### Step 6: Configure Scheme

1. **Product → Scheme → Manage Schemes**
2. **Verify** `GuardianHelper` scheme exists
3. **Shared:** Check the box (optional, for team sharing)

---

## Bundle IDs and Mach Service Names

### Updated Values (G-2C.5)

All identifiers now use `com.garnettlabs` namespace:

**Main App:**
- Bundle ID: `com.garnettlabs.Guardian`

**Helper:**
- Bundle ID: `com.garnettlabs.GuardianHelper`
- Mach Service: `com.garnettlabs.Guardian.xpc`

**These values are defined in:**
- `Core/Protocols/GuardianXPCProtocol.swift` → `GuardianXPCService`
- `Core/GuardianBuildConstants.swift` → `GuardianServiceIdentifier`

---

## Build Verification

### Build Commands

**App Target:**
```bash
xcodebuild -scheme Guardian -configuration Debug clean build
```

**Helper Target:**
```bash
xcodebuild -scheme GuardianHelper -configuration Debug clean build
```

**Both Targets:**
```bash
xcodebuild -project Guardian.xcodeproj -alltargets -configuration Debug clean build
```

### Expected Results

**Guardian App:**
```
** BUILD SUCCEEDED **
```

**GuardianHelper:**
```
** BUILD SUCCEEDED **
```

**Products:**
- `Guardian.app` (main application)
- `GuardianHelper.xpc` (XPC service bundle)

---

## Test Verification

### Test Command

```bash
xcodebuild test -scheme Guardian -destination 'platform=macOS'
```

### Expected Result

```
Test Suite 'All tests' passed
     44 tests passed in X.XXX seconds
```

**Tests:**
- GuardianXPCTests: 14 tests
- GuardianStateActorTests: 17 tests (from G-2A)
- GuardianViewModelTests: 9 tests (from G-2A)
- ConcurrencyComplianceTests: 4 tests (from G-2A)

---

## Forbidden API Scan

### App Target Scan
✅ No Network framework
✅ No URLSession
✅ No FileManager scanning
✅ No FSEvents
✅ No mutation APIs
✅ No database packages

### Helper Target Scan
✅ No Network framework
✅ No URLSession
✅ No FileManager scanning
✅ No FSEvents
✅ No mutation APIs
✅ No database packages
✅ No AI/ML frameworks

**Method:**

Run these searches in helper code:
```bash
# Search for forbidden APIs
grep -r "import Network" Helper/
grep -r "URLSession" Helper/
grep -r "FSEvents" Helper/
grep -r "removeItem" Helper/
grep -r "SQLite" Helper/
```

**Expected:** All searches return empty (no matches)

---

## Target Membership Summary

### Guardian (App) Target

**App-Only Files:**
- `GuardianApp.swift`
- `GuardianRootView.swift`
- `GuardianViewModel.swift`
- `Core/Services/GuardianStateActor.swift`
- `Core/Services/GuardianXPCClient.swift`
- `Core/Security/MutationFirewall.swift`
- `Core/Security/NoNetworkPolicy.swift`
- `Core/ConcurrencyGuidelines.swift`

**Shared Files (also in Helper):**
- `Core/Protocols/GuardianXPCProtocol.swift`
- `Core/GuardianBuildConstants.swift`
- All `Core/Models/*.swift` files

### GuardianHelper Target

**Helper-Only Files:**
- `Helper/GuardianHelperMain.swift`
- `Helper/GuardianHelperService.swift`

**Shared Files (also in App):**
- `Core/Protocols/GuardianXPCProtocol.swift`
- `Core/GuardianBuildConstants.swift`
- All `Core/Models/*.swift` files

### Test Targets

**GuardianTests:**
- `Tests/GuardianTests.swift`
- `Tests/GuardianXPCTests.swift`
- Shares app target code via `@testable import Guardian`

---

## Files Changed (G-2C.5)

### Updated Files (2 files)

1. **Core/Protocols/GuardianXPCProtocol.swift**
   - Updated `GuardianXPCService.helperBundleID` to `com.garnettlabs.GuardianHelper`
   - Updated `GuardianXPCService.machServiceName` to `com.garnettlabs.Guardian.xpc`

2. **Core/GuardianBuildConstants.swift**
   - Updated `GuardianServiceIdentifier.mainApp` to `com.garnettlabs.Guardian`
   - Updated `GuardianServiceIdentifier.helper` to `com.garnettlabs.GuardianHelper`
   - Updated `GuardianServiceIdentifier.helperMachService` to `com.garnettlabs.Guardian.xpc`
   - Updated `GuardianServiceIdentifier.helperLaunchdLabel` to `com.garnettlabs.GuardianHelper`

---

## Troubleshooting

### Build Error: "No such module 'Foundation'"

**Cause:** Target not linked to Foundation framework

**Fix:**
1. Select GuardianHelper target
2. Build Phases → Link Binary With Libraries
3. Click "+" → Add Foundation.framework

### Build Error: "Cannot find type 'GuardianHealthSnapshot'"

**Cause:** Shared DTO files not added to helper target

**Fix:**
1. Select `Core/Models/GuardianHealthSnapshot.swift`
2. File Inspector → Target Membership
3. Check `GuardianHelper` box

### Build Error: Duplicate symbols

**Cause:** File added to target twice

**Fix:**
1. Find the file in Compile Sources
2. Remove duplicate entry

### XPC Connection Error: "Failed to establish connection"

**Cause:** Mach service name mismatch

**Fix:**
1. Verify Info.plist has `com.garnettlabs.Guardian.xpc`
2. Verify code uses `GuardianXPCService.machServiceName`
3. Clean build folders and rebuild both targets

---

## Verification Checklist

Before proceeding to G-2D, verify:

- [ ] GuardianHelper target created in Xcode
- [ ] Target configured as XPC Service
- [ ] Bundle ID: `com.garnettlabs.GuardianHelper`
- [ ] Mach service: `com.garnettlabs.Guardian.xpc` in Info.plist
- [ ] Swift 6 and Strict Concurrency enabled
- [ ] Helper files added to GuardianHelper target
- [ ] Shared files added to BOTH targets
- [ ] App builds successfully (`⌘B` on Guardian scheme)
- [ ] Helper builds successfully (`⌘B` on GuardianHelper scheme)
- [ ] All tests pass (`⌘U` on Guardian scheme)
- [ ] Forbidden API scan shows no violations
- [ ] `GuardianHelper.xpc` product created in DerivedData

---

## Is G-2C.5 Complete?

### Status: ⚠️ **MANUAL ACTION REQUIRED**

**Code Changes:** ✅ **COMPLETE**
- Bundle IDs updated to `com.garnettlabs`
- Mach service names updated
- All helper code ready

**Xcode Configuration:** ⚠️ **PENDING MANUAL SETUP**
- GuardianHelper target must be created manually
- Files must be assigned to correct targets
- Build settings must be configured

**Once manual setup is complete:**

✅ **G-2C.5 WILL BE COMPLETE**

---

## Next Steps

### Immediate (Manual)

1. **Create GuardianHelper target** in Xcode (see instructions above)
2. **Configure target settings** (Swift 6, Strict Concurrency)
3. **Add files to targets** (helper-only and shared)
4. **Configure Info.plist** (Mach service)
5. **Build both targets** and verify success
6. **Run tests** and verify all pass

### After Manual Setup

7. **Verify products:**
   - `Guardian.app` exists in build folder
   - `GuardianHelper.xpc` exists in build folder

8. **Test XPC connection** (will still fail because helper not installed)
   - Connection attempt should show "helper not running" error
   - This is expected until G-2D (SMAppService installation)

---

## Recommended Next Phase: G-2D

Once G-2C.5 manual setup is complete and both targets build:

### G-2D: Helper Installation & Registration

**Goal:** Use SMAppService to install and register the helper.

**Scope:**
- Add SMAppService entitlement to main app
- Implement helper registration/unregistration
- Add installation UI flow
- Handle installation errors
- Verify helper persists across reboots

**After G-2D:**
- Helper can be installed via SMAppService
- Helper starts automatically
- XPC connection works end-to-end
- Ping and health snapshot functional

---

## Summary

**G-2C.5 Code Changes: COMPLETE**

Updated:
- ✅ Bundle IDs to `com.garnettlabs` namespace
- ✅ Mach service to `com.garnettlabs.Guardian.xpc`
- ✅ Service identifiers in constants

Ready for:
- ⚠️ Manual Xcode target creation
- ⚠️ File target membership assignment
- ⚠️ Build settings configuration

**Action Required:** Follow the step-by-step instructions above to create the GuardianHelper target in Xcode.

**After manual setup:** Both targets will build, tests will pass, and G-2C.5 will be complete.

---

**End of G-2C.5 Instructions**
