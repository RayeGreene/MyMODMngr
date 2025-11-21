#!/bin/bash
echo Building RivalNxt for CI/CD...

# Set environment for CI
export CI=true

# Store project root directory for later use
PROJECT_ROOT=$(pwd)
echo "Project root directory: $PROJECT_ROOT"

# Build PyO3 library with proper error handling
echo Building PyO3 library...
cd src-tauri/src/rust-ue-tools
echo "Current directory: $(pwd)"
echo "Contents of rust-ue-tools:"
ls -la

# Try to build PyO3, but make sure we have a wheel one way or another
if maturin build --features pyo3 --release --out ../../../target/wheels; then
    echo "OK: PyO3 library build succeeded"
    pip install --force-reinstall ../../../target/wheels/*.whl
    if [ $? -eq 0 ]; then
        echo "OK: PyO3 wheel installed successfully"
    else
        echo "FAIL: PyO3 wheel installation failed"
        exit 1
    fi
else
    echo "FAIL: PyO3 library build failed"
    echo "Trying to install pre-extracted wheel as fallback..."
    if [ -d "../../../extracted_wheel" ]; then
        echo "Found extracted wheel, installing..."
        pip install --force-reinstall ../../../extracted_wheel/*.whl
        if [ $? -eq 0 ]; then
            echo "OK: Pre-extracted wheel installed successfully"
        else
            echo "FAIL: Pre-extracted wheel installation failed"
            exit 1
        fi
    else
        echo "FAIL: No PyO3 wheel available - this will cause import failures"
        exit 1
    fi
fi

# Verify PyO3 import works
echo "Testing PyO3 import..."
python -c "
try:
    import rust_ue_tools
    print('OK: rust_ue_tools import successful')
except ImportError as e:
    print(f'FAIL: rust_ue_tools import failed: {e}')
    print('This will cause server.py imports to fail!')
    exit(1)
"

cd ../../../..

# Build Python backend using direct PyInstaller command (more reliable than spec file)
echo Building Python backend with PyInstaller...
echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la
echo "Python path:"
python -c "import sys; print('\n'.join(sys.path))"

# Test imports first to see what's available
echo "Testing critical imports..."
python -c "
import sys
test_imports = [
    'fastapi', 'uvicorn', 'requests', 'pydantic', 'psutil',
    'core.api.server', 'core.config.settings', 'core.db.db',
    'field_prefs', 'py7zr', 'rarfile', 'python_multipart'
]
for imp in test_imports:
    try:
        __import__(imp)
        print(f'OK: {imp}')
    except Exception as e:
        print(f'FAIL: {imp}: {e}')
"

# Use the comprehensive spec file that already has all configurations
echo "Using rivalnxt_backend_merged.spec for PyInstaller build..."
echo "Current directory: $(pwd)"

# Find the spec file and its directory (handle nested directory structure)
SPEC_FILE=$(find . -name "rivalnxt_backend_merged.spec" -type f | head -1)

if [ -z "$SPEC_FILE" ]; then
    echo "ERROR: rivalnxt_backend_merged.spec file not found!"
    echo "Looking for spec files:"
    find . -name "*.spec" -type f
    exit 1
fi

SPEC_DIR=$(dirname "$SPEC_FILE")
echo "Found spec file: $SPEC_FILE"
echo "Spec file directory: $SPEC_DIR"

# Change to the spec file directory so relative paths work correctly
cd "$SPEC_DIR"

# Test imports from the correct directory
echo "Testing imports from correct directory..."
python -c "
import sys
test_imports = [
    'fastapi', 'uvicorn', 'requests', 'pydantic', 'psutil',
    'core.api.server', 'core.config.settings', 'core.db.db',
    'field_prefs', 'py7zr', 'rarfile', 'python_multipart'
]
for imp in test_imports:
    try:
        __import__(imp)
        print(f'OK: {imp}')
    except Exception as e:
        print(f'FAIL: {imp}: {e}')
"

# Build using the spec file from the correct directory
echo "=== DEBUG: Before PyInstaller Build ==="
echo "Current directory: $(pwd)"
echo "Contents of current directory:"
ls -la

echo "Checking if required files exist:"
echo "- src-python/run_server.py: $([ -f "src-python/run_server.py" ] && echo "EXISTS" || echo "MISSING")"
echo "- core directory: $([ -d "core" ] && echo "EXISTS" || echo "MISSING")"
echo "- scripts directory: $([ -d "scripts" ] && echo "EXISTS" || echo "MISSING")"
echo "- character_ids.json: $([ -f "character_ids.json" ] && echo "EXISTS" || echo "MISSING")"

echo "Building with PyInstaller (verbose output)..."
python -m PyInstaller rivalnxt_backend_merged.spec --clean --noconfirm --debug all

# Look for the built executable with detailed debugging
echo "=== DEBUG: After PyInstaller Build ==="
echo "Current directory: $(pwd)"
echo "Contents of current directory:"
ls -la | grep -E "(dist|\.exe|build)"

if [ -d "dist" ]; then
    echo "Contents of dist/ directory:"
    ls -la dist/
    echo "Looking for .exe files in dist/:"
    find dist/ -name "*.exe" -type f 2>/dev/null || echo "No .exe files found in dist/"
fi

# Create sidecars directory if it doesn't exist
echo "Creating sidecars directory..."
mkdir -p src-tauri/sidecars

# Verify sidecars directory exists
if [ -d "src-tauri/sidecars" ]; then
    echo "OK: sidecars directory exists"
else
    echo "ERROR: Failed to create sidecars directory!"
    exit 1
fi

# Go back to project root for final verification
echo "=== DEBUG: About to verify PyInstaller output ==="
echo "Project root: $PROJECT_ROOT"
echo "Current directory: $(pwd)"

cd "$PROJECT_ROOT"

# Check Tauri config expects the right filename
echo "=== DEBUG: Tauri config check ==="
echo "Tauri expects: externalBin = ['sidecars/rivalnxt_backend']"
echo "Expected file: $PROJECT_ROOT/src-tauri/sidecars/rivalnxt_backend"

# Verify the backend was built directly to the correct location
if [ -f "$PROJECT_ROOT/src-tauri/sidecars/rivalnxt_backend" ]; then
    echo "SUCCESS: Backend file is present in sidecars directory!"
    ls -lh "$PROJECT_ROOT/src-tauri/sidecars/rivalnxt_backend"
else
    echo "ERROR: Backend file is NOT present in sidecars directory!"
    echo "Contents of sidecars directory:"
    ls -la "$PROJECT_ROOT/src-tauri/sidecars/"
    exit 1
fi

# Build Tauri application
echo Building Tauri application...
npm run tauri:build

echo CI/CD build process completed!