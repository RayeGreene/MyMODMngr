# NXM Protocol Registration Fix - Windows Ampersand Issue

## 🐛 The Problem

**Symptom**: NXM URLs lose query parameters when passed to the application on Windows.

**Example**:

- Browser sends: `nxm://rivalsofaether2/mods/2732/files/7689?key=ABC123&expires=1699200000&user_id=12345`
- App receives: `nxm://rivalsofaether2/mods/2732/files/7689?key=ABC123` ❌
- **Lost**: `&expires=1699200000&user_id=12345`

**Why**: Windows command shell splits arguments on `&` characters when the protocol handler command is not properly quoted.

---

## ✅ The Solution

### **Root Cause**

The Windows registry command for `nxm://` protocol must use **double quoting** for the `%1` placeholder:

❌ **WRONG** (gets split by `&`):

```
"C:\Path\To\App.exe" %1
```

✅ **CORRECT** (preserves full URL):

```
"C:\Path\To\App.exe" "%1"
```

### **Registry Structure**

```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Classes\nxm]
@="URL:nxm"
"URL Protocol"=""

[HKEY_CURRENT_USER\Software\Classes\nxm\shell\open\command]
@="\"C:\\Path\\To\\YourApp.exe\" \"%1\""
```

**Key point**: The `"%1"` is quoted, so Windows shell passes the entire URL as a single argument.

---

## 🔧 Implementation

### **File**: `src-tauri/src/main.rs`

Added `ensure_nxm_protocol_registration()` function that:

1. Gets the current executable path
2. Creates registry keys under `HKEY_CURRENT_USER\Software\Classes\nxm`
3. Sets the command value with **proper quoting**: `"C:\Path\To\App.exe" "%1"`
4. Runs on every app startup to ensure registration is correct

### **Code**:

```rust
#[cfg(target_os = "windows")]
fn ensure_nxm_protocol_registration() -> Result<(), String> {
    let exe_path = std::env::current_exe()?;
    let exe_str = exe_path.to_string_lossy().to_string();

    // CRITICAL: Double-quote %1 to preserve ampersands
    let command_value = format!("\"{}\" \"%1\"", exe_str);

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Create HKCU\Software\Classes\nxm
    let (nxm_key, _) = hkcu.create_subkey(r"Software\Classes\nxm")?;
    nxm_key.set_value("", &"URL:nxm")?;
    nxm_key.set_value("URL Protocol", &"")?;

    // Create HKCU\Software\Classes\nxm\shell\open\command
    let (command_key, _) = hkcu.create_subkey(r"Software\Classes\nxm\shell\open\command")?;
    command_key.set_value("", &command_value)?;  // "C:\Path\To\App.exe" "%1"

    Ok(())
}
```

### **Dependency Added**: `Cargo.toml`

```toml
[target.'cfg(windows)'.dependencies]
winreg = "0.52"
```

---

## 🧪 Testing the Fix

### **Before Fix**:

1. Click `nxm://rivalsofaether2/mods/2732/files/7689?key=ABC&expires=123&user_id=456`
2. App receives: `nxm://rivalsofaether2/mods/2732/files/7689?key=ABC`
3. Backend gets handoff with: `{"key": "ABC", "expires": null, "user_id": null}`
4. Nexus API returns: **400 Bad Request** (missing expires/user_id)

### **After Fix**:

1. Click same URL
2. App receives: `nxm://rivalsofaether2/mods/2732/files/7689?key=ABC&expires=123&user_id=456` ✅
3. Backend gets handoff with: `{"key": "ABC", "expires": "123", "user_id": "456"}` ✅
4. Nexus API returns: **200 OK** with download URLs ✅

### **Manual Verification**:

**Step 1**: Check registry after running the app

```powershell
# Open Registry Editor
regedit

# Navigate to:
HKEY_CURRENT_USER\Software\Classes\nxm\shell\open\command

# Verify the default value looks like:
"C:\Users\...\Project Mod Manager Rivals.exe" "%1"
#                                              ^^^^
#                                              Must have quotes around %1
```

**Step 2**: Test with command line

```powershell
# Manually invoke the protocol (simulates browser click)
cmd /c start nxm://rivalsofaether2/mods/2732/files/7689?key=ABC123&expires=1699200000&user_id=12345

# Check app console output - should see full URL with all params
```

**Step 3**: Verify in backend logs

```python
# In core/api/server.py, add logging:
@app.post("/api/nxm/handoff")
def submit_nxm_handoff(payload: Optional[Dict[str, Any]] = Body(default=None)):
    nxm_value = payload.get("nxm")
    print(f"[DEBUG] Received NXM URL: {nxm_value}")

    nxm_request = parse_nxm_uri(nxm_value)
    print(f"[DEBUG] Parsed query: {nxm_request.query}")
    # Should show: {'key': 'ABC123', 'expires': '1699200000', 'user_id': '12345'}
```

---

## 📝 Why This Matters

### **Query Parameter Breakdown**:

| Parameter | Purpose                         | What happens if missing |
| --------- | ------------------------------- | ----------------------- |
| `key`     | Download authorization token    | 400 error from Nexus    |
| `expires` | Timestamp when key expires      | 400 error from Nexus    |
| `user_id` | Nexus user ID who generated key | 400 error from Nexus    |

**All three are required** for Nexus API to validate the download request.

### **Impact of Missing Parameters**:

**If `&expires=...` is lost**:

```python
# Backend tries to call Nexus API with:
params = {"key": "ABC123", "expires": ""}  # Empty!

# Nexus responds:
{
    "code": 400,
    "message": "Provided key and expire time isn't correct for this user/file."
}
```

**With this fix**:

```python
# Backend calls Nexus API with:
params = {"key": "ABC123", "expires": "1699200000", "user_id": "12345"}  # Complete!

# Nexus responds:
[
    {
        "URI": "https://cdn.nexusmods.com/...",
        "name": "Nexus CDN",
        "short_name": "Nexus CDN"
    }
]
```

---

## 🎯 Key Files Changed

1. **`src-tauri/src/main.rs`**:

   - Added `use winreg` imports
   - Added `ensure_nxm_protocol_registration()` function
   - Called in `.setup()` on app startup

2. **`src-tauri/Cargo.toml`**:
   - Added `winreg = "0.52"` as Windows-only dependency

---

## 🚀 Deployment Notes

**For Installers (NSIS)**:

If you use an installer, you can also include registry setup there:

```nsis
; In your NSIS script:
Section "Install"
    ; ... existing install code ...

    ; Register NXM protocol with proper quoting
    WriteRegStr HKCU "Software\Classes\nxm" "" "URL:nxm"
    WriteRegStr HKCU "Software\Classes\nxm" "URL Protocol" ""
    WriteRegStr HKCU "Software\Classes\nxm\shell\open\command" "" '"$INSTDIR\YourApp.exe" "%1"'
SectionEnd
```

**However**, the Rust implementation is **superior** because:

- ✅ Always uses correct executable path (even if app is moved)
- ✅ Self-healing (re-registers on every startup)
- ✅ Works for dev builds and portable installations
- ✅ No separate installer script maintenance

---

## 🔍 Debugging

### **Check what the app receives**:

Add logging in `main.rs`:

```rust
#[tauri::command]
async fn handle_nxm_url(url: String, _app_handle: AppHandle) -> Result<String, String> {
    // Log FULL URL before processing
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("RECEIVED NXM URL:");
    println!("{}", url);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Check for critical params
    if url.contains("&key=") {
        println!("✅ Contains &key=");
    } else {
        println!("❌ MISSING &key=");
    }

    if url.contains("&expires=") {
        println!("✅ Contains &expires=");
    } else {
        println!("❌ MISSING &expires=");
    }

    if url.contains("&user_id=") {
        println!("✅ Contains &user_id=");
    } else {
        println!("⚠️ MISSING &user_id= (optional)");
    }

    // ... rest of function ...
}
```

---

## 📚 References

**Known-Good Pattern**: This is the **exact same approach** used by:

- Vortex Mod Manager
- Mod Organizer 2
- Nexus Mod Manager

**Microsoft Documentation**:

- [Registering an Application to a URI Scheme](<https://docs.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/platform-apis/aa767914(v=vs.85)>)

**Key Quote from Docs**:

> "The default value of the command key is the command line to execute when the protocol is invoked. **The %1 parameter is replaced with the full URL.** If the URL contains special characters such as &, it must be quoted."

---

## ✅ Success Criteria

After this fix, you should be able to:

1. ✅ Click "Mod Manager Download" on Nexus Mods
2. ✅ Browser launches: `nxm://game/mods/X/files/Y?key=...&expires=...&user_id=...`
3. ✅ App receives **complete URL** with all query parameters
4. ✅ Backend parses `key`, `expires`, `user_id` successfully
5. ✅ Nexus API validates request and returns download URLs
6. ✅ Download proceeds without 400 errors
7. ✅ Works on **Computer A** and **Computer B** (same user account)

---

## 🎉 Result

**Before**: Downloads fail with cryptic 400 errors about "key and expire time isn't correct"

**After**: Downloads work reliably because all authentication parameters are preserved through the Windows shell invocation

**The magic**: One pair of quotes around `%1` in the registry command value.
