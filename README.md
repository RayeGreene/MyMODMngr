<div align="center">

# RivalNxt

### Marvel Rivals Mod Manager

_One desktop app to manage, activate, and validate Marvel Rivals mods with conflict detection, NexusMods integration, and blazing-fast local database._

[![Windows](https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#installation)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?style=for-the-badge&logo=tauri&logoColor=black)](https://tauri.app)
[![License](https://img.shields.io/badge/License-TBD-lightgrey?style=for-the-badge)](#license)

[Features](#-features) • [Installation](#-installation) • [Development Guide](#-development-guide) • [Contributing](#-contributing)

</div>

## ✨ Features

**🎯 Core Functionality**

- **Smart Mod Management** - Activate, deactivate, and organize mods with per-mod and bulk actions
- **Conflict Detection** - Automatic detection and resolution of mod conflicts with tag rebuilding
- **One-Click Downloads** - Seamless NexusMods NXM protocol integration for instant mod installation

**🔧 Technical Highlights**

- **Local-First Database** - Portable SQLite with health checks and inspection utilities
- **Modern Tech Stack** - Tauri 2 desktop shell + React/Vite frontend + FastAPI/Python backend
- **Developer-Friendly** - Scriptable CLI utilities for automation and maintenance

**🌐 NexusMods Integration**

- API-powered metadata fetching and update notifications
- Graceful fallback to manual workflows when needed
- Full NXM protocol support for browser integration

## 🚀 Installation

### 1. Download the Installer

- Go to the **Releases** page.
- Download the latest setup file, for example:
  **`RivalNxt_0.1.0_x64-setup.exe`** (or any newer version).

### 2. Install & Launch

- Run the installer.
- Launch the application after installation completes.

### 3. Configure Required Paths

In **Settings**, fill in the following:

- **Marvel Rivals game directory** → `marvel_rivals_root`
- **Local downloads directory** → `marvel_rivals_local_downloads_root`

These paths are required for locating game files and managing mods properly.

#### ⚠️ Mod Folder Naming Convention

Every mod inside your `marvel_rivals_local_downloads_root` directory must follow this format:

`<name>-<modid>-<version>`

Example: `CoolSkin-12345-1.0.0`

This helps the app detect and track mods accurately.

### 4. Nexus Personal API Key

To enable automatic mod detail fetching and update notifications:

1. Go to **[https://next.nexusmods.com/settings/api-keys](https://next.nexusmods.com/settings/api-keys)**
2. Scroll **all the way down**
3. Copy your **Personal API Key**
4. Paste it into the API key field in the app's Settings

### 5. You're Ready to Use the App

No Node.js, Rust, or Python is needed for normal usage.

### For Developers

See the [Development Guide](#-development-guide) below.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Desktop      │    │    Backend      │
│   React + Vite  │◄──►│  Tauri Shell    │◄──►│  FastAPI + Py   │
│   TypeScript    │    │  Rust (Native)  │    │  REST API       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │   SQLite DB     │
                                               │ Conflict Views  │
                                               └─────────────────┘
```

**Tech Stack**

- **Frontend**: React 18, TypeScript, Vite 6, Radix UI, Tailwind CSS
- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLAlchemy
- **Desktop**: Tauri 2.0 (Rust), Windows native
- **Database**: SQLite with optimized materialized views

## 💻 Development Guide

### Prerequisites

- Windows 10/11 (for desktop builds)
- Node.js 18+ and Yarn
- [Rust toolchain](https://rustup.rs/) via rustup
- Python 3.10+
- Git

### Setup

```
# 1. Clone repository
git clone https://github.com/Rounak77382/Project_ModManager_Rivals.git
cd Project_ModManager_Rivals

# 2. Install frontend dependencies
yarn install

# 3. Setup Python environment
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 4. Start development servers
# Terminal 1: Backend
python src-python/run_server.py

# Terminal 2: Frontend
yarn dev

# OR run full desktop app
yarn desktop:dev
```

### Build Commands

```
yarn build          # Production web build
yarn desktop:build  # Full desktop application
```

### Project Structure

```
📦 RivalNxt
├── 📁 core/                    # Python backend modules
│   ├── api/                   # FastAPI endpoints (50+)
│   ├── db/                    # SQLite + migrations
│   ├── ingestion/             # File scanning & discovery
│   ├── nexus/                 # NexusMods API client
│   └── utils/                 # Shared utilities
├── 📁 scripts/                # CLI automation (25+ tools)
├── 📁 src/                    # React frontend
│   ├── components/           # UI components
│   ├── lib/                  # API client & utils
│   └── styles/               # Tailwind CSS
├── 📁 src-tauri/             # Rust desktop shell
└── 📁 src-python/            # Backend entry point
```

### Development Workflow

**Code Standards**

- Python: PEP 8 with type hints
- TypeScript: Strict mode, React hooks patterns
- Rust: Standard conventions with `tauri-plugin-*`

**Useful Commands**

```
# Database inspection
python -X utf8 -m scripts.inspect_db

# Database rebuild
python -X utf8 -m scripts.rebuild_sqlite

# Check missing metadata
python -X utf8 -m scripts.report_missing_tags
```

**VS Code Extensions** (Recommended)

- Python (ms-python.python)
- Rust Analyzer (rust-lang.rust-analyzer)
- TypeScript (ms-vscode.vscode-typescript-next)
- Tailwind CSS (bradlc.vscode-tailwindcss)

## ⚙️ Configuration

Configuration is stored at: `%APPDATA%/com.rivalnxt.modmanager/settings.json`

**Environment Variables**

| Variable                             | Description             | Default           |
| ------------------------------------ | ----------------------- | ----------------- |
| `MM_DATA_DIR`                        | Data directory override | Platform-specific |
| `MM_BACKEND_HOST`                    | Backend bind address    | `127.0.0.1`       |
| `MM_BACKEND_PORT`                    | Backend port            | `8000`            |
| `NEXUS_API_KEY`                      | NexusMods API key       | None              |
| `MARVEL_RIVALS_ROOT`                 | Game installation path  | Required          |
| `MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT` | Mod downloads folder    | Required          |

See [Configuration Guide](./NEXUS_API_KEY_USAGE.md) for detailed setup instructions.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](#contribution-guidelines) for details.

### Contribution Guidelines

**Getting Started**

1. Check [open issues](https://github.com/Rounak77382/Project_ModManager_Rivals/issues)
2. Look for [`good first issue`](https://github.com/Rounak77382/Project_ModManager_Rivals/labels/good%20first%20issue) labels
3. Open an issue for major changes before starting work

**Pull Request Process**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

**Code Quality Standards**

- Add tests for new features
- Update documentation
- Follow existing code style
- Validate all inputs and API parameters

## 📋 Roadmap

- [ ] Multi-language support
- [ ] Automatic mod updates
- [ ] Cloud backup integration
- [ ] Mod profile presets
- [ ] Performance optimization

## 🐛 Known Issues

See the [issue tracker](https://github.com/Rounak77382/Project_ModManager_Rivals/issues) for known bugs and feature requests.

## 📄 License

No license file is currently present. This project is "all rights reserved" by default. Please open an issue to discuss licensing before contributing or reusing code.

Consider adding an SPDX-compatible `LICENSE` file (MIT, Apache 2.0, GPL, etc.).

## 🙏 Acknowledgments

Built with amazing open-source tools:

- [Tauri](https://tauri.app/) - Lightweight desktop runtime
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) - Fast frontend tooling
- [Radix UI](https://www.radix-ui.com/) - Accessible component primitives
- [NexusMods](https://www.nexusmods.com/) - Modding community platform
- [repak-rivals](https://github.com/natimerry/repak-rivals) - PAK extraction tools

---

<div align="center">

Made with ❤️ for the Marvel Rivals modding community

**[⬆ back to top](#-rivalnxt)**

</div>
