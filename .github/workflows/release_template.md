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

## 📥 Downloads

| File | Platform | Checksum |
|------|----------|----------|
| [<INSTALLER_FILENAME>](<INSTALLER_URL>) | x64 Windows | [checksum](<CHECKSUM_URL>) |

> To verify the download on Windows, run `certutil -hashfile <filename> SHA256` and compare it with the value in the `.sha256` file.

---

**Note:** This is a beta pre-release intended for testing. Please report crashes, odd behavior, or Nexus Mods download issues via GitHub Issues
