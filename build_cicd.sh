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

# Determine the correct script path (handle nested directory structure)
echo "Looking for run_server.py script file..."
find . -name "run_server.py" -type f 2>/dev/null | while read -r script_file; do
    if [ -f "$script_file" ]; then
        SCRIPT_PATH="$script_file"
        echo "Found script at: $SCRIPT_PATH"
        
        # Extract base directory from found script path for data files
        DATA_BASE=$(dirname "$(dirname "$SCRIPT_PATH")")
        echo "Using data base: $DATA_BASE"
        break
    fi
done

if [ -z "$SCRIPT_PATH" ]; then
    echo "ERROR: Cannot find run_server.py script file!"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Data base directory is already determined from script path above

# Comprehensive PyInstaller build with all needed hidden imports
python -m PyInstaller \
    --noconfirm \
    --clean \
    --onefile \
    --exclude-module PyQt5 \
    --exclude-module PyQt6 \
    --collect-data core.db.migrations \
    --add-data "${DATA_BASE}/core:core" \
    --add-data "${DATA_BASE}/scripts:scripts" \
    --add-data "${DATA_BASE}/character_ids.json:." \
    --hidden-import fastapi \
    --hidden-import fastapi.middleware \
    --hidden-import fastapi.middleware.cors \
    --hidden-import fastapi.middleware.trustedhost \
    --hidden-import fastapi.middleware.gzip \
    --hidden-import fastapi.responses \
    --hidden-import fastapi.routing \
    --hidden-import fastapi.applications \
    --hidden-import fastapi.dependencies \
    --hidden-import uvicorn \
    --hidden-import requests \
    --hidden-import python_multipart \
    --hidden-import pydantic \
    --hidden-import psutil \
    --hidden-import py7zr \
    --hidden-import rarfile \
    --hidden-import core \
    --hidden-import core.api \
    --hidden-import core.api.server \
    --hidden-import core.api.dependencies \
    --hidden-import core.api.services \
    --hidden-import core.api.services.handoffs \
    --hidden-import core.assets \
    --hidden-import core.assets.zip_to_asset_paths \
    --hidden-import core.db \
    --hidden-import core.db.db \
    --hidden-import core.db.queries \
    --hidden-import core.db.conflicts \
    --hidden-import core.ingestion \
    --hidden-import core.ingestion.scan_active_mods \
    --hidden-import core.ingestion.scan_mod_downloads \
    --hidden-import core.nexus \
    --hidden-import core.nexus.nexus_api \
    --hidden-import core.nexus.nxm \
    --hidden-import core.utils \
    --hidden-import core.utils.archive \
    --hidden-import core.utils.download_paths \
    --hidden-import core.utils.pak_files \
    --hidden-import core.utils.mod_filename \
    --hidden-import core.utils.nexus_metadata \
    --hidden-import core.utils.nxm_protocol \
    --hidden-import core.utils.nxm_registration \
    --hidden-import core.config \
    --hidden-import core.config.settings \
    --hidden-import field_prefs \
    --hidden-import scripts \
    --hidden-import scripts.activate_mods \
    --hidden-import scripts.deactivate_mods \
    --hidden-import scripts.sync_nexus_to_db \
    --hidden-import scripts.rebuild_tags \
    --hidden-import scripts.rebuild_sqlite \
    --hidden-import scripts.ingest_download_assets \
    --hidden-import scripts.build_asset_tags \
    --hidden-import scripts.build_pak_tags \
    --name rivalnxt_backend \
    "$SCRIPT_PATH"

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