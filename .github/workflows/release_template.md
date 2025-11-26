## � RivalNxt - Production Release
A powerful Marvel Rivals mod manager with native Rust performance, seamless NexusMods integration, and automated build pipelines.

## ✨ Key Features

### 🦀 PyO3 Rust Integration
- Integrated PyO3 for seamless Rust–Python interoperability.
- Replaced external CLI tools with the native `rust-ue-tools` library.
- Improved performance for PAK/UTOC asset processing via direct memory access.

### 🌐 NXM Protocol Enhancements
- Bi-directional handoff system for reliable mod downloads.
- Background processing via the new `NxmBackgroundListener`.
- Seamless "Download with Mod Manager" support from Nexus Mods.

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

## 📥 Installation

### Quick Start
1. Download `<INSTALLER_FILENAME>` from the downloads table below
2. Run the installer
3. Launch RivalNxt from your Start Menu
4. Configure the required paths in Settings:
   - **Marvel Rivals game directory** → `marvel_rivals_root`
   - **Local downloads directory** → `marvel_rivals_local_downloads_root`
5. Add your [Nexus Mods API key](https://next.nexusmods.com/settings/api-keys) for automatic mod metadata

**No Python, Node.js, or Rust installation required** — everything is bundled!

> 📖 **Need more help?** See the [full installation guide](https://github.com/Rounak77382/RivalNxt?tab=readme-ov-file#-installation) for detailed setup instructions.

## 📥 Downloads

| File | Platform | Checksum |
|------|----------|----------|
| [<INSTALLER_FILENAME>](<INSTALLER_URL>) | x64 Windows | [checksum](<CHECKSUM_URL>) |

> To verify the download on Windows, run `certutil -hashfile <filename> SHA256` and compare it with the value in the `.sha256` file.

---

**Questions or issues?** Please report bugs or feature requests via [GitHub Issues](https://github.com/Rounak77382/RivalNxt/issues).
