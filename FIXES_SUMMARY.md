# FIXES APPLIED - Summary

## ✅ Issue #1: Hardcoded API Key - FIXED

### What Was Wrong

Your personal Nexus API key was hardcoded in `core/config/settings.py` line 65. This meant:

- Everyone using your app was using YOUR API key
- Even when users entered a "faulty" key, it would fall back to YOUR key
- Your credentials were exposed in source code

### What Was Changed

**File**: `core/config/settings.py` line 65

**Before**:

```python
nexus_api_key: str = "PhrRky7c5F7tKmdgPfr4Pgysj8FnViJxJuVPrAMnpvuPpZqS/g==--9S1Pqt+a/SVjJfsW--kbc5zktMJuy/y2HxgLtVHw=="
```

**After**:

```python
nexus_api_key: str = ""  # User must configure their own Nexus API key
```

### Impact

- New users will start with NO API key
- Users MUST configure their own key for API features
- Your personal key is no longer exposed
- App still works fully for local mod management (no key needed)

---

## ⚠️ Issue #2: NXM Protocol - Enhanced Debugging & Error Messages

### Understanding NXM Protocol

The NXM protocol downloads do NOT use your API key directly. Instead:

1. User clicks "Download with Manager" on NexusMods
2. NexusMods generates a TEMPORARY URL like:
   ```
   nxm://marvelrivals/mods/2/files/73?key=ABC&expires=123456&user_id=USER
   ```
3. These tokens (`key`, `expires`, `user_id`) are:
   - **User-specific** - tied to their NexusMods login
   - **Time-limited** - expire in ~10 minutes
   - **One-time use** - cannot be shared

### Why "key and expire time isn't correct" Error Happens

This error means:

1. **Link expired** - User waited too long (>10 min) after clicking
2. **Wrong user** - Link was generated for different NexusMods account
3. **Not logged in** - User isn't logged into NexusMods in browser
4. **Link already used** - Cannot reuse same download link

### Changes Made

#### 1. Enhanced Debug Logging (`core/api/server.py` ~line 1780)

Added detailed logging when NXM URL is received:

```python
logger.info("[NXM DEBUG] ===== RECEIVED NXM URL =====")
logger.info("[NXM DEBUG] Full URL: %s", nxm_value)
logger.info("[NXM DEBUG] Contains '?': %s", "?" in nxm_value)
logger.info("[NXM DEBUG] Contains '&': %s", "&" in nxm_value)
logger.info("[NXM DEBUG] Query string: %s", query_part)
```

This will show if query parameters are being stripped!

#### 2. Better Error Messages (`core/api/server.py` ~line 3550)

Added specific error context when key/expires are missing:

```python
error_msg = (
    "NXM download authorization missing or expired. "
    "Please ensure you are logged into NexusMods in your browser, "
    "then click 'Download with Manager' button again. "
    f"(key={'present' if key else 'MISSING'}, expires={'present' if expires else 'MISSING'})"
)
```

#### 3. Helpful 400 Error Explanation (`core/api/server.py` ~line 3600)

When NexusMods returns "key and expire time isn't correct", the error now includes:

```
This error typically means:
1. The download link has EXPIRED (they expire in ~10 minutes)
2. You are not logged into NexusMods in your browser
3. The link was generated for a different user

SOLUTION: Log into YOUR NexusMods account in your browser,
then click 'Download with Manager' button AGAIN to generate a fresh link.
```

---

## 🔍 Debugging Guide for NXM Issues on Other Computers

### Step 1: Check Windows Registry

On the other computer, run PowerShell:

```powershell
Get-ItemProperty -Path "HKCU:\Software\Classes\nxm\shell\open\command" | Select-Object "(default)"
```

Should show: `"C:\Path\To\App.exe" "%1"`

The `"%1"` MUST be in quotes!

### Step 2: Test with Debug Logs

1. Run the backend with logging visible
2. Have user click "Download with Manager" on NexusMods
3. Check logs for `[NXM DEBUG]` lines
4. Verify the URL contains `?key=...&expires=...&user_id=...`

### Step 3: Verify User Prerequisites

Make sure user:

- ✅ Is logged into NexusMods in their browser
- ✅ Has a NexusMods account
- ✅ Clicks "Download with Manager" freshly (don't reuse old links)
- ✅ Uses the link within 10 minutes

### Step 4: Check for Query Parameter Stripping

If debug logs show URL without `?` or `&`, the problem is in Windows handoff.

Common causes:

- Registry command not properly quoted
- Windows version incompatibility
- Shell escaping issues

---

## 📋 Testing Checklist

### Test 1: App Works Without API Key

- [ ] Delete API key from settings
- [ ] Scan local downloads folder - should work
- [ ] Activate/deactivate mods - should work
- [ ] Check conflicts - should work
- [ ] Try to sync Nexus metadata - should show warning but not crash

### Test 2: App Works With User's Own API Key

- [ ] Add user's own Nexus API key in settings
- [ ] Sync Nexus metadata - should work
- [ ] Direct API downloads - should work (if not premium, shows specific error)

### Test 3: NXM Protocol (Fresh Link)

- [ ] User logs into NexusMods website
- [ ] User clicks "Download with Manager"
- [ ] App receives NXM URL (check logs)
- [ ] Check debug logs show `?key=...&expires=...`
- [ ] Download should succeed
- [ ] If fails, check error message for helpful guidance

### Test 4: NXM Protocol (Expired Link)

- [ ] User clicks "Download with Manager"
- [ ] Wait 15 minutes
- [ ] Try to use link
- [ ] Should fail with helpful message about expiration

### Test 5: NXM Protocol (Wrong User)

- [ ] User A clicks "Download with Manager" (generates link for User A)
- [ ] User B tries to use same link
- [ ] Should fail with message about user mismatch

---

## 🚨 Important Notes for Distribution

### Before Sharing Your Code

- ✅ **FIXED** - Hardcoded API key removed
- ⚠️ Check for any other hardcoded credentials
- ⚠️ Check `.env` file is in `.gitignore`
- ⚠️ Don't commit `settings.json` with your personal settings

### User Documentation Needed

Add to your README:

```markdown
## NexusMods Integration

### API Key (Optional)

- Required for: Automatic metadata sync, direct API downloads
- Not required for: Local mod management, NXM protocol downloads
- Get your key: https://www.nexusmods.com/users/myaccount?tab=api

### Using "Download with Manager"

1. Log into NexusMods in your browser
2. Navigate to a mod page
3. Click "Download with Manager" button
4. Link expires in ~10 minutes - use it quickly!
5. If link expires, click the button again for a fresh link

### Troubleshooting

- "key and expire time isn't correct" → Link expired or wrong user, click download button again
- "NEXUS_API_KEY not configured" → Normal for NXM downloads, only needed for API features
```

---

## Summary

### What You Had

- ❌ Your API key hardcoded in app
- ❌ All users using YOUR credentials
- ❌ Confusing error messages
- ❌ No debug logging for NXM issues

### What You Have Now

- ✅ No hardcoded API key
- ✅ Users must provide their own key
- ✅ Detailed debug logging for NXM URLs
- ✅ Helpful, actionable error messages
- ✅ App works without API key for local operations
- ✅ Better user guidance when things go wrong

### Next Steps

1. Test on your machine that everything still works
2. Test on another computer with a different NexusMods account
3. Verify debug logs show complete NXM URLs with query parameters
4. Update user documentation
5. Remove your API key from `.env` file before committing
