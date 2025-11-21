#!/bin/bash
echo Building RivalNxt for Local Development...

# Clean previous builds
rm -rf dist build

echo Building Python backend with PyInstaller...
python -m PyInstaller --noconfirm --clean --onefile --exclude-module PyQt5 --exclude-module PyQt6 --collect-data core.db.migrations --name rivalnxt_backend src-python/run_server.py

if [ -f "dist/rivalnxt_backend" ]; then
    echo Copying backend executable to Tauri sidecars...
    mkdir -p src-tauri/sidecars
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        cp dist/rivalnxt_backend src-tauri/sidecars/rivalnxt_backend-x86_64-apple-darwin
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        cp dist/rivalnxt_backend src-tauri/sidecars/rivalnxt_backend-x86_64-unknown-linux-gnu
    else
        echo "Unknown OS: $OSTYPE"
        exit 1
    fi
    echo Local build completed successfully!
else
    echo "ERROR: Backend executable not found in dist directory!"
    exit 1
fi

echo Building Tauri application...
npm run tauri:build

echo Local build process completed!