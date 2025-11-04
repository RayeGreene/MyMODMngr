# Project Mod Manager Rivals

# Project Mod Manager Rivals

FastAPI + React tooling for managing Marvel Rivals mods locally. The project combines a Python backend that tracks Nexus Mods metadata in SQLite with a Vite/React frontend for browsing, enabling, and ingesting downloads.

---

## Key Features

- Local-first catalog of `.pak` downloads with automatic duplicate detection.
- Nexus Mods API integration for metadata, changelogs, and file manifests.
- NXM handoff flow: accept `nxm://` URIs, cache the decision, then ingest straight into the local library.
- Asset extraction pipeline with optional `repak`/`retoc` helpers for `.pak` contents.
- Configurable activation/deactivation of installed mods with conflict reporting.

---

## Repository Layout

- `core/`
  - `api/` – FastAPI application (`server.py`), shared dependencies (`dependencies.py`), service helpers (`services/`).
  - `assets/` – Utilities for unpacking `.pak` builds and mapping assets.
  - `db/` – SQLite schema definition plus read/write helpers.
  - `ingestion/` – Download scanners and active mod detectors.
  - `nexus/` – Nexus API client, request parsing, and domain helpers.
  - `utils/` – Shared archive, path, and naming utilities.
- `scripts/` – Stand-alone maintenance tasks (importing downloads, syncing API data, rebuilding tags, etc.).
- `src/` – React frontend (Vite) used by the desktop UI; components mirror backend routes.
- `src-python/` – PyInstaller entry point (`run_server.py`) used when bundling the backend as a sidecar.
- `src-tauri/` – Rust workspace powering the desktop shell and bundling configuration.
- `tests/` – Python and frontend tests; `run_all.py` orchestrates backend suites.
- `build/` – Production Vite build artifact (checked in for convenience).
- `backup/` – Older UI snapshots for reference.

Supporting files:

- `field_prefs.py`, `nexus_field_prefs.json`, `character_ids.json` – Domain-specific mappings for metadata normalization.
- `5.3.2-...usmap` – Unreal Engine asset mapping used during extraction.
- `test_api_output.json` – Sample Nexus API payload for offline testing.

---

## Prerequisites

- Python 3.11+
- Node.js 20+ (for the Vite frontend)
- Rust toolchain via `rustup` (needed for the Tauri desktop shell)
- Microsoft C++ Build Tools / Windows 10+ SDK (Tauri Windows requirement)
- WebView2 runtime (install the Evergreen bootstrapper for Windows packaging)
- SQLite (bundled with Python stdlib)
- Optional: `repak` / `retoc_cli` binaries on PATH for deep asset extraction

Python dependencies are managed with `pip`. Frontend dependencies use `yarn` via `package.json`.

---

## Environment Variables

| Variable                  | Purpose                                | Notes                                                             |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| `NEXUS_API_KEY`           | Nexus Mods API token                   | Required for remote metadata sync.                                |
| `REPAK_BIN` / `RETOC_CLI` | Path overrides for asset tools         | Autodetected if binaries live next to the repo.                   |
| `AES_KEY_HEX`             | AES key for decrypting `.pak` archives | Optional; used when provided.                                     |
| `DOWNLOADS_ROOT`          | Fallback path to find local archives   | Used when ingesting by filename.                                  |
| `MM_BACKEND_HOST`         | Host binding for the packaged backend  | Defaults to `127.0.0.1`; set if a different loopback is required. |
| `MM_BACKEND_PORT`         | Port for the packaged backend          | Defaults to `8000`; keep in sync with `VITE_API_BASE_URL`.        |

Create a `.env` file or export variables in PowerShell before running tasks.

---

## Backend Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt  # or pip install -e . when packaging is added
```

Run the FastAPI server locally:

```powershell
uvicorn core.api.server:app --reload
```

The project automatically calls `verify_required_dns_hosts()` at startup to ensure Nexus and CDN endpoints resolve. SQLite files (default `mods.db`) are created on demand.

### Key Modules

- `core/api/server.py` – Defines endpoints for health checks, ingest flows, conflict rebuilds, mod activation, Nexus handoffs, and asset extraction. The file delegates cross-cutting concerns to:
  - `core/api/dependencies.py` – Centralized database connection handling and DNS checks.
  - `core/api/services/handoffs.py` – In-memory tracking for `nxm://` handoffs with TTL pruning.
- `core/db/db.py` – Connection factory, schema bootstrap, migration helpers.
- `core/db/queries.py` – High-level query functions consumed by API handlers and scripts.

---

## Frontend Setup

```powershell
yarn install   # installs frontend deps with Yarn
yarn dev       # starts Vite on http://localhost:3000
```

The frontend expects the backend at `http://localhost:8000`. Adjust `src/config` if you proxy through another port.

Build for production:

```powershell
yarn build
```

Artifacts land in `build/` and are served by Tauri or any static host.

---

## Desktop Shell (Tauri)

The repository now ships with a `src-tauri/` workspace that wraps the Vite frontend in a native WebView (WebView2 on Windows) and launches the FastAPI backend as a bundled sidecar executable.

### Development loop

1. (Optional) Start the Python backend yourself for rapid reloads:

```powershell
uvicorn core.api.server:app --reload --host 127.0.0.1 --port 8000
```

When the sidecar binary is not present, the Tauri shell will silently fall back to this manually started server.

2. In another terminal, run the desktop shell:

```powershell
yarn tauri:dev
```

The command spawns `yarn dev` (Vite on port 3000) before launching the window. Frontend hot reload keeps working while Tauri wraps it inside the desktop frame.

### Building the Python sidecar

1. Activate your virtual environment and install project dependencies, then create a standalone executable:

```powershell
yarn py:build
```

The script runs `python -m PyInstaller --onefile ...` against `src-python/run_server.py` and drops `modmanager_backend.exe` into `src-tauri/sidecars/` ready for bundling.

2. Verify the binary by running it directly (`./src-tauri/sidecars/modmanager_backend.exe`) and hitting `http://127.0.0.1:8000/health`.

### Packaging the desktop app

1. Produce the production frontend build:

yarn build

2. Package the desktop installer (runs Rust + Tauri build tooling):

```powershell
yarn tauri:build
```

Output installers are written to `src-tauri/target/release/bundle/`. On Windows the default target is NSIS (`.exe` installer).

To run the whole pipeline (frontend build + PyInstaller sidecar + bundle) in one go, use:

```powershell
  yarn desktop:build
```

### Additional notes

- `src-tauri/tauri.conf.json` defines the bundle metadata plus a shell plugin scope that whitelists the `modmanager_backend` sidecar.
- Update your icon assets under `src-tauri/icons/` (create the directory) to brand the installer.
- User-specific data (SQLite files, downloaded mods) should live outside the application directory. The sidecar inherits environment variables such as `MM_BACKEND_HOST`/`MM_BACKEND_PORT` from the shell scope.
- Ship the Microsoft WebView2 runtime with your installer or instruct users to install the Evergreen bootstrapper if their system lacks it.

---

## Working with Scripts

All recurring maintenance tasks live in `scripts/` and are exposed as VS Code tasks (see `.vscode/tasks.json`). Common flows:

- `python -m scripts.import_downloads` – Import `downloads_list.json` into SQLite.
- `python -m scripts.sync_nexus_to_db` – Fetch Nexus metadata for known mods.
- `python -m scripts.ingest_download_assets` – Build asset maps for ingested downloads (supports `--extract` and `--rebuild-tags`).
- `python -m scripts.report_missing_tags` – Diagnose downloads lacking asset tags; pass `--fix` to reingest.
- `python -m scripts.activate_mods --name "Example" --all` – Activate specific mod paks.

Use the provided VS Code tasks for one-click execution; they invoke the same entry points with sensible defaults.

---

## Database Schema Overview

The SQLite database (`mods.db`) stitches local downloads to Nexus data:

- `local_downloads` – Local archives with contents JSON, active pak list, ingest path.
- `mods` – Core metadata snapshot per Nexus mod.
- `mod_files` – All published files for a mod (latest version detection uses `make_version_key`).
- `mod_changelogs` – Versioned changelog text per mod.
- `mod_descriptions` – Long-form HTML/markdown descriptions.
- `mod_api_cache` – Raw aggregated API payloads kept for offline replay.

Indices favor lookups by `mod_id` and `(mod_id, file_id)`. Helper functions ensure JSON columns are deserialized safely.

---

## NXM Handoff Lifecycle

1. **Submit** – `/api/nxm/handoff` parses the `nxm://` URL, snapshots metadata, and stores a TTL-bound record.
2. **Preview** – `/api/nxm/handoff/{id}/preview` pulls Nexus metadata, summarizes files, and chooses a default file candidate.
3. **Ingest** – `/api/nxm/handoff/{id}/ingest` downloads the selected file via Nexus redirect, ingests it locally, optionally activates `.pak`s, and marks the handoff consumed.

State lives in-memory (`core/api/services/handoffs.py`) with `NXM_HANDOFF_TTL_SECONDS` controlling expiration. Records are serialized consistently for UI consumption.

---

## Testing & Analysis Harness

This directory collects tooling that helps validate project health across the backend (FastAPI/Python) and frontend (React/TypeScript).

The goal is to give quick signals for:

- **Unused Python functions** that might be legacy or dead code.
- **TypeScript unused exports/locals** reported by the compiler.
- A concise overview of the high-level call flow for backend entrypoints.

You can run everything with a single command from the repository root:

```powershell
python tests/run_all.py
```

Behind the scenes this will:

1. Execute `tests/backend/find_unused.py` to build a lightweight call graph and flag top-level Python functions that are never referenced.
2. Execute `node tests/frontend/findUnusedExports.mjs` which shells out to the TypeScript compiler (`tsc --noEmit`) and aggregates diagnostics related to unused code.

Each tool keeps its output human-readable so you can make informed decisions before deleting anything. None of the scripts mutate project files—they only report findings.

> **Tip:** These checks are a starting point. Always double-check results before removing code that might be used indirectly (for example, FastAPI endpoints referenced through decorators or dynamic imports).

---

## Bootstrap Flow & Data Visibility

**Bootstrap already rebuilds everything** (tags, conflicts, etc.)

**Added WAL checkpoint** to ensure data visibility

**Added comprehensive logging** for debugging

**All tests pass** - data visibility confirmed

### What Was Fixed

- Bootstrap now triggers a full rebuild of all tables: downloads, tags, conflicts, etc.
- WAL checkpoint ensures all readers see the latest data immediately after bootstrap.
- Logging added to all major endpoints and bootstrap routines.

### Quick Test

1. Start the server:
   ```powershell
   python -m uvicorn core.api.server:app --reload
   ```
2. Open browser console and navigate to http://localhost:8000
3. Watch logs for download counts and data refresh.

### Full Bootstrap Test

1. Backup your current database.
2. Delete the database to trigger first-run.
3. Start the server and complete the bootstrap wizard in the UI.
4. Watch for "Finished" banner and immediate data visibility.

### Automated Tests

```powershell
python test_bootstrap_complete.py
```

---

## Troubleshooting & Fixes

### Common Issues & Solutions

- **Upload endpoint returns 503** – Install `python-multipart`.
- **repak/retoc not detected** – Set `REPAK_BIN`/`RETOC_CLI` or place binaries in the repo root.
- **Nexus 401/403 errors** – Verify `NEXUS_API_KEY` scope; the token must allow mod and file reads.
- **Duplicate ingest rejection** – The backend compares normalized contents; review the existing download via `/api/downloads` or deactivate it before retrying.

### Production Build Troubleshooting

If the production app can't find the database or logs, follow these steps:

1. Rebuild the PyInstaller sidecar:
   ```powershell
   .\rebuild_sidecar.ps1
   ```
2. Build the installer:
   ```powershell
   npm run tauri:build
   ```
3. Uninstall old version, install new, and run diagnostic script:
   ```powershell
   .\diagnose_production.ps1
   ```
4. Check `%APPDATA%\com.rounak77382.modmanager\logs\backend.log` for environment diagnostics and database path.

### Root Cause Analysis

If production fails but dev mode works, check the timestamp of the sidecar executable. Always rebuild after backend changes!

---

## Complete Fix Summary

### Issues Fixed

1. Settings not saving – Async dialog, error handling, success toast
2. ModuleNotFoundError in production – Updated PyInstaller spec
3. Database path not working on different computers – Dynamic user paths
4. Downloads folder support – Folders and loose .pak files

### Verification Steps

1. Check backend log for diagnostics
2. Test settings save and persistence
3. Check database existence

---

## Roadmap Ideas

- Persist NXM handoffs to disk to survive restarts.
- Materialize conflict reports for the frontend to consume instantly.
- Integrate with Tauri native APIs for drag-and-drop ingest and notifications.
- Add per-mod scheduling for automatic Nexus sync and changelog diffing.

Contributions are welcome—open issues or PRs with repro steps and expectations.
