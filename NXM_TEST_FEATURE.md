# NXM Protocol Test Feature

## 🎯 Purpose

This feature allows users to verify that their NXM protocol registration is working correctly **before** attempting to download real mods from Nexus Mods. It helps diagnose the ampersand-splitting issue that causes 400 errors.

---

## 📍 Location

**Settings → NXM Protocol Registration → Test Protocol button**

---

## 🔍 What It Tests

The test verifies that when an NXM URL is clicked, **all query parameters** are received intact by the application:

### **Test URL Format:**

```
nxm://rivalsofaether2/mods/1/files/1?key=TEST_KEY_123&expires=9999999999&user_id=TEST_USER
```

### **Expected Parameters:**

1. ✅ `key=TEST_KEY_123`
2. ✅ `expires=9999999999`
3. ✅ `user_id=TEST_USER`

---

## 🚀 How to Use

### **Step 1: Open Settings**

1. Click the Settings button in the app
2. Scroll to "NXM Protocol Registration" section

### **Step 2: Ensure Protocol is Registered**

- If not registered, click "Register NXM Protocol" first
- Green checkmark should appear: "✅ NXM protocol is registered"

### **Step 3: Run the Test**

1. Click the **"Test Protocol"** button
2. Watch for toast notifications:
   - "Testing NXM protocol..." (sends test URL)
   - Wait 1.5 seconds for backend to process
   - Results appear automatically

### **Step 4: Check Results**

#### **✅ Test Passed (Green Alert)**

```
✅ Test Passed!
All query parameters received correctly:
• key=TEST_KEY_123
• expires=9999999999
• user_id=TEST_USER
```

**Meaning**: Your NXM protocol registration is correct! Real Nexus downloads should work.

---

#### **❌ Test Failed (Red Alert)**

```
❌ Test Failed - Parameters Missing!
The following parameters were NOT received: expires, user_id
```

**Meaning**: The ampersand-splitting bug is present. Parameters after `&` are being lost.

**What You'll See:**

- ✅ key=TEST_KEY_123 (present)
- ❌ expires=(missing)
- ❌ user_id=(missing)

---

## 🔧 What to Do If Test Fails

### **Solution 1: Re-register the Protocol**

1. Click "Unregister NXM Protocol"
2. Close the app completely
3. Reopen the app (Tauri automatically re-registers with correct quoting)
4. Run the test again

### **Solution 2: Manual Registry Fix**

If automatic registration doesn't work:

1. Press `Win + R`, type `regedit`, press Enter
2. Navigate to: `HKEY_CURRENT_USER\Software\Classes\nxm\shell\open\command`
3. Check the default value:
   - ❌ **Wrong**: `"C:\Path\To\App.exe" %1` (no quotes around %1)
   - ✅ **Correct**: `"C:\Path\To\App.exe" "%1"` (quotes around %1)
4. If wrong, close app and delete the entire `HKEY_CURRENT_USER\Software\Classes\nxm` key
5. Restart app to trigger fresh registration

---

## 🧪 Technical Details

### **Frontend (NxmProtocolSettings.tsx)**

**Test Flow:**

1. User clicks "Test Protocol" button
2. Frontend calls `openUrl("nxm://rivalsofaether2/mods/1/files/1?key=TEST_KEY_123&expires=9999999999&user_id=TEST_USER")`
3. Windows shell invokes registered protocol handler
4. Tauri receives URL via deep-link plugin
5. Tauri forwards to backend: `POST /api/nxm/handoff`
6. Backend stores URL in `_LAST_NXM_URL`
7. Frontend fetches result: `GET /api/nxm/last-received`
8. Toast shows pass/fail based on which parameters were received

**Code:**

```typescript
const handleTestProtocol = async () => {
  const testUrl =
    "nxm://rivalsofaether2/mods/1/files/1?key=TEST_KEY_123&expires=9999999999&user_id=TEST_USER";

  await openUrl(testUrl); // Trigger protocol handler

  setTimeout(async () => {
    const result = await getLastNxmUrl(); // Fetch what backend received

    if (result.last_url?.parsed) {
      const allParamsPresent =
        result.last_url.parsed.has_key &&
        result.last_url.parsed.has_expires &&
        result.last_url.parsed.has_user_id;

      if (allParamsPresent) {
        toast.success("✅ Test Passed!");
      } else {
        toast.error("❌ Test Failed - Parameters Missing!");
      }
    }
  }, 1500);
};
```

---

### **Backend (core/api/server.py)**

**Storage:**

```python
# Global variable to store last received NXM URL
_LAST_NXM_URL: Optional[Dict[str, Any]] = None
```

**Capture in Handoff Endpoint:**

```python
@app.post("/api/nxm/handoff")
def submit_nxm_handoff(payload):
    global _LAST_NXM_URL

    nxm_value = payload.get("nxm")

    # Store raw URL
    _LAST_NXM_URL = {
        "url": nxm_value,
        "received_at": datetime.utcnow().isoformat() + "Z",
    }

    # Parse and add detailed info
    nxm_request = parse_nxm_uri(nxm_value)
    _LAST_NXM_URL["parsed"] = {
        "game_domain": nxm_request.game_domain,
        "mod_id": nxm_request.mod_id,
        "file_id": nxm_request.file_id,
        "query_params": nxm_request.query,
        "has_key": bool(nxm_request.key),
        "has_expires": bool(nxm_request.expires),
        "has_user_id": bool(nxm_request.user_id),
    }

    # ... rest of handoff logic
```

**Retrieval Endpoint:**

```python
@app.get("/api/nxm/last-received")
def get_last_nxm_url():
    if _LAST_NXM_URL is None:
        return {
            "ok": True,
            "last_url": None,
            "message": "No NXM URL has been received yet",
        }

    return {
        "ok": True,
        "last_url": _LAST_NXM_URL,
    }
```

---

## 📊 Example Test Results

### **Successful Test (Correct Registration)**

**Visual Display:**

```
Last Test Results:
✅ key=TEST_KEY_123
✅ expires=9999999999
✅ user_id=TEST_USER

Received: 11/5/2025, 3:45:23 PM
```

**API Response:**

```json
{
  "ok": true,
  "last_url": {
    "url": "nxm://rivalsofaether2/mods/1/files/1?key=TEST_KEY_123&expires=9999999999&user_id=TEST_USER",
    "received_at": "2025-11-05T15:45:23.123Z",
    "parsed": {
      "game_domain": "rivalsofaether2",
      "mod_id": 1,
      "file_id": 1,
      "query_params": {
        "key": "TEST_KEY_123",
        "expires": "9999999999",
        "user_id": "TEST_USER"
      },
      "has_key": true,
      "has_expires": true,
      "has_user_id": true
    }
  }
}
```

---

### **Failed Test (Ampersand Splitting)**

**Visual Display:**

```
Last Test Results:
✅ key=TEST_KEY_123
❌ expires=(missing)
❌ user_id=(missing)

Received: 11/5/2025, 3:45:23 PM
```

**API Response:**

```json
{
  "ok": true,
  "last_url": {
    "url": "nxm://rivalsofaether2/mods/1/files/1?key=TEST_KEY_123",
    "received_at": "2025-11-05T15:45:23.123Z",
    "parsed": {
      "game_domain": "rivalsofaether2",
      "mod_id": 1,
      "file_id": 1,
      "query_params": {
        "key": "TEST_KEY_123"
      },
      "has_key": true,
      "has_expires": false,
      "has_user_id": false
    }
  }
}
```

---

## 🎓 Why This Helps

### **Before This Feature:**

1. User clicks "Mod Manager Download" on Nexus
2. Download fails with: `400: Provided key and expire time isn't correct`
3. User is confused - error message is misleading
4. User doesn't know if it's authentication, network, or protocol issue

### **After This Feature:**

1. User opens Settings → Test Protocol
2. Sees: "❌ expires and user_id parameters missing"
3. Knows immediately: NXM protocol registration is broken
4. Follows fix instructions to re-register
5. Tests again, sees: "✅ All parameters received"
6. Downloads now work!

---

## 🔗 Related Files

- **Frontend**: `src/components/NxmProtocolSettings.tsx`
- **API Types**: `src/lib/api.ts` (getLastNxmUrl function)
- **Backend**: `core/api/server.py` (submit_nxm_handoff, get_last_nxm_url)
- **Tauri**: `src-tauri/src/main.rs` (ensure_nxm_protocol_registration)

---

## ✅ Success Criteria

After implementing this feature, users can:

1. ✅ Self-diagnose NXM protocol issues without developer help
2. ✅ Verify the fix worked without downloading a real mod
3. ✅ Understand _why_ downloads were failing (missing parameters)
4. ✅ Test on multiple computers to compare configurations
5. ✅ Confirm proper registration before reporting bugs

---

## 🎯 Future Enhancements

Potential improvements:

1. **Auto-fix**: If test fails, automatically attempt re-registration
2. **History**: Show last 5 test results for comparison
3. **Copy button**: Copy raw URL and parsed data for bug reports
4. **Real URL test**: Option to test with an actual NXM link from Nexus
5. **Diagnostic report**: Generate full system + registry info for debugging

---

## 📝 User-Facing Help Text

**In-App Description:**

> **Test Protocol**: Click this button to verify that NXM links with query parameters (key, expires, user_id) are received correctly. The test will show you exactly which parameters are being received by the application. If any parameters are missing, it indicates the NXM protocol registration needs to be fixed.

**Success Toast:**

> ✅ Test Passed!
> All query parameters received correctly:
> • key=TEST_KEY_123
> • expires=9999999999
> • user_id=TEST_USER

**Failure Toast:**

> ❌ Test Failed - Parameters Missing!
> The following parameters were NOT received: expires, user_id. This indicates the NXM protocol registration may be incorrect. Try re-registering the protocol.

---

## 🛠️ Troubleshooting

### **Test button is disabled**

- **Cause**: Protocol is not registered
- **Fix**: Click "Register NXM Protocol" first

### **Test shows all parameters missing**

- **Cause**: Protocol not registered to this app
- **Fix**: Re-register the protocol

### **Test never completes**

- **Cause**: Backend not running or network issue
- **Fix**: Check that backend is running on port 8000

### **Test passes but real downloads fail**

- **Cause**: Different issue (authentication, expired keys, etc.)
- **Fix**: Check Nexus API key configuration, verify logged into Nexus

---

## 🎉 Impact

This feature transforms a mysterious, hard-to-diagnose error into a clear, testable condition with visible results. Users can now:

- **Self-serve**: Fix issues without developer intervention
- **Verify**: Confirm the fix before attempting real downloads
- **Report**: Provide clear diagnostic data when seeking help
- **Compare**: Test on multiple machines to identify environmental differences

It's the difference between:

- ❌ "Downloads don't work, I get a 400 error"
- ✅ "Test shows expires parameter is missing, I need to re-register"
