# Settings System Refactoring - Complete

## Problem

The bootstrap rebuild was failing with "Missing Nexus API key. Set NEXUS_API_KEY in the environment or .env" even though the user had configured the API key in the UI.

## Root Causes

### 1. **Scripts Loading Stale Settings**

- Scripts like `rebuild_sqlite.py` and `sync_nexus_to_db.py` were loading `SETTINGS` when the module was imported
- When run as subprocess during bootstrap, they didn't see the updated settings saved by the UI
- The global `SETTINGS` variable was set once at import time and never refreshed

### 2. **Dependency on .env File**

- Scripts were checking environment variables and `.env` file instead of using the global settings
- Error messages told users to "Set NEXUS_API_KEY in .env" which was outdated
- This created confusion about the source of truth for configuration

### 3. **Nexus API Key Required for Bootstrap**

- The script raised an error and stopped if no API key was configured
- But API key should be OPTIONAL - local operations don't need it
- Only Nexus metadata sync requires the API key

## Changes Made

### ✅ 1. Added Settings Reload Function

**File**: `core/config/settings.py`

Added new function to reload settings from disk:

```python
def reload_settings() -> AppSettings:
    """Reload settings from disk and update the global SETTINGS object.

    This is useful when settings.json has been updated by another process
    or by the API server, and we need to pick up the new values.
    """
    global SETTINGS
    SETTINGS = load_settings()
    return SETTINGS
```

### ✅ 2. Scripts Now Reload Settings on Startup

**Files**: `scripts/rebuild_sqlite.py`, `scripts/sync_nexus_to_db.py`

Added at the top of each script (after sys.path setup):

```python
# Reload settings from disk to ensure we have the latest configuration
from core.config.settings import reload_settings
reload_settings()
```

This ensures scripts always see the latest settings saved by the UI.

### ✅ 3. Made Nexus API Key Optional

**File**: `scripts/rebuild_sqlite.py` line ~235

**Before** (would crash):

```python
key = get_api_key()
if not key:
    raise RuntimeError("Missing Nexus API key. Set NEXUS_API_KEY in the environment or .env")
```

**After** (graceful degradation):

```python
key = get_api_key()
if not key:
    log.warning("Nexus API key not configured - skipping Nexus metadata sync.")
    log.warning("To enable Nexus metadata sync, configure your API key in Settings.")
    return 0
```

**File**: `scripts/sync_nexus_to_db.py` line ~35

Same change - warns instead of crashing.

### ✅ 4. Use SETTINGS Instead of Environment Variables

**File**: `scripts/rebuild_sqlite.py`

**Before**:

```python
def _resolve_downloads_root(override: Optional[str]) -> Path:
    candidate = override or os.environ.get("MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT")
    if not candidate:
        raise RuntimeError(
            "MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT is not set. Define it in .env or pass --downloads-root."
        )
```

**After**:

```python
def _resolve_downloads_root(override: Optional[str]) -> Path:
    """Resolve downloads root from override, SETTINGS, or environment (in that order)."""
    from core.config.settings import SETTINGS

    candidate = override or \
                (str(SETTINGS.marvel_rivals_local_downloads_root) if SETTINGS.marvel_rivals_local_downloads_root else None) or \
                os.environ.get("MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT")
    if not candidate:
        raise RuntimeError(
            "Marvel Rivals local downloads root is not configured. "
            "Please configure it in Settings or pass --downloads-root."
        )
```

Same for `_resolve_game_root()`.

### ✅ 5. Updated Error Messages

All error messages now say:

- ❌ OLD: "Set NEXUS_API_KEY in .env"
- ✅ NEW: "Configure your API key in Settings"

## How It Works Now

### Settings Priority Order

1. **UI Settings** (stored in `settings.json`) - **PRIMARY SOURCE**
2. Environment variables (fallback for backward compatibility)
3. Command-line arguments (highest priority when provided)

### Bootstrap Flow

1. User configures settings in UI
2. Settings saved to `{data_dir}/settings.json`
3. User clicks "Bootstrap" button
4. API server runs `rebuild_sqlite.py` as subprocess
5. Script calls `reload_settings()` to load latest settings from disk
6. Script uses `SETTINGS.nexus_api_key`, `SETTINGS.marvel_rivals_root`, etc.
7. If API key missing, warns but continues (Nexus sync skipped)
8. Bootstrap completes successfully

### Without API Key

- ✅ Local downloads scan works
- ✅ Asset extraction works
- ✅ Tag building works
- ✅ Conflict detection works
- ⚠️ Nexus metadata sync skipped (with warning)
- ✅ Bootstrap succeeds

### With API Key

- ✅ Everything above works
- ✅ Nexus metadata sync works
- ✅ Latest mod info, files, changelogs fetched

## Testing Checklist

- [x] Remove API key from settings
- [x] Run bootstrap - should succeed with warning
- [x] Check log shows "Nexus API key not configured - skipping..."
- [x] Add API key in UI settings
- [x] Run bootstrap again - should sync from Nexus
- [x] Verify no references to ".env" in error messages
- [x] Verify scripts read from `settings.json`, not `.env`

## Migration Notes

### For Users

- **No action needed** - settings will be read from UI configuration
- `.env` file is still supported as fallback but not recommended
- All configuration should be done through the Settings dialog

### For Developers

- **Don't use `.env` for configuration** - use `SETTINGS` global
- **Always reload settings** in scripts: `reload_settings()`
- **Make features optional** - don't crash if API key missing
- **Use helpful error messages** - point users to Settings dialog

## Summary

| Aspect                       | Before                         | After                                      |
| ---------------------------- | ------------------------------ | ------------------------------------------ |
| Settings Source              | `.env` file + environment vars | `settings.json` (UI) → env vars (fallback) |
| Bootstrap without API key    | ❌ Crashes                     | ✅ Succeeds (skips Nexus sync)             |
| Scripts see updated settings | ❌ No (stale cache)            | ✅ Yes (reload on startup)                 |
| Error messages               | "Set in .env"                  | "Configure in Settings"                    |
| API key required             | ✅ Yes (blocks bootstrap)      | ❌ No (optional feature)                   |

**Result**: Bootstrap now works correctly whether or not the user has configured a Nexus API key, and all settings are properly read from the UI configuration!
