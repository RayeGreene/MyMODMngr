## 🎯 Pre-Release Announcement
This is a beta pre-release focused on PyO3 Rust integration, automated CI/CD pipelines, and seamless NexusMods integration.

## ✨ New Features

### 🦀 PyO3 Rust Integration
- Integrated PyO3 for seamless Rust-Python interoperability
- Replaced external CLI tools with native `rust-ue-tools` library
- Improved performance for PAK/UTOC asset processing via direct memory access

### 🌐 NXM Protocol Enhancements
- **Bi-directional Handoff System** for reliable mod downloads
- **Background Processing** via new `NxmBackgroundListener`
- Seamless "Download with Mod Manager" support from NexusMods

### 🔧 Enhanced Build System
- **One-Click Build Script** (`build_local.bat`) for complete local setup
- **Automated CI/CD Workflows** for consistent release generation
- **Maturin Integration** for optimized Python wheel building

### 📦 Build Improvements
- Automatic PyO3 library compilation in CI/CD
- Size validation to ensure backend integrity
- Robust file path detection for different build environments

## 🛠️ Technical Details
- **Backend:** Python 3.10+ with FastAPI
- **Frontend:** React 18 with Tauri 2.0
- **Rust Integration:** PyO3 with Maturin for performance-critical operations
- **Build System:** GitHub Actions for CI/CD + Batch scripts for local dev

## 📥 Installation

### Windows
1. Download `RivalNxt_x64-setup.exe`
2. Run the installer
3. Launch RivalNxt from Start Menu

### Manual Installation
- Download the executable and run directly
- No external dependencies required (Python is bundled)

---
**Note:** This is a beta pre-release. Use for testing purposes only.
