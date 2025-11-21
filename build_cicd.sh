#!/bin/bash
echo Building RivalNxt for CI/CD...

# Set environment for CI
export CI=true

# Build PyO3 library first
echo Building PyO3 library...
cd src-tauri/src/rust-ue-tools
maturin build --features pyo3 --release --out ../../../target/wheels
pip install --force-reinstall ../../../target/wheels/*.whl
cd ../../..

# Build Python backend using spec file
echo Building Python backend with PyInstaller...
pyinstaller rivalnxt_backend_merged.spec --clean --noconfirm

# CI/CD specific copy logic - PyInstaller with spec file puts output in current directory
if [ -f "dist/rivalnxt_backend.exe" ]; then
    BACKEND_SOURCE="dist/rivalnxt_backend.exe"
elif [ -f "rivalnxt_backend.exe" ]; then
    # Fallback: if not in dist/, look in current directory
    BACKEND_SOURCE="rivalnxt_backend.exe"
else
    echo "ERROR: Backend executable not found!"
    echo "Looking for rivalnxt_backend.exe in:"
    ls -la dist/ 2>/dev/null || echo "No dist/ directory found"
    ls -la rivalnxt_backend.exe 2>/dev/null || echo "No rivalnxt_backend.exe in current directory"
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