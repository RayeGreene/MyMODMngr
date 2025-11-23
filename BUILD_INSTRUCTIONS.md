# RivalNxt Build Instructions

This document explains how to build the complete RivalNxt application from source.

## Prerequisites

### All Platforms
- **Node.js** (v18 or later) with npm
- **Python** (3.11 or later)
- **Rust** (latest stable version)
- **PyInstaller**: `pip install pyinstaller`

### Windows
- **Visual Studio Build Tools** or Visual Studio with C++ development tools
- **WinRAR** (optional, for archive handling)

### Linux
- **Build essentials**: `sudo apt install build-essential`
- **Additional dependencies**: `sudo apt install libwebkit2gtk-4.0-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### macOS
- **Xcode Command Line Tools**: `xcode-select --install`

## Quick Start

### Windows
Simply run the complete build script:
```cmd
build_local.bat
```

### Linux/macOS
Make the script executable (first time only):
```bash
chmod +x build_local.sh
```

Then run it:
```bash
./build_local.sh
```

## Build Process

The build script performs the following steps:

### 1. Build Rust UE Tools with PyO3 Bindings
**Command:** `cargo build --release --features pyo3 --lib`  
**Working Directory:** `src-tauri/src/rust-ue-tools/`

**What it does:**
- Compiles the Rust library with PyO3 features for Python integration
- Enables Python bindings for Unreal Engine file operations (PAK/UTOC handling)

**Output Files:**
- Windows: `src-tauri/src/rust-ue-tools/target/release/rust_ue_tools.dll`
- Linux: `src-tauri/src/rust-ue-tools/target/release/librust_ue_tools.so`
- macOS: `src-tauri/src/rust-ue-tools/target/release/librust_ue_tools.dylib`

**Used By:**
- Python backend (via PyO3 bindings) for fast PAK file operations
- Tauri application (as a Rust dependency in `src-tauri/Cargo.toml`)

---

### 2. Build Python Backend
**Command:** `python -m PyInstaller --noconfirm --clean rivalnxt_backend_merged.spec`  
**Working Directory:** Project root

**What it does:**
- Bundles the FastAPI backend server into a standalone executable
- Includes all Python dependencies (FastAPI, SQLite, etc.)
- Collects database migration files from `core/db/migrations/`
- Excludes unnecessary GUI libraries (PyQt5/PyQt6) to reduce size

**Output Files:**
- Windows: `dist/rivalnxt_backend.exe` (~115 MB)
- Linux/macOS: `dist/rivalnxt_backend` (~115 MB)

**Intermediate Files (can be deleted):**
- `build/` - PyInstaller build cache
- `rivalnxt_backend.spec` - PyInstaller configuration

**Used By:**
- Copied to Tauri sidecars directory (next step)
- Bundled with the Tauri application as a sidecar process

---

### 3. Copy Backend to Tauri Sidecars
**Command (Windows):** `copy dist\rivalnxt_backend.exe src-tauri\sidecars\rivalnxt_backend-x86_64-pc-windows-msvc.exe`  
**Command (Linux):** `cp dist/rivalnxt_backend src-tauri/sidecars/rivalnxt_backend-x86_64-unknown-linux-gnu`

**What it does:**
- Copies the backend executable to the Tauri sidecars directory
- Renames it according to Tauri's platform-specific naming convention
- The target triple in the filename tells Tauri which platform this binary is for

**Output Files:**
- Windows: `src-tauri/sidecars/rivalnxt_backend-x86_64-pc-windows-msvc.exe`
- Linux: `src-tauri/sidecars/rivalnxt_backend-x86_64-unknown-linux-gnu`
- macOS: `src-tauri/sidecars/rivalnxt_backend-aarch64-apple-darwin`

**Used By:**
- Tauri build process (step 4) bundles this into the final application
- At runtime, Tauri launches this as a sidecar process to run the backend server
- Configured in `src-tauri/tauri.conf.json` under `bundle.externalBin`

---

### 4. Build Tauri Application
**Command:** `npm run tauri:build`  
**Working Directory:** Project root

**What it does:**
1. **Frontend Build** (via `beforeBuildCommand`):
   - Runs `vite build` to compile React/TypeScript frontend
   - Outputs to `build/` directory
   - Bundles all UI components, styles, and assets

2. **Tauri Rust Build**:
   - Compiles the Tauri Rust application (`src-tauri/src/main.rs`)
   - Links the rust-ue-tools library as a dependency
   - Embeds the frontend build into the binary
   - Bundles the backend sidecar executable

3. **Installer Creation**:
   - Creates platform-specific installers (NSIS for Windows, AppImage/Deb for Linux, DMG for macOS)
   - Includes all necessary files and dependencies

**Output Files:**
- **Main Application:**
  - Windows: `src-tauri/target/release/rivalnxt.exe` (~16 MB)
  - Linux: `src-tauri/target/release/rivalnxt` (~16 MB)
  - macOS: `src-tauri/target/release/rivalnxt` (~16 MB)

- **Installers:**
  - Windows: `src-tauri/target/release/bundle/nsis/RivalNxt_0.1.0_x64-setup.exe` (~118 MB)
  - Linux: `src-tauri/target/release/bundle/appimage/rivalnxt_0.1.0_amd64.AppImage`
  - Linux: `src-tauri/target/release/bundle/deb/rivalnxt_0.1.0_amd64.deb`
  - macOS: `src-tauri/target/release/bundle/dmg/RivalNxt_0.1.0_x64.dmg`
  - macOS: `src-tauri/target/release/bundle/macos/RivalNxt.app`

**What's Included:**
- Frontend UI (React app)
- Tauri runtime (window management, system integration)
- Backend server (as sidecar executable)
- Rust UE Tools library (linked into Tauri binary)

**Used By:**
- End users for installation and running the application
- The installer bundles everything needed to run RivalNxt

## Output Files

### Windows
- **Backend**: `dist/rivalnxt_backend.exe` (~115 MB)
- **Application**: `src-tauri/target/release/rivalnxt.exe` (~16 MB)
- **Installer**: `src-tauri/target/release/bundle/nsis/RivalNxt_0.1.0_x64-setup.exe` (~118 MB)

### Linux
- **Backend**: `dist/rivalnxt_backend` (~115 MB)
- **Application**: `src-tauri/target/release/rivalnxt` (~16 MB)
- **AppImage**: `src-tauri/target/release/bundle/appimage/rivalnxt_0.1.0_amd64.AppImage`
- **Deb Package**: `src-tauri/target/release/bundle/deb/rivalnxt_0.1.0_amd64.deb`

### macOS
- **Backend**: `dist/rivalnxt_backend` (~115 MB)
- **Application**: `src-tauri/target/release/rivalnxt` (~16 MB)
- **DMG**: `src-tauri/target/release/bundle/dmg/RivalNxt_0.1.0_x64.dmg`
- **App Bundle**: `src-tauri/target/release/bundle/macos/RivalNxt.app`

## Manual Build Steps

If you prefer to build components individually:

### 1. Build Rust UE Tools
```bash
cd src-tauri/src/rust-ue-tools
cargo build --release --features pyo3 --lib
cd ../../..
```

### 2. Build Python Backend
```bash
python -m PyInstaller --noconfirm --clean rivalnxt_backend_merged.spec
```

### 3. Copy Backend to Sidecars
**Windows:**
```cmd
mkdir src-tauri\sidecars
copy dist\rivalnxt_backend.exe src-tauri\sidecars\rivalnxt_backend-x86_64-pc-windows-msvc.exe
```

**Linux/macOS:**
```bash
mkdir -p src-tauri/sidecars
cp dist/rivalnxt_backend src-tauri/sidecars/rivalnxt_backend-x86_64-unknown-linux-gnu
chmod +x src-tauri/sidecars/rivalnxt_backend-x86_64-unknown-linux-gnu
```

### 4. Build Tauri Application
```bash
npm run tauri:build
```

## Troubleshooting

### Build Fails on Step 1 (Rust)
- Ensure Rust is installed: `rustc --version`
- Update Rust: `rustup update`
- Check that you have the required system libraries

### Build Fails on Step 2 (Python)
- Ensure PyInstaller is installed: `pip install pyinstaller`
- Check Python version: `python --version` (should be 3.11+)
- Try clearing PyInstaller cache: `pyinstaller --clean`

### Build Fails on Step 4 (Tauri)
- Ensure Node.js is installed: `node --version`
- Install dependencies: `npm install`
- Check that all system dependencies are installed

### Backend Executable Not Found
- Check that PyInstaller completed successfully
- Look for errors in the PyInstaller output
- Verify the `dist/` directory exists

## Development Builds

For faster development builds without optimization:

### Rust (Debug Build)
```bash
cd src-tauri/src/rust-ue-tools
cargo build --features pyo3 --lib
```

### Tauri (Dev Mode)
```bash
npm run tauri:dev
```

## Clean Build

To start fresh:

**Windows:**
```cmd
rmdir /s /q dist build src-tauri\target
```

**Linux/macOS:**
```bash
rm -rf dist build src-tauri/target
```

Then run the build script again.

## Notes

- The first build will take longer as it downloads and compiles dependencies
- Subsequent builds will be faster due to caching
- The complete build process takes approximately 3-5 minutes on modern hardware
- Ensure you have at least 5GB of free disk space for build artifacts

## Support

For issues or questions, please check:
- Project README.md
- GitHub Issues
- Build logs in the terminal output
