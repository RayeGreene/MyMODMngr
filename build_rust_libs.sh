#!/bin/bash

# Build script for Rust UE Tools integration
# This script builds the Rust library and prepares it for Python integration

set -e

echo "🔨 Building Rust UE Tools library..."

# Change to the rust-ue-tools directory
cd src-tauri/src/rust-ue-tools

echo "📦 Building debug version..."
cargo build

echo "📦 Building release version..."
cargo build --release

echo "🔗 Checking Python bindings..."
# Check if the library was built correctly
if [ -f "target/debug/librust_ue_tools.so" ] || [ -f "target/debug/librust_ue_tools.dylib" ] || [ -f "target/debug/rust_ue_tools.dll" ]; then
    echo "✅ Debug library built successfully"
else
    echo "❌ Debug library not found"
    exit 1
fi

if [ -f "target/release/librust_ue_tools.so" ] || [ -f "target/release/librust_ue_tools.dylib" ] || [ -f "target/release/rust_ue_tools.dll" ]; then
    echo "✅ Release library built successfully"
else
    echo "❌ Release library not found"
    exit 1
fi

echo "🐍 Setting up Python bindings..."

# Copy the built library to a location where Python can find it
mkdir -p ../../../../python_libs

# Copy debug version (for development)
if [ -f "target/debug/rust_ue_tools.dll" ]; then
    cp target/debug/rust_ue_tools.dll ../../../../python_libs/rust_ue_tools.dll
    echo "✅ Copied Windows debug library"
elif [ -f "target/debug/librust_ue_tools.so" ]; then
    cp target/debug/librust_ue_tools.so ../../../../python_libs/rust_ue_tools.so
    echo "✅ Copied Linux debug library"
elif [ -f "target/debug/librust_ue_tools.dylib" ]; then
    cp target/debug/librust_ue_tools.dylib ../../../../python_libs/rust_ue_tools.dylib
    echo "✅ Copied macOS debug library"
fi

# Copy release version (for production)
if [ -f "target/release/rust_ue_tools.dll" ]; then
    cp target/release/rust_ue_tools.dll ../../../../python_libs/rust_ue_tools_release.dll
    echo "✅ Copied Windows release library"
elif [ -f "target/release/librust_ue_tools.so" ]; then
    cp target/release/librust_ue_tools.so ../../../../python_libs/rust_ue_tools_release.so
    echo "✅ Copied Linux release library"
elif [ -f "target/release/librust_ue_tools.dylib" ]; then
    cp target/release/librust_ue_tools.dylib ../../../../python_libs/rust_ue_tools_release.dylib
    echo "✅ Copied macOS release library"
fi

# Create a simple Python wrapper module
cat > ../../../../python_libs/rust_ue_tools.py << 'EOF'
"""
Python wrapper for rust-ue-tools library
This module provides access to the Rust implementation of UE file operations
"""

import os
import sys
import platform
from pathlib import Path

# Add current directory to path so we can import the shared library
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Try to load the shared library
_lib = None
_lib_name = None

system = platform.system()
if system == "Windows":
    # Try debug version first, then release
    for lib_name in ["rust_ue_tools.dll", "rust_ue_tools_release.dll"]:
        try:
            _lib = __import__(lib_name.rsplit(".", 1)[0])
            _lib_name = lib_name
            break
        except (ImportError, OSError):
            continue
elif system == "Darwin":  # macOS
    for lib_name in ["rust_ue_tools.dylib", "rust_ue_tools_release.dylib"]:
        try:
            _lib = __import__(lib_name.rsplit(".", 1)[0])
            _lib_name = lib_name
            break
        except (ImportError, OSError):
            continue
else:  # Linux and others
    for lib_name in ["rust_ue_tools.so", "rust_ue_tools_release.so"]:
        try:
            _lib = __import__(lib_name.rsplit(".", 1)[0])
            _lib_name = lib_name
            break
        except (ImportError, OSError):
            continue

if _lib is None:
    print(f"Warning: Could not load rust-ue-tools library")
    print("Falling back to external tools (repak.exe, retoc_cli.exe)")
else:
    print(f"✅ Loaded rust-ue-tools from {_lib_name}")

# Import the functions from the Rust library
try:
    extract_asset_paths_from_zip_py = getattr(_lib, 'extract_asset_paths_from_zip_py')
    extract_pak_asset_map_from_folder_py = getattr(_lib, 'extract_pak_asset_map_from_folder_py')
    free_c_string = getattr(_lib, 'free_c_string')
except AttributeError as e:
    print(f"Warning: Could not import required functions: {e}")
    extract_asset_paths_from_zip_py = None
    extract_pak_asset_map_from_folder_py = None
    free_c_string = None

__all__ = [
    'extract_asset_paths_from_zip_py',
    'extract_pak_asset_map_from_folder_py',
    'free_c_string'
]
EOF

echo "✅ Created Python wrapper module"

echo ""
echo "🎉 Build complete! The Rust UE Tools library is ready for use."
echo ""
echo "📋 Summary:"
echo "  - Rust library built successfully"
echo "  - Python bindings created"
echo "  - External tool dependencies can now be removed"
echo ""
echo "🔧 Next steps:"
echo "  1. Run the test script: python test_rust_integration.py"
echo "  2. Remove repak.exe and retoc_cli.exe dependencies from your code"
echo "  3. The Python code will automatically use the Rust implementation"
echo ""
echo "📁 Library locations:"
echo "  - Debug library: python_libs/rust_ue_tools.*"
echo "  - Release library: python_libs/rust_ue_tools_release.*"
echo "  - Python wrapper: python_libs/rust_ue_tools.py"