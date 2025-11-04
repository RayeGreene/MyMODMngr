# Complete NXM Download Flow Analysis

## 🔍 Your Issue: 400 Error on Different Computer

**Error**: `{"code":400,"message":"Provided key and expire time isn't correct for this user/file."}`

**This means**: The download authorization (key + expires) is not valid for the current user on the second computer.

---

## 📋 Complete NXM Protocol Flow

### **Step 1: User Clicks "Mod Manager Download" on Nexus Mods Website**

**What happens:**

- Nexus generates an `nxm://` URL with authentication parameters
- Example URL structure:
  ```
  nxm://rivalsofaether2/mods/123/files/456?key=ABC123XYZ&expires=1699123456&user_id=789
  ```

**URL Parameters:**

- `game`: `rivalsofaether2` (game domain)
- `mod_id`: `123` (the mod being downloaded)
- `file_id`: `456` (specific file version)
- `key`: `ABC123XYZ` (time-limited download authorization token)
- `expires`: `1699123456` (Unix timestamp - when the key expires)
- `user_id`: `789` (Nexus user ID - optional but important!)

**⚠️ CRITICAL**: These parameters are generated **per-user, per-session** by Nexus Mods when you're logged in.

---

### **Step 2: Windows Launches Your Tauri App**

**File**: `src-tauri/src/main.rs` (lines 35-62)

```rust
// Tauri command to handle NXM protocol URLs
#[tauri::command]
async fn handle_nxm_url(url: String, _app_handle: AppHandle) -> Result<String, String> {
    println!("Received NXM URL: {}", url);

    // Forward the NXM URL to the backend API
    let client = reqwest::Client::new();
    let backend_url = "http://127.0.0.1:8000/api/nxm/handoff";

    let payload = serde_json::json!({
        "nxm": url  // Full nxm:// URL with all parameters
    });

    match client.post(backend_url)
        .json(&payload)
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(format!("NXM URL forwarded to backend: {}", url))
            } else {
                Err(format!("Backend returned error: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Failed to contact backend: {}", e))
    }
}
```

**What happens:**

1. Tauri app receives the full `nxm://` URL from Windows
2. Forwards it to Python backend at `http://127.0.0.1:8000/api/nxm/handoff`
3. No processing - just passes it through

---

### **Step 3: Backend Receives NXM Handoff**

**File**: `core/api/server.py` (lines 1765-1787)

```python
@app.post("/api/nxm/handoff")
def submit_nxm_handoff(payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    nxm_value: Optional[str] = None
    if payload is not None:
        nxm_value = payload.get("nxm")

    if not isinstance(nxm_value, str) or not nxm_value.strip():
        raise HTTPException(status_code=400, detail="nxm field is required")

    try:
        # Parse the nxm:// URL into structured data
        nxm_request = parse_nxm_uri(nxm_value)
    except NXMParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Extract metadata (key, expires, user_id, etc.)
    metadata = snapshot_metadata(nxm_request)

    # Store the handoff request in memory/database
    record = register_handoff(nxm_request, metadata=metadata)

    logger.info(
        "[nxm_handoff] received id=%s game=%s mod_id=%s file_id=%s",
        record["id"],
        nxm_request.game_domain,
        nxm_request.mod_id,
        nxm_request.file_id,
    )

    return {"ok": True, "handoff": serialize_handoff(record)}
```

**What happens:**

1. Parses `nxm://` URL to extract:

   - `game_domain` (rivalsofaether2)
   - `mod_id` (123)
   - `file_id` (456)
   - `key` (ABC123XYZ) ← **CRITICAL**
   - `expires` (1699123456) ← **CRITICAL**
   - `user_id` (789) ← **CRITICAL**

2. Creates a "handoff" record with all this data
3. Returns handoff ID to frontend

**⚠️ At this point**: The `key`, `expires`, and `user_id` are stored in the handoff record.

---

### **Step 4: User Clicks "Download" in Your App**

**Frontend** calls: `POST /api/nxm/handoff/{handoff_id}/ingest`

**File**: `core/api/server.py` (lines 2018-2177)

```python
@app.post("/api/nxm/handoff/{handoff_id}/ingest")
def ingest_nxm_handoff(handoff_id: str, payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    # ... (setup code)

    # Get the handoff record (contains key, expires, user_id)
    record = get_handoff_or_404(handoff_id)

    # ... (file selection logic)

    # ⭐ THIS IS WHERE THE DOWNLOAD HAPPENS ⭐
    download_path, resolved_url = _download_archive_via_nxm(record, game_domain, file_id)

    # ... (ingestion and activation logic)
```

---

### **Step 5: Resolve Nexus Download Link** 🔑 **CRITICAL STEP**

**File**: `core/api/server.py` (lines 3489-3594)

```python
def _resolve_nexus_download_candidates(
    record: Dict[str, Any],
    game_domain: str,
    file_id: int,
) -> List[Tuple[str, Optional[str]]]:

    request_data = record.get("request", {})
    metadata = record.get("metadata", {})

    # Extract the stored authentication parameters
    query = request_data.get("query", {})
    key = str(query.get("key") or metadata.get("key") or "").strip()
    expires = str(query.get("expires") or metadata.get("expires") or "").strip()
    user_id = str(query.get("user_id") or "").strip()

    # ⚠️ VALIDATION CHECKPOINT
    if not key or not expires:
        raise HTTPException(
            status_code=400,
            detail="nxm handoff missing download authorization; please click Mod Manager Download again",
        )

    # Build API request to Nexus
    params = {"key": key, "expires": expires}
    if user_id:
        params["user_id"] = user_id

    api_query = urllib.parse.urlencode(params)
    api_url = (
        f"https://api.nexusmods.com/v1/games/{domain}/mods/{mod_id}/files/{file_id}/download_link.json"
    )
    if api_query:
        api_url = f"{api_url}?{api_query}"  # Adds ?key=...&expires=...&user_id=...

    headers = {
        "User-Agent": "MarvelRivalsModManager/0.1",
        "Accept": "application/json",
    }

    # Add API key if configured
    api_key = get_api_key()
    if api_key:
        headers["apikey"] = api_key
        headers["Application-Name"] = "MarvelRivalsModManager"
        headers["Application-Version"] = "0.1.0"

    # ⭐ MAKE REQUEST TO NEXUS API ⭐
    req = urllib.request.Request(api_url, headers=headers, method="GET")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.getcode() or 0
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        # ⚠️ THIS IS WHERE YOUR 400 ERROR COMES FROM
        body = None
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass

        detail = body or exc.reason or str(exc)

        # YOUR ERROR: exc.code = 400, body = {"code":400,"message":"Provided key and expire time isn't correct for this user/file."}
        raise HTTPException(
            status_code=exc.code or 502,
            detail=f"Nexus download link request failed ({exc.code}): {detail}"
        )
```

**What happens:**

1. Retrieves `key`, `expires`, and `user_id` from the handoff record
2. Builds Nexus API URL:
   ```
   https://api.nexusmods.com/v1/games/rivalsofaether2/mods/123/files/456/download_link.json?key=ABC123XYZ&expires=1699123456&user_id=789
   ```
3. Makes HTTP GET request to Nexus
4. **Nexus validates**:

   - ✅ Is the `key` valid?
   - ✅ Has the `expires` time passed?
   - ✅ Does the `user_id` match the user who generated the key?
   - ✅ Is the `key` authorized for this specific file?

5. If validation passes → Nexus returns CDN download URLs
6. If validation fails → **400 error with your message**

---

### **Step 6: Download from CDN**

**File**: `core/api/server.py` (lines 3596-3625)

```python
def _download_archive_via_nxm(
    record: Dict[str, Any],
    game_domain: str,
    file_id: int,
) -> Tuple[Path, str]:

    # Get download URLs from Nexus API (Step 5)
    candidates = _resolve_nexus_download_candidates(record, game_domain, file_id)

    # Try each CDN URL
    for download_url, label in candidates:
        try:
            download_path = _download_remote_archive(download_url, force=True)
            logger.info("[nxm_handoff] download succeeded host=%s saved_as=%s", host, download_path.name)
            return download_path, download_url
        except HTTPException as exc:
            # Try next CDN
            continue

    raise HTTPException(status_code=502, detail=f"Failed to download from Nexus CDN")
```

---

## 🚨 **Why It Fails on Different Computer**

### **Root Cause Analysis:**

The error `"Provided key and expire time isn't correct for this user/file"` happens because:

### **Scenario 1: Different Nexus Account**

- **Computer A**: Logged into Nexus as `User_A` (user_id=789)
- **Computer B**: Logged into Nexus as `User_B` (user_id=456) **OR NOT LOGGED IN**
- When you click "Mod Manager Download" on Computer B, Nexus generates a key for `User_B`
- The key is **tied to the specific user** who generated it
- If Computer A tries to use Computer B's key → **400 error**

### **Scenario 2: Expired Key**

- NXM keys have a **time limit** (usually 24 hours)
- If you generate an `nxm://` link on Computer A today
- Try to use it on Computer B tomorrow → **Key expired → 400 error**

### **Scenario 3: Browser Session Mismatch**

- Nexus uses **browser cookies** to verify you're logged in
- Computer A: Chrome with Nexus session
- Computer B: Different browser or no session → Nexus can't verify user → **400 error**

### **Scenario 4: IP Address / Region Check**

- Some CDN keys are tied to your **IP address** or **region**
- Computer A: Home network (IP: 1.2.3.4)
- Computer B: Different network (IP: 5.6.7.8)
- Nexus might reject the key from a different IP → **400 error**

---

## ✅ **Solutions**

### **Solution 1: Generate Fresh NXM Link on Each Computer**

**Best Practice:**

1. On Computer B, open Nexus Mods in browser
2. Log in to your Nexus account
3. Navigate to the mod page
4. Click "Mod Manager Download" **on Computer B**
5. Use the newly generated `nxm://` link

**Why this works:** Fresh key is tied to the current user session on Computer B

---

### **Solution 2: Use Nexus API Key (Recommended)**

**What it does:** Bypasses per-session keys using your permanent API key

**How to set it up:**

1. **Get API Key:**

   - Go to https://www.nexusmods.com/users/myaccount?tab=api
   - Generate Personal API Key
   - Copy the key (looks like: `abc123def456ghi789...`)

2. **Configure in App:**

   - Open your mod manager
   - Go to Settings
   - Find "Nexus API Key" field
   - Paste your API key
   - Save

3. **How it helps:**
   - The API key in `headers["apikey"]` authenticates you
   - Even if the download `key`/`expires` params are invalid
   - Nexus can fall back to your API key for authentication

**Code reference** (server.py line 3530):

```python
api_key = get_api_key()
if api_key:
    headers["apikey"] = api_key
    headers["Application-Name"] = "MarvelRivalsModManager"
    headers["Application-Version"] = "0.1.0"
```

---

### **Solution 3: Check for Same User Across Computers**

**Verify:**

1. Computer A → Check which Nexus account is logged in
2. Computer B → Check which Nexus account is logged in
3. Ensure **same account** on both computers

**Browser session check:**

```bash
# On Computer B, in browser console on nexusmods.com:
console.log(document.cookie);  // Should show user session cookies
```

---

### **Solution 4: Debug the Key Parameters**

**Add logging to see what's being sent:**

**File**: `core/api/server.py` around line 3520

```python
# Add this logging before making the API request
logger.info(f"[DEBUG] Nexus API request: {api_url}")
logger.info(f"[DEBUG] key={key[:10]}... expires={expires} user_id={user_id}")
logger.info(f"[DEBUG] Headers: {headers}")
```

**Check logs on both computers:**

- Computer A (working): `key=ABC123... expires=1699200000 user_id=789`
- Computer B (failing): `key=XYZ456... expires=1699100000 user_id=456`

**If user_id is different → Different accounts**
**If expires is in the past → Expired key**
**If key is empty → Parsing error**

---

## 🔍 **Debugging Steps**

### **1. Check if API Key is Configured**

```python
# In Python backend console or logs:
from core.nexus.nexus_api import get_api_key
print(f"API Key configured: {bool(get_api_key())}")
```

### **2. Inspect Handoff Record**

```bash
# GET http://127.0.0.1:8000/api/nxm/handoffs
# Look at the handoff data:
{
  "request": {
    "query": {
      "key": "...",
      "expires": "...",
      "user_id": "..."
    }
  }
}
```

### **3. Test Nexus API Directly**

```bash
# On Computer B, test the API manually:
curl -H "apikey: YOUR_NEXUS_API_KEY" \
  "https://api.nexusmods.com/v1/games/rivalsofaether2/mods/123/files/456/download_link.json?key=ABC&expires=1699123456&user_id=789"
```

If this returns 400 → Key is invalid
If this returns 200 → Issue is elsewhere in your app

---

## 📊 **Summary**

| Step | Component        | Action                               | Critical Data                       |
| ---- | ---------------- | ------------------------------------ | ----------------------------------- |
| 1    | Nexus Website    | Generate nxm:// link                 | `key`, `expires`, `user_id`         |
| 2    | Tauri (Rust)     | Receive URL, forward to backend      | Full URL string                     |
| 3    | Backend (Python) | Parse URL, create handoff            | Store auth params                   |
| 4    | Frontend (React) | User clicks Download                 | Trigger ingest                      |
| 5    | Backend (Python) | **Request download link from Nexus** | ⚠️ **Validate key/expires/user_id** |
| 6    | Nexus API        | Verify authentication                | Return CDN URLs or 400 error        |
| 7    | Backend (Python) | Download from CDN                    | Save to disk                        |

**⚠️ The 400 error happens at Step 5-6** when Nexus rejects the authentication.

**Most likely cause**: Different user account or expired key on Computer B.

**Best fix**: Configure Nexus API Key in Settings on Computer B.
