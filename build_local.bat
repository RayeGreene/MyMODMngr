@echo off
setlocal enabledelayedexpansion
REM ============================================================================
REM Complete Build Script for RivalNxt
REM This script builds all components from scratch for new users:
REM - Installs npm dependencies
REM - Builds Rust UE Tools with PyO3 bindings
REM - Creates Python wrapper module
REM - Builds Python backend with PyInstaller
REM - Builds Tauri application (frontend + desktop app)
REM ============================================================================

echo.
echo ============================================================================
echo                    RivalNxt Complete Build Script
echo ============================================================================
echo.

REM Check if we're in the correct directory
if not exist "src-tauri" (
    echo ERROR: src-tauri directory not found!
    echo Please run this script from the project root directory.
    exit /b 1
)

REM ============================================================================
echo [1/6] Installing npm dependencies...
echo ============================================================================
echo Checking for node_modules...
if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install failed!
        exit /b 1
    )
    echo ✓ npm dependencies installed successfully
) else (
    echo ✓ node_modules already exists, skipping npm install
)

REM ============================================================================
echo.
echo [2/6] Building Rust UE Tools with PyO3 bindings...
echo ============================================================================
cd src-tauri\src\rust-ue-tools

echo 📦 Building debug version with PyO3 bindings...
cargo build --lib --features pyo3
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Debug build failed
    cd ..\..\..
    exit /b 1
)

echo 📦 Building release version with PyO3 bindings...
cargo build --lib --release --features pyo3
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Release build failed
    cd ..\..\..
    exit /b 1
)

echo 🔗 Checking Python bindings...
if exist "target\debug\rust_ue_tools.dll" (
    echo ✅ Debug library built successfully
) else (
    echo ❌ Debug library not found
    cd ..\..\..
    exit /b 1
)

if exist "target\release\rust_ue_tools.dll" (
    echo ✅ Release library built successfully
) else (
    echo ❌ Release library not found
    cd ..\..\..
    exit /b 1
)

REM ============================================================================
echo.
echo [3/6] Setting up Python bindings...
echo ============================================================================

REM Create directory for Python libraries
if not exist "..\..\..\python_libs" mkdir ..\..\..\python_libs

REM Copy debug version (for development)
copy "target\debug\rust_ue_tools.dll" "..\..\..\python_libs\rust_ue_tools.dll" >nul
echo ✅ Copied Windows debug library

REM Copy release version (for production)
copy "target\release\rust_ue_tools.dll" "..\..\..\python_libs\rust_ue_tools_release.dll" >nul
echo ✅ Copied Windows release library

REM Create a simple Python wrapper module
echo """ > ..\..\..\python_libs\rust_ue_tools.py
echo Python wrapper for rust-ue-tools library >> ..\..\..\python_libs\rust_ue_tools.py
echo This module provides access to the Rust implementation of UE file operations >> ..\..\..\python_libs\rust_ue_tools.py
echo """ >> ..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\python_libs\rust_ue_tools.py
echo import os >> ..\..\..\python_libs\rust_ue_tools.py
echo import sys >> ..\..\..\python_libs\rust_ue_tools.py
echo import platform >> ..\..\..\python_libs\rust_ue_tools.py
echo from pathlib import Path >> ..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\python_libs\rust_ue_tools.py
echo # Add current directory to path so we can import the shared library >> ..\..\..\python_libs\rust_ue_tools.py
echo current_dir = Path(__file__).parent >> ..\..\..\python_libs\rust_ue_tools.py
echo sys.path.insert(0, str(current_dir)) >> ..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\python_libs\rust_ue_tools.py
echo # Try to load the shared library >> ..\..\..\python_libs\rust_ue_tools.py
echo _lib = None >> ..\..\..\python_libs\rust_ue_tools.py
echo _lib_name = None >> ..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\python_libs\rust_ue_tools.py
echo system = platform.system() >> ..\..\..\python_libs\rust_ue_tools.py
echo if system == "Windows": >> ..\..\..\python_libs\rust_ue_tools.py
echo     REM Try debug version first, then release >> ..\..\..\python_libs\rust_ue_tools.py
echo     for lib_name in ["rust_ue_tools.dll", "rust_ue_tools_release.dll"]: >> ..\..\..\python_libs\rust_ue_tools.py
echo         try: >> ..\..\..\python_libs\rust_ue_tools.py
echo             _lib = __import__(lib_name.rsplit(".", 1)[0]) >> ..\..\..\python_libs\rust_ue_tools.py
echo             _lib_name = lib_name >> ..\..\..\python_libs\rust_ue_tools.py
echo             break >> ..\..\..\python_libs\rust_ue_tools.py
echo         except (ImportError, OSError): >> ..\..\..\python_libs\rust_ue_tools.py
echo             continue >> ..\..\..\python_libs\rust_ue_tools.py
echo else:  # Linux and macOS >> ..\..\..\python_libs\rust_ue_tools.py
echo     REM Handle other platforms similarly >> ..\..\..\python_libs\rust_ue_tools.py
echo     pass >> ..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\python_libs\rust_ue_tools.py
echo if _lib is None: >> ..\..\..\python_libs\rust_ue_tools.py
echo     print(f"Warning: Could not load rust-ue-tools library") >> ..\..\..\python_libs\rust_ue_tools.py
echo     print("Falling back to external tools (repak.exe, retoc_cli.exe)") >> ..\..\..\python_libs\rust_ue_tools.py
echo else: >> ..\..\..\python_libs\rust_ue_tools.py
echo     print(f"✅ Loaded rust-ue-tools from {_lib_name}") >> ..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\python_libs\rust_ue_tools.py
echo # Import the functions from the Rust library >> ..\..\..\python_libs\rust_ue_tools.py
echo try: >> ..\..\..\python_libs\rust_ue_tools.py
echo     extract_asset_paths_from_zip_py = getattr(_lib, 'extract_asset_paths_from_zip_py') >> ..\..\..\python_libs\rust_ue_tools.py
echo     extract_pak_asset_map_from_folder_py = getattr(_lib, 'extract_pak_asset_map_from_folder_py') >> ..\..\..\python_libs\rust_ue_tools.py
echo     free_c_string = getattr(_lib, 'free_c_string') >> ..\..\..\python_libs\rust_ue_tools.py
echo except AttributeError as e: >> ..\..\..\python_libs\rust_ue_tools.py
echo     print(f"Warning: Could not import required functions: {e}") >> ..\..\..\python_libs\rust_ue_tools.py
echo     extract_asset_paths_from_zip_py = None >> ..\..\..\python_libs\rust_ue_tools.py
echo     extract_pak_asset_map_from_folder_py = None >> ..\..\..\python_libs\rust_ue_tools.py
echo     free_c_string = None >> ..\..\..\python_libs\rust_ue_tools.py
echo. >> ..\..\..\python_libs\rust_ue_tools.py
echo __all__ = [ >> ..\..\..\python_libs\rust_ue_tools.py
echo     'extract_asset_paths_from_zip_py', >> ..\..\..\python_libs\rust_ue_tools.py
echo     'extract_pak_asset_map_from_folder_py', >> ..\..\..\python_libs\rust_ue_tools.py
echo     'free_c_string' >> ..\..\..\python_libs\rust_ue_tools.py
echo ] >> ..\..\..\python_libs\rust_ue_tools.py

echo ✅ Created Python wrapper module

REM Return to project root
cd ..\..\..

REM ============================================================================
echo.
echo [4/6] Building Python backend with PyInstaller...
echo ============================================================================
echo Cleaning previous builds...
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build

echo Building backend executable using spec file...
python -m PyInstaller --noconfirm --clean rivalnxt_backend_merged.spec
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Python backend build failed!
    exit /b 1
)

if not exist dist\rivalnxt_backend.exe (
    echo ERROR: Backend executable not found in dist directory!
    exit /b 1
)
echo ✓ Python backend built successfully

REM ============================================================================
echo.
echo [5/6] Copying backend to Tauri sidecars...
echo ============================================================================
if not exist src-tauri\sidecars mkdir src-tauri\sidecars
copy /Y dist\rivalnxt_backend.exe src-tauri\sidecars\rivalnxt_backend-x86_64-pc-windows-msvc.exe >nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to copy backend executable!
    exit /b 1
)
echo ✓ Backend copied to sidecars directory

REM ============================================================================
echo.
echo [6/6] Building Tauri application...
echo ============================================================================
echo This will build the frontend and Tauri application...
call npm run tauri:build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Tauri build failed!
    exit /b 1
)
echo ✓ Tauri application built successfully

REM ============================================================================
echo.
echo ============================================================================
echo                         Build Complete!
echo ============================================================================
echo.
echo Generated files:
echo   - Python Backend:  dist\rivalnxt_backend.exe
echo   - Tauri App:       src-tauri\target\release\rivalnxt.exe
echo   - NSIS Installer:  src-tauri\target\release\bundle\nsis\RivalNxt_0.1.0_x64-setup.exe
echo.
echo ============================================================================

REM Display file sizes
echo.
echo File sizes:
if exist dist\rivalnxt_backend.exe (
    for %%A in (dist\rivalnxt_backend.exe) do (
        set /a size_mb=%%~zA/1048576
        echo   rivalnxt_backend.exe: !size_mb! MB
    )
)
if exist src-tauri\target\release\rivalnxt.exe (
    for %%A in (src-tauri\target\release\rivalnxt.exe) do (
        set /a size_mb=%%~zA/1048576
        echo   rivalnxt.exe: !size_mb! MB
    )
)
if exist src-tauri\target\release\bundle\nsis\RivalNxt_0.1.0_x64-setup.exe (
    for %%A in (src-tauri\target\release\bundle\nsis\RivalNxt_0.1.0_x64-setup.exe) do (
        set /a size_mb=%%~zA/1048576
        echo   RivalNxt_0.1.0_x64-setup.exe: !size_mb! MB
    )
)

echo.
echo Build completed successfully at %date% %time%
echo.
echo 📋 What was built:
echo   1. Rust UE Tools library with PyO3 bindings
echo   2. Python wrapper module for Rust library
echo   3. Python backend executable (PyInstaller)
echo   4. Tauri desktop application
echo   5. NSIS installer for Windows
echo.