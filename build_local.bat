@echo off
setlocal enabledelayedexpansion
REM ============================================================================
REM Complete Build Script for RivalNxt
REM This script builds all components: Rust libraries, PyO3 bindings, 
REM Python backend, and Tauri application
REM ============================================================================

echo.
echo ============================================================================
echo                    RivalNxt Build Script
echo ============================================================================
echo.

REM Check if we're in the correct directory
if not exist "src-tauri" (
    echo ERROR: src-tauri directory not found!
    echo Please run this script from the project root directory.
    exit /b 1
)

REM ============================================================================
echo [1/4] Building Rust UE Tools with PyO3 bindings...
echo ============================================================================
cd src-tauri\src\rust-ue-tools
echo Building release version with PyO3 features...
cargo build --release --features pyo3 --lib
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Rust UE Tools build failed!
    cd ..\..\..
    exit /b 1
)
echo ✓ Rust UE Tools built successfully
cd ..\..\..

REM ============================================================================
echo.
echo [2/4] Building Python backend with PyInstaller...
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
echo [3/4] Copying backend to Tauri sidecars...
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
echo [4/4] Building Tauri application...
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