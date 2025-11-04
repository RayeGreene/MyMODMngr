# Complete NXM Download Code Flow - Deep Dive

## 🚨 Your Error Analysis

**Error Message**:

```
Failed to download Nexus mod: Nexus download link request failed (400):
{"code":400,"message":"Provided key and expire time isn't correct for this user/file."}
```

**Where it happens**: `core/api/server.py` line 3544 (in `_resolve_nexus_download_candidates`)

---

## 📋 Complete Code Flow with Functions

### **STEP 1: User Clicks NXM Link → Tauri Receives**

**File**: `src-tauri/src/main.rs` lines 35-62

```rust
#[tauri::command]
async fn handle_nxm_url(url: String, _app_handle: AppHandle) -> Result<String, String> {
    println!("Received NXM URL: {}", url);

    // Example URL: nxm://rivalsofaether2/mods/123/files/456?key=ABC&expires=1699123456&user_id=789

    let client = reqwest::Client::new();
    let backend_url = "http://127.0.0.1:8000/api/nxm/handoff";

    let payload = serde_json::json!({
        "nxm": url  // Full URL with all query parameters
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

---

### **STEP 2: Parse NXM URL**

**File**: `core/nexus/nxm.py` lines 34-91

```python
@dataclass(frozen=True)
class NXMRequest:
    """Structured representation of an nxm:// download link."""
    raw: str
    game_domain: str      # e.g., "rivalsofaether2"
    mod_id: int           # e.g., 123
    file_id: int          # e.g., 456
    query: Dict[str, str] # e.g., {"key": "ABC", "expires": "1699123456", "user_id": "789"}

    @property
    def expires(self) -> Optional[str]:
        return self.query.get("expires")

    @property
    def key(self) -> Optional[str]:
        return self.query.get("key")

    @property
    def user_id(self) -> Optional[str]:
        return self.query.get("user_id")


def parse_nxm_uri(uri: str) -> NXMRequest:
    """Parse an nxm:// URI into its components.

    Example Input:
        nxm://rivalsofaether2/mods/2732/files/7689?key=ABC123&expires=1699200000&user_id=12345

    Example Output:
        NXMRequest(
            raw="nxm://rivalsofaether2/mods/2732/files/7689?key=ABC123&expires=1699200000&user_id=12345",
            game_domain="rivalsofaether2",
            mod_id=2732,
            file_id=7689,
            query={"key": "ABC123", "expires": "1699200000", "user_id": "12345"}
        )
    """
    if not isinstance(uri, str) or not uri.strip():
        raise NXMParseError("nxm URI must be a non-empty string")

    parsed = urllib.parse.urlparse(uri.strip())

    # Validate scheme
    if parsed.scheme.lower() != "nxm":
        raise NXMParseError("URI scheme must be nxm://")

    # Extract game domain (netloc)
    domain = (parsed.netloc or "").strip()
    if not domain:
        raise NXMParseError("nxm URI missing game domain host component")

    # Parse path: /mods/2732/files/7689
    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) < 4 or segments[0].lower() != "mods" or segments[2].lower() != "files":
        raise NXMParseError("nxm URI path must look like /mods/<mod_id>/files/<file_id>")

    # Extract mod_id and file_id
    try:
        mod_id = int(segments[1])
    except (TypeError, ValueError):
        raise NXMParseError("nxm URI contains a non-numeric mod id") from None

    try:
        file_id = int(segments[3])
    except (TypeError, ValueError):
        raise NXMParseError("nxm URI contains a non-numeric file id") from None

    # Parse query string: key=ABC123&expires=1699200000&user_id=12345
    query_pairs: Dict[str, str] = {}
    if parsed.query:
        for key, values in urllib.parse.parse_qs(parsed.query, keep_blank_values=True).items():
            if values:
                query_pairs[key] = values[0]  # Take first value if multiple

    return NXMRequest(
        raw=uri.strip(),
        game_domain=domain,
        mod_id=mod_id,
        file_id=file_id,
        query=query_pairs,
    )
```

**🔍 What gets extracted:**

- `game_domain`: "rivalsofaether2"
- `mod_id`: 2732
- `file_id`: 7689
- `query`: `{"key": "ABC123", "expires": "1699200000", "user_id": "12345"}`

**⚠️ CRITICAL**: The `key`, `expires`, and `user_id` are stored in `query` dict

---

### **STEP 3: Create Handoff Record**

**File**: `core/api/server.py` lines 1765-1787

```python
@app.post("/api/nxm/handoff")
def submit_nxm_handoff(payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    # Get nxm URL from request
    nxm_value: Optional[str] = None
    if payload is not None:
        nxm_value = payload.get("nxm")

    if not isinstance(nxm_value, str) or not nxm_value.strip():
        raise HTTPException(status_code=400, detail="nxm field is required")

    # Parse the URL
    try:
        nxm_request = parse_nxm_uri(nxm_value)
    except NXMParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Create metadata snapshot
    metadata = snapshot_metadata(nxm_request)

    # Register the handoff (store in memory)
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

**File**: `core/api/services/handoffs.py` lines 23-44

```python
def snapshot_metadata(nxm: NXMRequest) -> Dict[str, Any]:
    """Extract key authentication parameters from NXM request."""
    return {
        "mod_id": nxm.mod_id,
        "file_id": nxm.file_id,
        "key": nxm.key,           # ⚠️ Stored here
        "expires": nxm.expires,   # ⚠️ Stored here
    }


def register_handoff(nxm: NXMRequest, *, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Create an in-memory handoff record that expires in 10 minutes."""
    _purge_expired()
    identifier = str(uuid.uuid4())
    created_at = time.time()

    record = {
        "id": identifier,
        "created_at": created_at,
        "expires_at": created_at + NXM_HANDOFF_TTL_SECONDS,  # 600 seconds = 10 min
        "request": {
            "raw": nxm.raw,
            "game": nxm.game_domain,
            "mod_id": nxm.mod_id,
            "file_id": nxm.file_id,
            "query": dict(nxm.query),  # ⚠️ Contains key, expires, user_id
        },
        "metadata": metadata,  # ⚠️ Also contains key, expires
    }

    _HANDOFFS[identifier] = record
    return record
```

**🔍 What's stored:**

```python
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": 1699123456.789,
    "expires_at": 1699124056.789,
    "request": {
        "raw": "nxm://rivalsofaether2/mods/2732/files/7689?key=ABC&expires=1699200000&user_id=12345",
        "game": "rivalsofaether2",
        "mod_id": 2732,
        "file_id": 7689,
        "query": {
            "key": "ABC123",         # ⚠️ HERE
            "expires": "1699200000",  # ⚠️ HERE
            "user_id": "12345"       # ⚠️ HERE
        }
    },
    "metadata": {
        "mod_id": 2732,
        "file_id": 7689,
        "key": "ABC123",         # ⚠️ ALSO HERE
        "expires": "1699200000"  # ⚠️ ALSO HERE
    }
}
```

---

### **STEP 4: User Clicks "Download" Button**

**File**: `core/api/server.py` lines 2018-2177

```python
@app.post("/api/nxm/handoff/{handoff_id}/ingest")
def ingest_nxm_handoff(handoff_id: str, payload: Optional[Dict[str, Any]] = Body(default=None)) -> Dict[str, Any]:
    if not handoff_id:
        raise HTTPException(status_code=400, detail="handoff_id is required")

    # Retrieve the stored handoff record
    record = get_handoff_or_404(handoff_id)

    # Parse options
    options = payload or {}
    requested_file_id = options.get("file_id")
    if requested_file_id is not None:
        requested_file_id = _coerce_int(requested_file_id)

    # Get mod metadata from Nexus API
    game_domain, raw_metadata, filtered_metadata = _collect_nexus_metadata_for_record(record)

    # ... file selection logic ...

    # 🔥 THIS IS WHERE THE DOWNLOAD HAPPENS 🔥
    logger.info(
        "[nxm_handoff] resolving mod_id=%s file_id=%s handoff=%s via nxm redirect",
        mod_id, file_id, record.get("id")
    )

    download_path, resolved_url = _download_archive_via_nxm(record, game_domain, file_id)

    logger.info(
        "[nxm_handoff] download complete path=%s mod_id=%s file_id=%s",
        download_path, mod_id, file_id
    )

    # ... ingest and activate downloaded file ...
```

---

### **STEP 5: Request Download Link from Nexus** 🔥 **CRITICAL**

**File**: `core/api/server.py` lines 3489-3594

```python
def _resolve_nexus_download_candidates(
    record: Dict[str, Any],
    game_domain: str,
    file_id: int,
) -> List[Tuple[str, Optional[str]]]:
    """Request download URLs from Nexus API using stored key/expires parameters.

    This is where the 400 error occurs if key/expires/user_id are invalid!
    """

    # Extract data from handoff record
    request_data = record.get("request", {}) if isinstance(record, dict) else {}
    metadata = record.get("metadata", {}) if isinstance(record.get("metadata"), dict) else {}

    # Get mod_id
    mod_id = request_data.get("mod_id")
    if not isinstance(mod_id, int):
        mod_id = metadata.get("mod_id") if isinstance(metadata.get("mod_id"), int) else None
    if not isinstance(mod_id, int):
        raise HTTPException(status_code=400, detail="nxm handoff missing mod id")

    # 🔑 EXTRACT AUTHENTICATION PARAMETERS
    query = request_data.get("query") if isinstance(request_data.get("query"), dict) else {}
    key = str(query.get("key") or metadata.get("key") or "").strip()
    expires = str(query.get("expires") or metadata.get("expires") or "").strip()
    user_id = str(query.get("user_id") or "").strip()

    # Validate we have authentication
    if not key or not expires:
        raise HTTPException(
            status_code=400,
            detail="nxm handoff missing download authorization; please click Mod Manager Download again",
        )

    # Build query parameters for Nexus API
    domain = (game_domain or DEFAULT_GAME or "marvelrivals").strip().lower() or DEFAULT_GAME
    params = {"key": key, "expires": expires}
    if user_id:
        params["user_id"] = user_id

    api_query = urllib.parse.urlencode(params)
    # Example: key=ABC123&expires=1699200000&user_id=12345

    # Build Nexus API URL
    api_url = (
        f"https://api.nexusmods.com/v1/games/{domain}/mods/{mod_id}/files/{file_id}/download_link.json"
    )
    if api_query:
        api_url = f"{api_url}?{api_query}"

    # Example full URL:
    # https://api.nexusmods.com/v1/games/rivalsofaether2/mods/2732/files/7689/download_link.json?key=ABC123&expires=1699200000&user_id=12345

    # Prepare headers
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

    # 🌐 MAKE REQUEST TO NEXUS API
    req = urllib.request.Request(api_url, headers=headers, method="GET")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.getcode() or 0
            raw = resp.read()

    except urllib.error.HTTPError as exc:
        # 🚨 THIS IS WHERE YOUR 400 ERROR IS CAUGHT
        body = None
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass

        detail = body or exc.reason or str(exc)

        # YOUR ERROR COMES FROM HERE:
        # exc.code = 400
        # body = '{"code":400,"message":"Provided key and expire time isn\'t correct for this user/file."}'

        if exc.code in (401, 403):
            raise HTTPException(
                status_code=exc.code,
                detail=(
                    "Nexus download link request was denied ("
                    f"{exc.code}). Ensure you're logged into Nexus Mods in your browser "
                    "and click Mod Manager Download again. "
                    "If the issue persists, configure a Nexus API key. "
                    f"Details: {detail}"
                ),
            )

        # This is the error message you see:
        raise HTTPException(
            status_code=exc.code or 502,
            detail=f"Nexus download link request failed ({exc.code}): {detail}"
        )

    except urllib.error.URLError as exc:
        reason = exc.reason
        host = urllib.parse.urlparse(api_url).netloc
        raise HTTPException(
            status_code=502,
            detail=f"Unable to reach Nexus download link API at {host}: {reason}",
        )

    # Validate response
    if status != 200:
        raise HTTPException(status_code=502, detail=f"Unexpected response {status} from Nexus download link API")

    if not raw:
        raise HTTPException(status_code=502, detail="Nexus download link API returned an empty payload")

    # Parse JSON response
    try:
        payload = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to parse Nexus download link JSON: {exc}")

    # Check for error in response
    if isinstance(payload, dict):
        error_detail = None
        if payload.get("error"):
            error_detail = payload.get("message") or payload.get("detail") or payload.get("error")
        elif payload.get("errors"):
            error_detail = payload.get("errors")
        if error_detail:
            error_text = error_detail if isinstance(error_detail, str) else str(error_detail)
            raise HTTPException(status_code=502, detail=f"Nexus download link API error: {error_text}")

    # Extract download URLs from response
    candidates: List[Tuple[str, Optional[str]]] = []
    iterable: List[Any]
    if isinstance(payload, list):
        iterable = payload
    else:
        iterable = [payload]

    for entry in iterable:
        uri = _extract_download_uri(entry)
        if uri:
            label: Optional[str] = None
            if isinstance(entry, dict):
                label_val = entry.get("short_name") or entry.get("name") or entry.get("cdn") or entry.get("label")
                if isinstance(label_val, str) and label_val.strip():
                    label = label_val.strip()
            candidates.append((uri, label))

    if not candidates:
        raise HTTPException(status_code=502, detail="Nexus download link API did not return any usable URLs")

    return candidates
```

---

## 🔍 **What Nexus API Validates**

When you make this request:

```
GET https://api.nexusmods.com/v1/games/rivalsofaether2/mods/2732/files/7689/download_link.json?key=ABC123&expires=1699200000&user_id=12345
```

**Nexus checks:**

1. ✅ **Is the `key` valid?**

   - Must be a valid token generated by Nexus
   - Not tampered with or corrupted

2. ✅ **Is the `expires` timestamp in the future?**

   - Current time must be < expires timestamp
   - If current time >= expires → **EXPIRED**

3. ✅ **Does the `user_id` match the user who generated the key?**

   - Key is tied to specific Nexus user
   - If different user → **MISMATCH**

4. ✅ **Is the key authorized for this specific file?**

   - Key is file-specific (mod_id + file_id)
   - Can't use key from File A to download File B

5. ✅ **IP address / session validation (optional)**
   - Some keys may be IP-locked
   - Or require active browser session

---

## 🚨 **Why Computer B Fails**

### **Scenario 1: Different User Account**

**Computer A:**

```python
# User clicks nxm link while logged in as User_A
{
    "key": "ABC123_FOR_USER_A",
    "expires": "1699200000",
    "user_id": "12345"  # User_A's ID
}
```

**Computer B:**

```python
# Same nxm link used, but Computer B is logged in as User_B or not logged in
{
    "key": "ABC123_FOR_USER_A",  # Still User_A's key
    "expires": "1699200000",
    "user_id": "12345"            # User_A's ID
}
```

**Nexus API thinks:** "This key is for User_A, but the request is coming from User_B" → **400 Error**

---

### **Scenario 2: Expired Key**

```python
# Key generated on Nov 3, 2025 at 10:00 AM
{
    "key": "ABC123",
    "expires": "1699200000",  # Nov 3, 2025 at 11:00 AM
    "user_id": "12345"
}

# Computer B tries to use it on Nov 5, 2025
# Current time: 1699400000 > expires: 1699200000
```

**Nexus API thinks:** "This key expired 2 days ago" → **400 Error**

---

### **Scenario 3: No API Key Configured**

**Computer A:**

- Has `NEXUS_API_KEY` environment variable set
- Request includes: `headers["apikey"] = "YOUR_API_KEY"`
- Nexus can authenticate via API key even if download key is weak

**Computer B:**

- No `NEXUS_API_KEY` configured
- Request missing API key header
- Nexus relies solely on download key validation
- If key has any issue → **400 Error**

---

## ✅ **Solutions**

### **Solution 1: Use Fresh NXM Link** (Temporary Fix)

On Computer B:

1. Open browser
2. Go to Nexus Mods
3. **Log in with same account as Computer A**
4. Navigate to mod page
5. Click "Mod Manager Download" **again**
6. Use the new nxm:// link

---

### **Solution 2: Configure Nexus API Key** (Permanent Fix)

**Get API Key:**

1. Go to https://www.nexusmods.com/users/myaccount?tab=api
2. Click "Generate Personal API Key"
3. Copy the key (e.g., `eyJhbGc...`)

**Set on Computer B:**

**Option A: Environment Variable**

```bash
# Windows PowerShell
$env:NEXUS_API_KEY = "eyJhbGc..."

# Or permanently:
[System.Environment]::SetEnvironmentVariable("NEXUS_API_KEY", "eyJhbGc...", "User")
```

**Option B: Settings File**
Create/edit: `C:\Users\YourName\AppData\Roaming\com.rounak77382.modmanager\settings.json`

```json
{
  "nexus_api_key": "eyJhbGc..."
}
```

**Code that reads it** (`core/nexus/nexus_api.py`):

```python
def get_api_key() -> Optional[str]:
    # Check environment variable
    key = os.environ.get("NEXUS_API_KEY")
    if key:
        return key.strip()

    # Check settings file
    settings_path = Path.home() / "AppData" / "Roaming" / "com.rounak77382.modmanager" / "settings.json"
    if settings_path.exists():
        try:
            with open(settings_path) as f:
                data = json.load(f)
                if "nexus_api_key" in data:
                    return data["nexus_api_key"].strip()
        except:
            pass

    return None
```

---

### **Solution 3: Debug the Request**

**Add logging to see what's being sent:**

Edit `core/api/server.py` around line 3510:

```python
# After building api_url, add this:
logger.info(f"[DEBUG_NXM] Full API URL: {api_url}")
logger.info(f"[DEBUG_NXM] key={key[:10]}... expires={expires} user_id={user_id}")
logger.info(f"[DEBUG_NXM] Has API key: {bool(api_key)}")
logger.info(f"[DEBUG_NXM] Headers: {headers}")

# Make the request
req = urllib.request.Request(api_url, headers=headers, method="GET")
```

**Check logs on both computers:**

Computer A (working):

```
[DEBUG_NXM] key=ABC123DEF4... expires=1699300000 user_id=12345
[DEBUG_NXM] Has API key: True
```

Computer B (failing):

```
[DEBUG_NXM] key=ABC123DEF4... expires=1699300000 user_id=12345
[DEBUG_NXM] Has API key: False  ← PROBLEM!
```

Or:

```
[DEBUG_NXM] key=ABC123DEF4... expires=1699100000 user_id=67890
[DEBUG_NXM] Has API key: False
```

---

## 📊 **Summary Table**

| Check              | Computer A          | Computer B          | Result                    |
| ------------------ | ------------------- | ------------------- | ------------------------- |
| Nexus Account      | User_A (12345)      | User_A (12345)      | ✅ Same user              |
| API Key Configured | ✅ Yes              | ❌ No               | ⚠️ Potential issue        |
| Key Expires        | 1699300000 (future) | 1699300000 (future) | ✅ Valid                  |
| Browser Session    | Logged in           | Not logged in       | ⚠️ May cause 400          |
| IP Address         | 1.2.3.4             | 5.6.7.8             | ⚠️ May trigger validation |

**Most likely fix**: Configure API key on Computer B

---

## 🔑 **Key Takeaway**

The error happens because:

1. NXM download keys are **user-specific** and **time-limited**
2. Nexus validates `key` + `expires` + `user_id` against its database
3. If any validation fails → 400 error
4. API key provides a backup authentication method
5. **Without API key**, you rely 100% on the download key being perfect

**Best practice**: Always configure `NEXUS_API_KEY` for reliable downloads across all computers.
