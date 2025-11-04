# Quick Testing Guide - NXM Protocol Fix

## 🚀 Quick Start

1. **Build the app**:

   ```bash
   cd src-tauri
   cargo build
   ```

2. **Run the app**:

   ```bash
   cargo run
   ```

3. **Look for this in console**:
   ```
   [NXM Protocol] Registering with command: "C:\...\App.exe" "%1"
   [NXM Protocol] Successfully registered nxm:// protocol
   ```

---

## ✅ Verify Registry (Windows)

### **Option 1: Registry Editor**

1. Press `Win + R`
2. Type `regedit` and press Enter
3. Navigate to: `HKEY_CURRENT_USER\Software\Classes\nxm\shell\open\command`
4. Check the default value:
   - ✅ GOOD: `"C:\Path\To\App.exe" "%1"` (has quotes around %1)
   - ❌ BAD: `"C:\Path\To\App.exe" %1` (no quotes around %1)

### **Option 2: PowerShell**

```powershell
# Check what command is registered
Get-ItemProperty -Path "HKCU:\Software\Classes\nxm\shell\open\command" | Select-Object -ExpandProperty "(default)"

# Should show something like:
# "C:\Users\YourName\...\Project Mod Manager Rivals.exe" "%1"
```

---

## 🧪 Test Real NXM Link

### **Method 1: From Browser**

1. Go to https://www.nexusmods.com/rivalsofaether2/mods/
2. Pick any mod
3. Click "Mod Manager Download"
4. App should open and show download

### **Method 2: From Command Line**

```powershell
# Test with a fake NXM URL (will fail at download but tests parameter passing)
cmd /c start "nxm://rivalsofaether2/mods/1/files/1?key=TEST&expires=999&user_id=123"
```

### **Method 3: Test URL from File**

Create `test_nxm.url`:

```
[InternetShortcut]
URL=nxm://rivalsofaether2/mods/2732/files/7689?key=ABC&expires=123&user_id=456
```

Double-click it to launch.

---

## 🔍 Check What App Receives

### **Add Debug Logging** (temporary):

Edit `src-tauri/src/main.rs` in the `handle_nxm_url` function:

```rust
#[tauri::command]
async fn handle_nxm_url(url: String, _app_handle: AppHandle) -> Result<String, String> {
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    println!("FULL URL RECEIVED:");
    println!("{}", url);
    println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Check parameters
    if url.contains("&expires=") {
        println!("✅ Has &expires= parameter");
    } else {
        println!("❌ MISSING &expires= parameter!");
    }

    if url.contains("&user_id=") {
        println!("✅ Has &user_id= parameter");
    } else {
        println!("⚠️ No &user_id= parameter (optional)");
    }

    // ... rest of function
}
```

**Expected output** (BEFORE fix):

```
FULL URL RECEIVED:
nxm://rivalsofaether2/mods/1/files/1?key=ABC
❌ MISSING &expires= parameter!
⚠️ No &user_id= parameter (optional)
```

**Expected output** (AFTER fix):

```
FULL URL RECEIVED:
nxm://rivalsofaether2/mods/1/files/1?key=ABC&expires=123&user_id=456
✅ Has &expires= parameter
✅ Has &user_id= parameter
```

---

## 📊 Compare Before/After

### **Test Case**: Click this NXM link

```
nxm://rivalsofaether2/mods/2732/files/7689?key=ABC123&expires=1699200000&user_id=12345
```

### **Before Fix**:

| Step                     | What Happens                                                    |
| ------------------------ | --------------------------------------------------------------- |
| 1. Browser launches URL  | `nxm://...?key=ABC123&expires=1699200000&user_id=12345`         |
| 2. Windows shell invokes | `App.exe nxm://...?key=ABC123 expires=1699200000 user_id=12345` |
| 3. App receives          | `nxm://...?key=ABC123` ❌                                       |
| 4. Backend parses        | `{"key": "ABC123", "expires": null, "user_id": null}`           |
| 5. Nexus API call        | 400 Bad Request ❌                                              |

### **After Fix**:

| Step                     | What Happens                                                      |
| ------------------------ | ----------------------------------------------------------------- |
| 1. Browser launches URL  | `nxm://...?key=ABC123&expires=1699200000&user_id=12345`           |
| 2. Windows shell invokes | `App.exe "nxm://...?key=ABC123&expires=1699200000&user_id=12345"` |
| 3. App receives          | `nxm://...?key=ABC123&expires=1699200000&user_id=12345` ✅        |
| 4. Backend parses        | `{"key": "ABC123", "expires": "1699200000", "user_id": "12345"}`  |
| 5. Nexus API call        | 200 OK ✅                                                         |

---

## 🐛 Troubleshooting

### **Issue**: Registry still shows old command without quotes

**Solution**:

1. Close all app instances
2. Delete the registry key:
   ```powershell
   Remove-Item -Path "HKCU:\Software\Classes\nxm" -Recurse -Force
   ```
3. Run the app again (will recreate with correct quotes)

### **Issue**: App doesn't receive any URL

**Check**:

1. Is the app running when you click the link?
2. Does the executable path in registry match your current build?
3. Try: `Get-ItemProperty "HKCU:\Software\Classes\nxm\shell\open\command"`

**Fix**:
Run the app once to re-register, then test again.

### **Issue**: Still getting 400 errors

**Verify**:

1. ✅ URL has all parameters (check console logs)
2. ✅ Backend receives complete URL
3. ✅ Nexus API key is configured (optional but recommended)

**Debug**:
Add logging in `core/api/server.py`:

```python
@app.post("/api/nxm/handoff")
def submit_nxm_handoff(payload):
    nxm_value = payload.get("nxm")
    print(f"[DEBUG] Backend received: {nxm_value}")

    nxm_request = parse_nxm_uri(nxm_value)
    print(f"[DEBUG] Parsed query: {nxm_request.query}")
```

---

## ✅ Success Checklist

- [ ] App builds without errors
- [ ] Registry shows command with quotes: `"...\App.exe" "%1"`
- [ ] Console shows "Successfully registered nxm:// protocol"
- [ ] Test NXM link includes `&expires=` and `&user_id=` in received URL
- [ ] Backend logs show complete parsed query parameters
- [ ] Real Nexus download completes without 400 error

---

## 🎯 Quick Commands

```powershell
# Build
cd src-tauri; cargo build

# Run
cargo run

# Check registry
Get-ItemProperty "HKCU:\Software\Classes\nxm\shell\open\command"

# Test fake NXM link
cmd /c start "nxm://test/mods/1/files/1?key=A&expires=B&user_id=C"

# Clear registry (for fresh test)
Remove-Item "HKCU:\Software\Classes\nxm" -Recurse -Force
```

---

## 📝 Notes

- Registration happens automatically on app startup
- No manual registry editing needed
- Self-healing: if registry gets corrupted, just restart app
- Works in dev mode (`cargo run`) and production builds
- Changes persist after app closes
