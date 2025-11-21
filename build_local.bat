@echo off
echo Building RivalNxt for Local Development...

REM Clean previous builds
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build

echo Building Python backend with PyInstaller...
python -m PyInstaller --noconfirm --clean --onefile --exclude-module PyQt5 --exclude-module PyQt6 --collect-data core.db.migrations --name rivalnxt_backend src-python/run_server.py

if exist dist\rivalnxt_backend.exe (
    echo Copying backend executable to Tauri sidecars...
    if not exist src-tauri\sidecars mkdir src-tauri\sidecars
    copy dist\rivalnxt_backend.exe src-tauri\sidecars\rivalnxt_backend-x86_64-pc-windows-msvc.exe
    echo Local build completed successfully!
) else (
    echo ERROR: Backend executable not found in dist directory!
    exit /b 1
)

echo Building Tauri application...
npm run tauri:build

echo Local build process completed!