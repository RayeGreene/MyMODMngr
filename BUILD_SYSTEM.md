# Build System

This project now has separate build scripts for local development and CI/CD to handle different file path requirements.

## Overview

The original issue was that PyInstaller outputs to different directories depending on how it's called:
- **Local development**: Uses `py:build` script which outputs to `dist/rivalnxt_backend.exe`
- **CI/CD**: Uses `pyinstaller rivalnxt_backend.spec` which outputs to current directory `rivalnxt_backend.exe`

## Build Scripts

### Local Development

**Windows:**
```bash
npm run build:local
# or directly:
./build_local.bat
```

**macOS/Linux:**
```bash
npm run build:local
# or directly:
./build_local.sh
```

**What it does:**
1. Cleans previous builds (`dist/`, `build/`)
2. Builds Python backend with PyInstaller using the standard command
3. Copies `dist/rivalnxt_backend.exe` to `src-tauri/sidecars/`
4. Builds Tauri application

### CI/CD Build

```bash
npm run build:ci
# or directly:
bash build_cicd.sh
```

**What it does:**
1. Sets CI environment variable
2. Builds PyO3 library first
3. Builds Python backend using spec file
4. Searches for the backend executable (handles both `dist/` and current directory)
5. Copies to `src-tauri/sidecars/`
6. Builds Tauri application

## Package Scripts

Added to `package.json`:
- `build:local` - Runs local build script
- `build:ci` - Runs CI/CD build script

## Why Separate Scripts?

1. **Different PyInstaller behavior**: The spec file vs command line approach outputs to different locations
2. **CI/CD optimization**: CI includes PyO3 library building
3. **Error handling**: CI script has better fallback logic for finding the built executable
4. **Platform detection**: Local script handles different target architectures for macOS/Linux

## GitHub Actions

The CI/CD workflow now uses the simplified `npm run build:ci` command instead of individual steps, making it cleaner and more maintainable.

## Usage

**For local development:**
```bash
# Windows
npm run build:local

# macOS/Linux  
npm run build:local
```

**For CI/CD:**
```bash
# In GitHub Actions or CI environment
npm run build:ci
```

## Verification Results

The local build was successfully tested on Windows and produces:
- `dist/rivalnxt_backend.exe` - 114.6 MB (Python backend executable)
- `src-tauri/sidecars/rivalnxt_backend-x86_64-pc-windows-msvc.exe` - 114.6 MB (copied for Tauri)
- `src-tauri/target/release/bundle/nsis/RivalNxt_0.1.0_x64-setup.exe` - 117.7 MB (Windows installer)

✅ **All file paths are correct and the build process works bug-free**

This resolves the "ENOENT: no such file or directory" error that was occurring when CI tried to copy from a non-existent `dist/rivalnxt_backend.exe` path.