# Directory Structure Fix: CI/CD Import Resolution

## Root Cause: Directory Mismatch

### ❌ **Current CI/CD Structure Issue**
```
Working Directory: /d/a/RivalNxt (where script runs)
Spec File:         /d/a/RivalNxt/RivalNxt/rivalnxt_backend_merged.spec
Actual Files:      /d/a/RivalNxt/RivalNxt/core/
                   /d/a/RivalNxt/RivalNxt/field_prefs.py
```

### ❌ **Import Failures in CI/CD**
```
FAIL: core.api.server: No module named 'core'
FAIL: core.config.settings: No module named 'core'
FAIL: core.db.db: No module named 'core'
FAIL: field_prefs: No module named 'field_prefs'
```

**Root Cause:** The spec file contains:
```python
_project_root = os.path.abspath('.')  # Evaluates to /d/a/RivalNxt
pathex=[_project_root]  # But files are in /d/a/RivalNxt/RivalNxt/
```

## Solution: Change to Correct Directory

### ✅ **Fix Applied**
```bash
# Find the spec file and its directory (handle nested directory structure)
SPEC_FILE=$(find . -name "rivalnxt_backend_merged.spec" -type f | head -1)

if [ -z "$SPEC_FILE" ]; then
    echo "ERROR: rivalnxt_backend_merged.spec file not found!"
    exit 1
fi

SPEC_DIR=$(dirname "$SPEC_FILE")
echo "Found spec file: $SPEC_FILE"
echo "Spec file directory: $SPEC_DIR"

# Change to the spec file directory so relative paths work correctly
cd "$SPEC_DIR"  # ✅ Now running from /d/a/RivalNxt/RivalNxt

# Test imports from the correct directory
echo "Testing imports from correct directory..."
python -c "
test_imports = [
    'fastapi', 'uvicorn', 'requests', 'pydantic', 'psutil',
    'core.api.server', 'core.config.settings', 'core.db.db',  # ✅ Should work now
    'field_prefs', 'py7zr', 'rarfile', 'python_multipart'      # ✅ Should work now
]
for imp in test_imports:
    try:
        __import__(imp)
        print(f'OK: {imp}')
    except Exception as e:
        print(f'FAIL: {imp}: {e}')
"

# Build using the spec file from the correct directory
echo "Building from correct directory: $(pwd)"
python -m PyInstaller rivalnxt_backend_merged.spec --clean --noconfirm
```

### ✅ **How This Fixes the Issue**

#### **Before (Broken)**
```bash
# Running from: /d/a/RivalNxt
# Spec file sees: _project_root = '/d/a/RivalNxt'
# But files are in: '/d/a/RivalNxt/RivalNxt/core/'
# Result: Imports fail ❌
```

#### **After (Fixed)**
```bash
# Running from: /d/a/RivalNxt/RivalNxt (after cd)
# Spec file sees: _project_root = '/d/a/RivalNxt/RivalNxt'
# Files are in: '/d/a/RivalNxt/RivalNxt/core/'
# Result: Imports succeed ✅
```

## Expected CI/CD Result

### ✅ **All Imports Should Now Succeed**
- ✅ `core.api.server` - Found in correct directory
- ✅ `core.config.settings` - Found in correct directory  
- ✅ `core.db.db` - Found in correct directory
- ✅ `field_prefs` - Found in correct directory
- ✅ All other dependencies - FastAPI, uvicorn, etc.

### ✅ **Complete Build Process**
1. **PyO3 library builds** (already working)
2. **Spec file found correctly** (dynamic find)
3. **Change to correct directory** (fixes path resolution)
4. **All imports succeed** (modules found)
5. **Complete 114 MB executable built** (all dependencies included)

### ✅ **Success Indicators**
- File size: 114 MB (vs previous 19.5 MB)
- Backend functionality: Complete (all API endpoints working)
- Import testing: All modules import successfully
- Dependencies: All bundled correctly

## Why This Works

**Key Insight:** PyInstaller spec files rely on **relative paths** and **current working directory**. By changing to the directory containing the spec file, all relative paths in the spec file (like `core/`, `scripts/`, `field_prefs.py`) resolve correctly.

This is the final piece of the puzzle that should resolve the CI/CD build discrepancy!