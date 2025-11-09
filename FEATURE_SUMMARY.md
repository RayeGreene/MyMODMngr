# Summary: NXM Protocol Testing Feature

## ✅ What Was Added

A **"Test Protocol" button** in Settings that allows users to verify their NXM protocol registration is working correctly before attempting real mod downloads.

---

## 🎯 Problem Solved

**Original Issue**: Users getting 400 errors on one computer but not another, with confusing error message:

```
"Failed to download Nexus mod: Nexus download link request failed (400):
Provided key and expire time isn't correct for this user/file."
```

**Root Cause**: Windows registry command for `nxm://` protocol not using proper quoting, causing ampersands to split the URL:

- ❌ Wrong: `"App.exe" %1` → URL splits at `&` characters
- ✅ Right: `"App.exe" "%1"` → Full URL preserved

**Solution**: Added test button that verifies all query parameters (`key`, `expires`, `user_id`) are received intact.

---

## 📝 Files Changed

### **Backend: `core/api/server.py`**

**Added:**

1. Global variable `_LAST_NXM_URL` to store last received URL
2. Modified `submit_nxm_handoff()` to capture and parse incoming URLs
3. New endpoint: `GET /api/nxm/last-received` to retrieve test results

**Code:**

```python
# Store last NXM URL for testing
_LAST_NXM_URL: Optional[Dict[str, Any]] = None

@app.post("/api/nxm/handoff")
def submit_nxm_handoff(payload):
    global _LAST_NXM_URL
    nxm_value = payload.get("nxm")

    # Store raw URL + timestamp
    _LAST_NXM_URL = {
        "url": nxm_value,
        "received_at": datetime.utcnow().isoformat() + "Z",
    }

    # Parse and add details
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
    # ... rest of logic

@app.get("/api/nxm/last-received")
def get_last_nxm_url():
    return {"ok": True, "last_url": _LAST_NXM_URL}
```

---

### **Frontend: `src/lib/api.ts`**

**Added:**

- `LastNxmUrl` type definition
- `getLastNxmUrl()` API function

**Code:**

```typescript
export type LastNxmUrl = {
  ok: boolean;
  last_url: {
    url: string;
    received_at: string;
    parsed?: {
      game_domain: string;
      mod_id: number;
      file_id: number;
      query_params: Record<string, string>;
      has_key: boolean;
      has_expires: boolean;
      has_user_id: boolean;
    };
    parse_error?: string;
  } | null;
  message?: string;
};

export async function getLastNxmUrl(): Promise<LastNxmUrl> {
  return getJson<LastNxmUrl>("/api/nxm/last-received");
}
```

---

### **Frontend: `src/components/NxmProtocolSettings.tsx`**

**Added:**

1. Import `openUrl` from Tauri shell plugin
2. State variables for test results
3. `handleTestProtocol()` function
4. "Test Protocol" button (only visible when registered)
5. Test results display with visual parameter checklist

**Key Features:**

- Sends test URL: `nxm://rivalsofaether2/mods/1/files/1?key=TEST_KEY_123&expires=9999999999&user_id=TEST_USER`
- Waits 1.5 seconds for backend to process
- Fetches result from `/api/nxm/last-received`
- Shows toast with pass/fail status
- Displays visual checklist of which parameters were received

**UI:**

```
┌─────────────────────────────────────────┐
│ NXM Protocol Registration               │
├─────────────────────────────────────────┤
│ ✅ NXM protocol is registered           │
│                                         │
│ [Register] [Test Protocol] 🧪           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Last Test Results:                  │ │
│ │ ✅ key=TEST_KEY_123                 │ │
│ │ ✅ expires=9999999999               │ │
│ │ ✅ user_id=TEST_USER                │ │
│ │ Received: 11/5/2025, 3:45 PM        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🚀 How Users Use It

### **Step-by-Step:**

1. **Open Settings** → Scroll to "NXM Protocol Registration"
2. **Ensure registered** → Green checkmark should show
3. **Click "Test Protocol"** button
4. **Watch toast notifications**:
   - "Testing NXM protocol..."
   - Wait 1.5 seconds
   - "✅ Test Passed!" OR "❌ Test Failed!"
5. **View detailed results** in alert box showing which parameters were received

### **Success Case:**

```
✅ Test Passed!
All query parameters received correctly:
• key=TEST_KEY_123
• expires=9999999999
• user_id=TEST_USER
```

### **Failure Case:**

```
❌ Test Failed - Parameters Missing!
The following parameters were NOT received: expires, user_id
```

---

## 🔍 What It Diagnoses

### **Test Verifies:**

1. ✅ NXM protocol is registered and functional
2. ✅ URLs are passed from browser → Windows → Tauri → Backend
3. ✅ Query parameters survive Windows shell invocation
4. ✅ Ampersands (`&`) don't split the URL into multiple arguments

### **What Failures Indicate:**

- **All parameters missing** → Protocol not registered or wrong app
- **Only `key` received** → Ampersand splitting bug (main issue)
- **Parse error** → Malformed URL or parser bug
- **No response** → Backend not running or connectivity issue

---

## 🎯 Why This Matters

### **Before:**

- User: "Downloads fail with 400 error"
- Dev: "Check your API key / Are you logged in? / Try different computer"
- User: "I tried everything, still broken"
- Dev: "Can you send logs?"
- **Result**: Hours of back-and-forth debugging

### **After:**

- User: "Downloads fail"
- Dev: "Click Test Protocol button in Settings"
- User: "Test shows missing expires and user_id parameters"
- Dev: "Re-register the protocol"
- User: "Test passes now, downloads work!"
- **Result**: Self-service fix in 2 minutes

---

## 📊 Technical Flow

```
┌─────────────┐
│ User clicks │
│ "Test       │
│  Protocol"  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ Frontend calls:                     │
│ openUrl("nxm://game/...?key=X&...") │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Windows Registry:               │
│ "App.exe" "%1" (with quotes!)   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Tauri deep-link plugin          │
│ receives full URL intact        │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Rust forwards to backend:       │
│ POST /api/nxm/handoff           │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Backend stores URL in           │
│ _LAST_NXM_URL global variable   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Frontend (after 1.5s delay):    │
│ GET /api/nxm/last-received      │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Check parsed.has_key,           │
│       parsed.has_expires,       │
│       parsed.has_user_id        │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Show toast + visual results:    │
│ ✅ key=...                      │
│ ✅ expires=...                  │
│ ✅ user_id=...                  │
└─────────────────────────────────┘
```

---

## ✅ Testing Checklist

- [x] Backend builds without errors
- [x] Frontend builds without errors
- [x] New endpoint `/api/nxm/last-received` accessible
- [x] Test button appears in Settings when registered
- [x] Test button disabled when not registered
- [x] Clicking test opens NXM URL
- [x] Backend receives and stores URL
- [x] Frontend fetches and displays results
- [x] Success toast shows when all params present
- [x] Failure toast shows when params missing
- [x] Visual checklist shows ✅/❌ for each parameter
- [x] Dismiss button hides results alert

---

## 🎓 User Education

### **In-App Help Text:**

> **Test Protocol**: Click this button to verify that NXM links with query parameters (key, expires, user_id) are received correctly. If any parameters are missing, it indicates the NXM protocol registration needs to be fixed.

### **Troubleshooting Guide:**

1. **Test fails** → Re-register protocol
2. **Test passes but downloads fail** → Check Nexus API key
3. **Test never completes** → Check backend is running
4. **Button disabled** → Register protocol first

---

## 📝 Documentation Created

1. **NXM_TEST_FEATURE.md** - Comprehensive technical documentation
2. **NXM_PROTOCOL_FIX.md** - Original ampersand fix documentation
3. **NXM_FIX_SUMMARY.md** - Summary of protocol registration fix
4. **TESTING_GUIDE.md** - Quick testing instructions
5. **NXM_DOWNLOAD_COMPLETE_CODE_FLOW.md** - Full code walkthrough

---

## 🎉 Impact

This feature transforms a mysterious error into a **testable, diagnosable, fixable** condition:

| Before                          | After                                  |
| ------------------------------- | -------------------------------------- |
| "Downloads don't work"          | "Test shows missing parameters"        |
| Hours of debugging              | 2-minute self-service fix              |
| No way to verify fix            | Click test, see green checkmarks       |
| Different behavior per computer | Test on each computer, compare results |
| Misleading error messages       | Clear visual parameter checklist       |

**Bottom line**: Users can now **self-diagnose and fix** the ampersand-splitting bug without developer intervention.
