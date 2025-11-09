# Nexus API Key Usage

## Overview

The Nexus API key is **optional but recommended** for enhanced functionality when working with NexusMods.

## When the API Key is REQUIRED

### 1. **NXM Protocol Downloads (nxm:// links)**

- When you click "Mod Manager Download" on NexusMods website
- The app receives an `nxm://` URL with download parameters
- **Requires API key** to fetch:
  - Mod metadata (name, author, description)
  - File information (version, changelog, size)
  - Download links from Nexus servers

**Location in code**: `core/api/server.py` line ~1900-1910

```python
def _ensure_nxm_metadata(...):
    key = get_api_key()
    if not key:
        raise HTTPException(status_code=400,
            detail="NEXUS_API_KEY not configured; cannot contact Nexus")
```

### 2. **Direct Nexus Downloads**

- Downloading mods directly through the Nexus API
- Getting secure download links that expire

**Location in code**: `core/api/server.py` line ~2490-2505

```python
api_key = get_api_key()
if not api_key:
    return {
        "ok": False,
        "error": "NEXUS_API_KEY not configured; direct Nexus API downloads are disabled."
    }
```

## When the API Key is OPTIONAL

### 1. **Local Mod Management**

- ✅ Scanning local downloads folder
- ✅ Activating/deactivating mods
- ✅ Detecting conflicts
- ✅ Managing `.pak` files
- ✅ Rebuilding tags and assets

### 2. **Manual Downloads**

- ✅ Manually downloading mods from browser
- ✅ Importing downloaded files via "Import from Local Downloads"
- ✅ All local file operations

### 3. **Nexus Metadata Sync (with graceful degradation)**

**Location in code**: `core/api/server.py` line ~3340-3350

```python
key = get_api_key()
if not key:
    result["metadata_warning"] = "NEXUS_API_KEY not configured; skipped metadata sync"
    return result
```

- The sync task will **skip** fetching latest metadata from Nexus
- Uses cached/existing metadata instead
- **No error thrown**, just a warning

## API Key Features

### With API Key

- 🔥 One-click downloads from NexusMods website
- 🔥 Automatic mod metadata updates
- 🔥 Fetch mod changelogs
- 🔥 Get file version information
- 🔥 Access download links with authentication

### Without API Key

- ✅ Full local mod management
- ✅ Manual download import
- ✅ Conflict detection
- ✅ Activation/deactivation
- ⚠️ No NXM protocol support
- ⚠️ No automatic metadata sync
- ⚠️ Manual downloads only

## How to Get a Nexus API Key

1. **Create a NexusMods account** (free)
2. Go to https://www.nexusmods.com/users/myaccount?tab=api
3. Click "Generate API Key"
4. Copy the key
5. In the app: **Settings** → **Nexus API Key** → Paste

## Summary

**TL;DR**:

- **Without API key**: App works fine for local mod management and manual downloads
- **With API key**: Enables seamless integration with NexusMods website (one-click downloads, automatic metadata)

The app is designed to work without the API key for users who prefer manual downloads or don't have a Nexus account.
