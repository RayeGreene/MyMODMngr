#!/bin/bash
echo Building RivalNxt for CI/CD...

# Set environment for CI
export CI=true

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

# Check if spec file exists
if [ ! -f "rivalnxt_backend_merged.spec" ]; then
    echo "ERROR: rivalnxt_backend_merged.spec file not found!"
    echo "Looking for spec files:"
    find . -name "*.spec" -type f
    exit 1
fi

echo "Found spec file: rivalnxt_backend_merged.spec"

# Build using the spec file
python -m PyInstaller rivalnxt_backend_merged.spec --clean --noconfirm

# Look for the built executable
echo "Checking for built executable..."
if [ -f "dist/rivalnxt_backend.exe" ]; then
    BACKEND_SOURCE="dist/rivalnxt_backend.exe"
    echo "OK: Found backend in dist/: $BACKEND_SOURCE"
elif [ -f "rivalnxt_backend.exe" ]; then
    BACKEND_SOURCE="rivalnxt_backend.exe"
    echo "OK: Found backend in current dir: $BACKEND_SOURCE"
else
    echo "ERROR: Backend executable not found!"
    echo "Contents of current directory:"
    ls -la | grep -E "(dist|\.exe)"
    echo "Contents of dist/ directory:"
    ls -la dist/ 2>/dev/null || echo "No dist/ directory found"
    exit 1
fi

echo Found backend at: $BACKEND_SOURCE
ls -lh "$BACKEND_SOURCE"

# Create sidecars directory if it doesn't exist
mkdir -p src-tauri/sidecars

# Copy backend to Tauri sidecars
cp "$BACKEND_SOURCE" src-tauri/sidecars/rivalnxt_backend-x86_64-pc-windows-msvc.exe
echo Backend copied to sidecars

# Build Tauri application
echo Building Tauri application...
npm run tauri:build

echo CI/CD build process completed!