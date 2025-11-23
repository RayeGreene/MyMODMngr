#!/bin/bash
# ============================================================================
# Complete Build Script for RivalNxt
# This script builds all components: Rust libraries, PyO3 bindings, 
# Python backend, and Tauri application
# ============================================================================

set -e  # Exit on error

echo ""
echo "============================================================================"
echo "                    RivalNxt Build Script"
echo "============================================================================"
echo ""

# Check if we're in the correct directory
if [ ! -d "src-tauri" ]; then
    echo "ERROR: src-tauri directory not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# ============================================================================
echo "[1/4] Building Rust UE Tools with PyO3 bindings..."
echo "============================================================================"
cd src-tauri/src/rust-ue-tools
echo "Building release version with PyO3 features..."
cargo build --release --features pyo3 --lib
echo "✓ Rust UE Tools built successfully"
cd ../../..

# ============================================================================
echo ""
echo "[2/4] Building Python backend with PyInstaller..."
echo "============================================================================"
echo "Cleaning previous builds..."
rm -rf dist build

echo "Building backend executable using spec file..."
python -m PyInstaller --noconfirm --clean rivalnxt_backend_merged.spec

if [ ! -f "dist/rivalnxt_backend" ]; then
    echo "ERROR: Backend executable not found in dist directory!"
    exit 1
fi
echo "✓ Python backend built successfully"

# ============================================================================
echo ""
echo "[3/4] Copying backend to Tauri sidecars..."
echo "============================================================================"
mkdir -p src-tauri/sidecars

# Determine the platform-specific sidecar name
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    SIDECAR_NAME="rivalnxt_backend-x86_64-unknown-linux-gnu"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    SIDECAR_NAME="rivalnxt_backend-aarch64-apple-darwin"
else
    SIDECAR_NAME="rivalnxt_backend-x86_64-unknown-linux-gnu"
fi

cp dist/rivalnxt_backend "src-tauri/sidecars/$SIDECAR_NAME"
chmod +x "src-tauri/sidecars/$SIDECAR_NAME"
echo "✓ Backend copied to sidecars directory as $SIDECAR_NAME"

# ============================================================================
echo ""
echo "[4/4] Building Tauri application..."
echo "============================================================================"
echo "This will build the frontend and Tauri application..."
npm run tauri:build
echo "✓ Tauri application built successfully"

# ============================================================================
echo ""
echo "============================================================================"
echo "                         Build Complete!"
echo "============================================================================"
echo ""
echo "Generated files:"
echo "  - Python Backend:  dist/rivalnxt_backend"
echo "  - Tauri App:       src-tauri/target/release/rivalnxt"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "  - AppImage:        src-tauri/target/release/bundle/appimage/"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  - DMG:             src-tauri/target/release/bundle/dmg/"
fi
echo ""
echo "============================================================================"

# Display file sizes
echo ""
echo "File sizes:"
if [ -f "dist/rivalnxt_backend" ]; then
    ls -lh dist/rivalnxt_backend | awk '{print "  rivalnxt_backend: " $5}'
fi
if [ -f "src-tauri/target/release/rivalnxt" ]; then
    ls -lh src-tauri/target/release/rivalnxt | awk '{print "  rivalnxt: " $5}'
fi

echo ""
echo "Build completed successfully at $(date)"
echo ""