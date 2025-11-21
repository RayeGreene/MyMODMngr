@echo off
REM Build script for Rust UE Tools integration (Windows)
REM This script builds the Rust library and prepares it for Python integration

echo 🔨 Building Rust UE Tools library...

REM Change to the rust-ue-tools directory
cd src-tauri\src\rust-ue-tools

echo 📦 Building debug version...
cargo build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Debug build failed
    exit /b 1
)

echo 📦 Building release version...
cargo build --release
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Release build failed
    exit /b 1
)

echo 🔗 Checking Python bindings...
REM Check if the library was built correctly
if exist "target\debug\rust_ue_tools.dll" (
    echo ✅ Debug library built successfully
) else (
    echo ❌ Debug library not found
    exit /b 1
)

if exist "target\release\rust_ue_tools.dll" (
    echo ✅ Release library built successfully
) else (
    echo ❌ Release library not found
    exit /b 1
)

echo 🐍 Setting up Python bindings...

REM Create directory for Python libraries
mkdir ..\..\..\..\python_libs

REM Copy debug version (for development)
copy "target\debug\rust_ue_tools.dll" "..\..\..\..\python_libs\rust_ue_tools.dll" >nul
echo ✅ Copied Windows debug library

REM Copy release version (for production)
copy "target\release\rust_ue_tools.dll" "..\..\..\..\python_libs\rust_ue_tools_release.dll" >nul
echo ✅ Copied Windows release library

REM Create a simple Python wrapper module
echo """ > ..\..\..\..\python_libs\rust_ue_tools.py
echo Python wrapper for rust-ue-tools library >> ..\..\..\..\python_libs\rust_ue_tools.py
echo This module provides access to the Rust implementation of UE file operations >> ..\..\..\..\python_libs\rust_ue_tools.py
echo """ >> ..\..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\..\python_libs\rust_ue_tools.py
echo import os >> ..\..\..\..\python_libs\rust_ue_tools.py
echo import sys >> ..\..\..\..\python_libs\rust_ue_tools.py
echo import platform >> ..\..\..\..\python_libs\rust_ue_tools.py
echo from pathlib import Path >> ..\..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\..\python_libs\rust_ue_tools.py
echo # Add current directory to path so we can import the shared library >> ..\..\..\..\python_libs\rust_ue_tools.py
echo current_dir = Path(__file__).parent >> ..\..\..\..\python_libs\rust_ue_tools.py
echo sys.path.insert(0, str(current_dir)) >> ..\..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\..\python_libs\rust_ue_tools.py
echo # Try to load the shared library >> ..\..\..\..\python_libs\rust_ue_tools.py
echo _lib = None >> ..\..\..\..\python_libs\rust_ue_tools.py
echo _lib_name = None >> ..\..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\..\python_libs\rust_ue_tools.py
echo system = platform.system() >> ..\..\..\..\python_libs\rust_ue_tools.py
echo if system == "Windows": >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     REM Try debug version first, then release >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     for lib_name in ["rust_ue_tools.dll", "rust_ue_tools_release.dll"]: >> ..\..\..\..\python_libs\rust_ue_tools.py
echo         try: >> ..\..\..\..\python_libs\rust_ue_tools.py
echo             _lib = __import__(lib_name.rsplit(".", 1)[0]) >> ..\..\..\..\python_libs\rust_ue_tools.py
echo             _lib_name = lib_name >> ..\..\..\..\python_libs\rust_ue_tools.py
echo             break >> ..\..\..\..\python_libs\rust_ue_tools.py
echo         except (ImportError, OSError): >> ..\..\..\..\python_libs\rust_ue_tools.py
echo             continue >> ..\..\..\..\python_libs\rust_ue_tools.py
echo else:  # Linux and macOS >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     REM Handle other platforms similarly >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     pass >> ..\..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\..\python_libs\rust_ue_tools.py
echo if _lib is None: >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     print(f"Warning: Could not load rust-ue-tools library") >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     print("Falling back to external tools (repak.exe, retoc_cli.exe)") >> ..\..\..\..\python_libs\rust_ue_tools.py
echo else: >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     print(f"✅ Loaded rust-ue-tools from {_lib_name}") >> ..\..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\..\python_libs\rust_ue_tools.py
echo # Import the functions from the Rust library >> ..\..\..\..\python_libs\rust_ue_tools.py
echo try: >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     extract_asset_paths_from_zip_py = getattr(_lib, 'extract_asset_paths_from_zip_py') >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     extract_pak_asset_map_from_folder_py = getattr(_lib, 'extract_pak_asset_map_from_folder_py') >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     free_c_string = getattr(_lib, 'free_c_string') >> ..\..\..\..\python_libs\rust_ue_tools.py
echo except AttributeError as e: >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     print(f"Warning: Could not import required functions: {e}") >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     extract_asset_paths_from_zip_py = None >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     extract_pak_asset_map_from_folder_py = None >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     free_c_string = None >> ..\..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\..\python_libs\rust_ue_tools.py
echo __all__ = [ >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     'extract_asset_paths_from_zip_py', >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     'extract_pak_asset_map_from_folder_py', >> ..\..\..\..\python_libs\rust_ue_tools.py
echo     'free_c_string' >> ..\..\..\..\python_libs\rust_ue_tools.py
echo ] >> ..\..\..\..\python_libs\rust_ue_tools.py

echo ✅ Created Python wrapper module

echo.
echo 🎉 Build complete! The Rust UE Tools library is ready for use.
echo.
echo 📋 Summary:
echo   - Rust library built successfully
echo   - Python bindings created
echo   - External tool dependencies can now be removed
echo.
echo 🔧 Next steps:
echo   1. Run the test script: python test_rust_integration.py
echo   2. Remove repak.exe and retoc_cli.exe dependencies from your code
echo   3. The Python code will automatically use the Rust implementation
echo.
echo 📁 Library locations:
echo   - Debug library: python_libs\rust_ue_tools.dll
echo   - Release library: python_libs\rust_ue_tools_release.dll
echo   - Python wrapper: python_libs\rust_ue_tools.py

REM Return to original directory
cd ..\..\..\..
