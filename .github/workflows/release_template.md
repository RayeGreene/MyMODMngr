## 🎯 Pre-Release Announcement
This is a beta pre-release focused on PyO3 Rust integration, automated CI/CD pipelines, and seamless Nexus Mods integration.

## ✨ New Features

### 🦀 PyO3 Rust Integration
- Integrated PyO3 for seamless Rust–Python interoperability.
- Replaced external CLI tools with the native `rust-ue-tools` library.
- Improved performance for PAK/UTOC asset processing via direct memory access.

### 🌐 NXM Protocol Enhancements
- Bi-directional handoff system for reliable mod downloads.
- Background processing via the new `NxmBackgroundListener`.
- Seamless “Download with Mod Manager” support from Nexus Mods.

### 🔧 Enhanced Build System
- One-click build script (`build_local.bat`) for complete local setup.
- Automated CI/CD workflows for consistent release generation.
- Maturin integration for optimized Python wheel building.

### 📦 Build Improvements
- Automatic PyO3 library compilation in CI/CD.
- Size validation to ensure backend integrity.
- Robust file-path detection for different build environments.

## 🛠️ Technical Details
- Backend: Python 3.10+ with FastAPI  
- Frontend: React 18 with Tauri 2.0  
- Rust integration: PyO3 with Maturin for performance-critical operations  
- Build system: GitHub Actions for CI/CD plus batch scripts for local development  

## 📥 Installation (Windows)

1. Download `<INSTALLER_FILENAME>` from the release assets.  
2. Run the installer.  
3. Launch RivalNxt from the Start Menu.  

## 📋 Checksum

| File               | Platform   | SHA256 Checksum   |
|-------------------|-----------|-------------------|
| `<INSTALLER_FILENAME>` | Windows x64 | `<SETUP_SHA256>` |

> Verify downloads: On Windows, run `certutil -hashfile <filename> SHA256` and compare the result with the checksum above.
