# 🚨 CRITICAL ISSUES FOUND - MUST FIX IMMEDIATELY

## Issue #1: HARDCODED NEXUS API KEY (SECURITY BREACH!)

### Problem

Your **personal Nexus API key** is hardcoded as a default value in `core/config/settings.py` line 65:

```python
nexus_api_key: str = "PhrRky7c5F7tKmdgPfr4Pgysj8FnViJxJuVPrAMnpvuPpZqS/g==--9S1Pqt+a/SVjJfsW--kbc5zktMJuy/y2HxgLtVHw=="
```

### Why This is Critical

1. **Everyone using your app gets YOUR API key by default**
2. **Your API key is exposed in the source code**
3. If you share this code or deploy it, your key is compromised
4. NexusMods can ban YOUR account for unauthorized usage by others
5. This is why it "works" even when users enter a faulty key - it falls back to YOUR hardcoded key!

### Impact

- When a user doesn't configure their own API key, the app uses YOURS
- When they save settings without an API key, it still uses YOUR default
- All API requests are made with YOUR credentials

### Solution Required

**IMMEDIATELY** change line 65 in `core/config/settings.py` to:

```python
nexus_api_key: str = ""  # Empty by default - users must provide their own
```

---

## Issue #2: NXM Protocol Error on Other Computers

### The Error

```
"Failed to download Nexus mod: Nexus download link request failed (400):
{"code":400,"message":"Provided key and expire time isn't correct for this user/file."}"
```

### Root Cause

The NXM protocol downloads use **temporary, user-specific authentication tokens** embedded in the `nxm://` URL, NOT your API key!

### How NXM Downloads Work

1. **User clicks "Download with Manager" on NexusMods website**
2. NexusMods generates a TEMPORARY download link like:
   ```
   nxm://marvelrivals/mods/2/files/73?key=ABC123&expires=1234567890&user_id=USER123
   ```
3. These query parameters (`key`, `expires`, `user_id`) are:
   - **User-specific** - tied to the logged-in NexusMods account
   - **Time-limited** - expire after a few minutes
   - **One-time use** - cannot be reused

### Why It Fails on Other Computers

**Location**: `core/api/server.py` lines 3545-3551

```python
query = request_data.get("query") if isinstance(request_data.get("query"), dict) else {}
key = str(query.get("key") or metadata.get("key") or "").strip()
expires = str(query.get("expires") or metadata.get("expires") or "").strip()
user_id = str(query.get("user_id") or "").strip()
```

The code extracts these from the NXM URL, but the problem is:

### Potential Issues

1. **Query Parameters Not Being Preserved**
   - Check if the Windows registry command properly quotes the NXM URL
   - Verify `%1` contains the full URL with query parameters
2. **URL Encoding Issues**

   - Special characters in the URL might be getting stripped
   - Query parameters might be lost during protocol handoff

3. **Timing Issues**

   - If the URL takes too long to process, the tokens expire (typically 5-10 minutes)
   - Check if there's a delay between clicking and the app receiving the URL

4. **User Not Logged Into NexusMods**
   - The user MUST be logged into NexusMods in their browser
   - When they click "Download with Manager", NexusMods generates the tokens based on their session

### Debugging Steps

1. **Check Registry Entry**
   ```powershell
   Get-ItemProperty -Path "HKCU:\Software\Classes\nxm\shell\open\command"
   ```
   Should show something like: `"C:\path\to\app.exe" "%1"`
2. **Verify URL Received**
   - Check backend logs to see the exact NXM URL received
   - Look for: `[nxm_handoff] received id=... query_params=...`
3. **Test with Fresh NXM Link**
   - User must:
     1. Be logged into NexusMods website
     2. Click "Download with Manager" button
     3. IMMEDIATELY use the link (don't wait)

### Code Inspection Checklist

**Windows Registry Handler** (`src-tauri/src/main.rs`):

- ✅ URL must be quoted to preserve special characters
- ✅ Command must pass the full URL including query string

**NXM Parser** (`core/nexus/nxm.py`):

- ✅ Query string parsing looks correct
- ✅ Uses `urllib.parse.parse_qs` to extract parameters

**Download Handler** (`core/api/server.py` line 3534+):

- ✅ Correctly extracts `key`, `expires`, `user_id` from query
- ✅ Makes request to NexusMods API with these tokens

### Most Likely Cause

Based on the error "Provided key and expire time isn't correct for this user/file", the issue is:

1. **User session mismatch** - The NXM link was generated for YOUR NexusMods account, but another user is trying to use it
2. **Expired tokens** - The link is too old (>5-10 minutes)
3. **Query parameters stripped** - The `key`/`expires`/`user_id` are not being passed correctly

### Verification Test

On the other computer, have the user:

1. Log into their own NexusMods account in the browser
2. Navigate to a mod page
3. Click "Download with Manager" button **freshly** (generate new link)
4. Check backend logs to see what URL was received
5. Verify the URL contains `?key=...&expires=...&user_id=...`

---

## Summary & Action Items

### URGENT - Security Fix

- [ ] Remove hardcoded API key from `core/config/settings.py` line 65
- [ ] Set default to empty string `""`
- [ ] Test that app still works for local operations without key
- [ ] Document that users must provide their own API key for Nexus features

### URGENT - NXM Protocol Fix

- [ ] Add debug logging to show exact NXM URL received
- [ ] Verify Windows registry command preserves query parameters
- [ ] Test with fresh NXM link on other computer (user must be logged in)
- [ ] Add user instructions: "You must be logged into NexusMods"
- [ ] Add timeout warning: "Download links expire in ~10 minutes"

### Testing Checklist

- [ ] Test with no API key configured (local operations only)
- [ ] Test with user's own API key configured
- [ ] Test NXM download with user logged into NexusMods
- [ ] Test NXM download expiration (wait >10 mins, should fail gracefully)
- [ ] Test on clean machine without your API key
