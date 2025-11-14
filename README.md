# RivalNxt — Marvel Rivals Mod Manager

One desktop app to manage, activate, and validate Marvel Rivals mods with
conflict detection, NexusMods NXM integration, and a fast local database.

## Badges

[![Windows](https://img.shields.io/badge/platform-Windows-blue?logo=windows)](#quickstart)
[![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![Tauri](https://img.shields.io/badge/Built%20with-Tauri-24C8DB?logo=tauri&logoColor=black)](https://tauri.app)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)

## Features

- Seamless mod activation/deactivation with per-mod and bulk actions.
- Automatic conflict detection and tag rebuilding for .pak assets.
- Optional NexusMods API integration and NXM protocol handling for one‑click
  downloads (with graceful fallback to manual/local workflows).
- Local, portable SQLite database with health checks and inspection utilities.
- Desktop app (Tauri 2 + React/Vite) with a FastAPI/Python backend sidecar.
- Scriptable CLI utilities for ingest, sync, diagnostics, and maintenance.

## Quickstart

### For end users (no development setup)

1. Go to the **[Releases](https://github.com/Rounak77382/Project_ModManager_Rivals/releases)** page.
2. Download the latest installer:
   `RivalNxt_0.1.0_x64-setup.exe` (or newer version).
3. Run the installer and launch the app.
4. Open the app's Settings and fill the required paths: set the Marvel Rivals game
   folder (`marvel_rivals_root`) and the local downloads folder
   (`marvel_rivals_local_downloads_root`). These fields are required for the app
   to locate game files and manage mods correctly. Enter your Nexus API key in
   Settings if you want one‑click NXM downloads (optional).
5. That's it—no Node, Rust, or Python required for normal use.

That’s it—no Node, Rust, or Python required for normal use.

## For Developers

#### 🏗️ Architecture Overview

RivalNxt implements a three-tier architecture designed for both performance and developer experience:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Desktop      │    │    Backend      │
│   (React/Vite)  │◄──►│  (Tauri Shell)  │◄──►│ (FastAPI/Py)    │
│   Web UI        │    │  Desktop App    │    │  REST API       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │   Database      │
                                               │ (SQLite + ORM)  │
                                               └─────────────────┘
```

**Component Interaction:**
- **Frontend**: React-based web interface providing the user experience
- **Tauri Desktop Shell**: Native desktop wrapper handling file system access and system integration
- **FastAPI Backend**: RESTful API server managing mod operations, database queries, and NexusMods integration
- **SQLite Database**: Local data persistence with optimized queries and conflict detection views

**Key Technologies:**
- **Frontend**: React 18, Vite 6, Radix UI components, Tailwind CSS
- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLAlchemy
- **Desktop**: Tauri 2.0 (Rust), native Windows support
- **Database**: SQLite with optimized views and materialized tables

#### Development Environment Setup

**Prerequisites:**
- **Windows 10/11** (desktop target) — web/backend development also works on macOS/Linux
- **Node.js 18+** and **Yarn** (or npm) for frontend development
- **Rust toolchain** (Tauri 2) → install via [rustup](https://rustup.rs/)
- **Python 3.10+** for backend and automation scripts
- **Git** for version control

**Optional Dependencies:**
- NexusMods account + API key for testing NXM flows
- Visual Studio 2022 Build Tools (for Rust compilation on Windows)

#### Step-by-Step Development Setup

**1. Clone and Install Frontend Dependencies:**
```powershell
# Using Yarn (preferred since yarn.lock is present)
yarn install

# Or using npm
npm install
```

**2. Setup Python Virtual Environment and Backend:**
```powershell
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1    # Windows PowerShell
# OR for Command Prompt: .venv\Scripts\activate.bat

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Optional: Install file upload support
pip install python-multipart
```

**3. Development Server Setup:**

**Option A: Web Development (Recommended for UI/Frontend work)**
```powershell
# Terminal 1: Start backend API server
python src-python/run_server.py   # Backend runs on 127.0.0.1:8000

# Terminal 2: Start frontend development server
yarn dev                          # Frontend runs on http://localhost:3000
```

**Option B: Desktop Development (Full stack)**
```powershell
# Starts both frontend and backend in Tauri development mode
yarn desktop:dev
```

**4. Production Build Commands:**
```powershell
# Frontend-only production build
yarn build            # Creates optimized web bundle in build/

# Full desktop application build (includes Python sidecar)
yarn desktop:build    # Complete desktop application bundle
```

#### 🛠️ Development Workflow

**Code Organization Standards:**
- **Python Backend**: Follow PEP 8 with type hints; use SQLAlchemy ORM patterns
- **React Frontend**: Use TypeScript strictly; follow React hooks patterns
- **Rust Desktop**: Follow standard Rust conventions; use `tauri-plugin-*` ecosystem
- **Database**: All schema changes via migrations in `core/db/migrations/`

**Key Development Commands:**
```powershell
# Database operations
python -X utf8 -m scripts.inspect_db              # View database schema and contents
python -X utf8 -m scripts.rebuild_sqlite          # Full database rebuild

# Testing mod operations
python -X utf8 -m scripts.ingest_download_assets  # Import local mod files
python -X utf8 -m scripts.sync_nexus_to_db        # Sync Nexus metadata

# Conflict detection
python -X utf8 -m scripts.report_missing_tags     # Check for missing mod metadata
```

**Debug Endpoints:**
- **API Documentation**: http://127.0.0.1:8000/docs (when backend running)
- **Database Health**: GET http://127.0.0.1:8000/health
- **Settings Validation**: GET http://127.0.0.1:8000/api/settings

#### 🔧 Development Tools and IDE Setup

**Recommended VS Code Extensions:**
- **Python**: ms-python.python (with Pylance)
- **TypeScript/JavaScript**: ms-vscode.vscode-typescript-next
- **Rust**: rust-lang.rust-analyzer
- **Tailwind CSS**: bradlc.vscode-tailwindcss

**VS Code Workspace Settings:**
```json
{
  "python.defaultInterpreterPath": "./.venv/Scripts/python.exe",
  "python.terminal.activateEnvironment": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "rust-analyzer.cargo.features": ["custom-protocol"]
}
```

#### 📊 API Documentation and Testing

**Automatic API Documentation:**
- **Swagger UI**: http://127.0.0.1:8000/docs
- **ReDoc**: http://127.0.0.1:8000/redoc
- **OpenAPI Schema**: http://127.0.0.1:8000/openapi.json

**Key API Endpoints for Testing:**
```bash
# Health and status
GET /health
GET /api/bootstrap/status

# Mod operations
GET /api/mods/{mod_id}
POST /api/mods/add
POST /api/mods/{mod_id}/update

# Conflict detection
GET /api/conflicts/active
POST /api/refresh/conflicts

# Settings and configuration
GET /api/settings
PUT /api/settings
```

## Usage examples

CLI utilities live in `scripts/`. Prefix with `python -X utf8 -m` for consistent
UTF‑8 handling on Windows. A few useful commands:

```powershell
# Ingest local download assets and rebuild tags
python -X utf8 -m scripts.ingest_download_assets --rebuild-tags

# Sync Nexus metadata to the local DB (requires API key for full features)
python -X utf8 -m scripts.sync_nexus_to_db

# Activate all .pak mods for a given download id
python -X utf8 -m scripts.activate_mods --download-id 1 --all

# Activate/deactivate by display name
python -X utf8 -m scripts.activate_mods --name "Example Name" --all
python -X utf8 -m scripts.deactivate_mods --name "Example Name"

# Quick database overview and health
python -X utf8 -m scripts.inspect_db
python -X utf8 -m scripts.report_missing_tags --fix
```

For more, see the pre-wired VS Code tasks (Terminal → Run Task) or browse
[`scripts/`](./scripts/).

## Configuration

The app stores persistent settings at a platform‑specific data dir (Windows:
`%APPDATA%/com.rivalnxt.modmanager/settings.json`). You can manage settings
in‑app or via environment variables before starting the backend:

- `MODMANAGER_DATA_DIR` or `MM_DATA_DIR` — override the data directory.
- `MM_BACKEND_HOST` — bind host (default `127.0.0.1`).
- `MM_BACKEND_PORT` — bind port (default `8000`).
- `NEXUS_API_KEY` — optional NexusMods API key for NXM/metadata features.
- `AES_KEY_HEX` — AES key used for asset tasks (default provided in code).
- `MARVEL_RIVALS_ROOT` — game install root (for asset discovery).
- `MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT` — folder with downloaded mods.
- `ALLOW_DIRECT_API_DOWNLOADS` — enable direct Nexus API downloads (bool).
- `REPAK_BIN`, `RETOC_CLI`, `SEVEN_ZIP_BIN` — tool paths if not on `PATH`.

Never commit secrets. A local `.env` file is supported for development; redact
values before sharing. See [Nexus API key guide](./NEXUS_API_KEY_USAGE.md).

Backend entry and flags:

```powershell
python src-python/run_server.py --help
# --data-dir <path>  Override data dir
# --host <addr>      Bind address (default 127.0.0.1)
# --port <num>       Bind port (default 8000)
# --log-level <lvl>  DEBUG|INFO|WARNING|ERROR|CRITICAL (default INFO)
```

## 🏗️ Detailed Project Structure

```
📁 core/                    # Backend domain - Python modules organized by responsibility
├── 📁 api/                 # REST API layer - FastAPI endpoints and services
│   ├── server.py           # Main API server with 50+ endpoints
│   └── services/           # Business logic services
├── 📁 config/              # Configuration management
│   └── settings.py         # Environment variables and persistent settings
├── 📁 db/                  # Database layer with migrations and queries
│   ├── db.py               # SQLite connection management
│   ├── queries.py          # Complex database queries and views
│   └── migrations/         # SQL migrations for schema evolution
├── 📁 ingestion/           # File scanning and mod discovery
│   ├── scan_mod_downloads.py # Local download directory scanning
│   └── scan_active_mods.py  # Active mod detection in game directory
├── 📁 nexus/               # NexusMods API integration
│   ├── nexus_api.py        # API client for mod metadata
│   └── nxm.py             # NXM protocol handling
└── 📁 utils/               # Shared utilities and helpers

📁 scripts/                 # CLI automation tools - Python scripts for maintenance
├── ingest_download_assets.py    # Import local mod files into database
├── activate_mods.py             # Activate/deactivate mods via command line
├── sync_nexus_to_db.py          # Sync Nexus metadata locally
├── rebuild_sqlite.py            # Complete database rebuild utility
└── [25+ maintenance scripts]    # Various diagnostic and repair tools

📁 src/                    # Frontend - React/TypeScript web application
├── 📁 components/         # React components organized by feature
│   ├── ui/               # Reusable UI components (Radix UI + custom)
│   ├── ModCard.tsx       # Individual mod display component
│   ├── DownloadsPage.tsx # Download management interface
│   └── [20+ feature components]
├── 📁 lib/               # Frontend utilities and API client
│   ├── api.ts           # TypeScript API client
│   ├── nxmWorkflow.ts   # NXM protocol workflow management
│   └── [utility modules]
└── 📁 styles/           # CSS and styling assets

📁 src-python/            # Backend entry points
└── run_server.py         # FastAPI server startup with Uvicorn

📁 src-tauri/             # Desktop application shell (Rust + Tauri)
├── Cargo.toml            # Rust dependencies and build configuration
├── tauri.conf.json       # Tauri application configuration
└── src/main.rs           # Desktop app initialization and window management

🔧 Development Tools
├── package.json          # Node.js dependencies and npm scripts
├── requirements.txt      # Python backend dependencies
├── rivalnxt_backend.spec # PyInstaller configuration
└── [build and configuration files]
```

### Component Interaction Overview

**Frontend (React/Vite)**
- Located in `src/` with TypeScript support
- Uses Radix UI components for consistent design system
- Communicates with backend via REST API defined in `src/lib/api.ts`
- Responsive design with Tailwind CSS

**Desktop Shell (Tauri)**
- Rust-based wrapper around web frontend
- Handles native file system operations
- Manages application lifecycle and window management
- Configured in `src-tauri/tauri.conf.json`

**Backend API (FastAPI)**
- Python 3.10+ with FastAPI framework
- RESTful endpoints for all mod operations
- Located in `core/api/server.py` with modular service layer
- Automatic API documentation at `/docs` when running

**Database Layer**
- SQLite database with optimized views and materialized tables
- Migrations managed through `core/db/migrations/`
- Complex conflict detection queries in `core/db/queries.py`

**CLI Tools**
- 25+ Python scripts in `scripts/` directory
- Automation for maintenance tasks, database operations, and mod management
- Consistent UTF-8 handling with `python -X utf8 -m scripts.<name>`


## 🤝 Contributing to RivalNxt

We welcome contributions from developers of all skill levels! This project follows modern development practices with comprehensive testing, documentation, and code quality standards.

### 🎯 Contribution Guidelines

**Before Starting:**
1. Check [open issues](https://github.com/Rounak77382/Project_ModManager_Rivals/issues) for existing discussions
2. Look for ["good first issue"](https://github.com/Rounak77382/Project_ModManager_Rivals/labels/good%20first%20issue) labels for beginner-friendly tasks
3. For significant changes, open an issue first to discuss scope and design
4. Join our discussions for architectural decisions and feature planning

### 🛡️ Security and Performance Guidelines

**Security Practices:**
- Never commit API keys, passwords, or sensitive configuration
- Validate all user inputs and API parameters
- Use parameterized queries to prevent SQL injection
- Implement proper CORS and authentication for sensitive endpoints

**Performance Standards:**
- Database queries should use proper indexing and optimization
- Frontend components should implement React.memo for expensive renders
- Large file operations should use streaming/chunking
- API endpoints should implement pagination for large datasets

---

**Questions?** Open a [discussion](https://github.com/Rounak77382/Project_ModManager_Rivals/discussions) or ask in issues. We're here to help!

## License

No license file is present yet. That means the project is "all rights
reserved" by default. If you intend to contribute or reuse code, please open an
issue to clarify licensing, and consider adding a SPDX‑compatible `LICENSE`.

## Acknowledgments

- [Tauri](https://tauri.app/) for the lightweight desktop runtime.
- [Vite](https://vitejs.dev/) and React for fast frontend DX.
- [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)
  for the backend.
- [Radix UI](https://www.radix-ui.com/) components used in the UI.
- NexusMods for powering the broader modding ecosystem.
- `repak.exe` and `retoc_cli.exe` are taken from
  [natimerry/repak-rivals](https://github.com/natimerry/repak-rivals).

---

### Why this project?

Generic mod managers aren’t tailored to Marvel Rivals’ asset structure or
workflows. This project focuses on that game: ingesting `.pak` assets,
rebuilding tags, detecting conflicts, and optionally integrating NexusMods NXM
flows—while keeping everything scriptable for power users.

<!-- TODO
Next steps to strengthen this README:
- Add LICENSE, CONTRIBUTING, and CODE_OF_CONDUCT documents.
- Publish CI workflows for build and lint; add build badge.
- Add unit test coverage workflow and badge.
- Add a minimal Python requirements file for backend dev.
-->
