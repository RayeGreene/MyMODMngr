from __future__ import annotations

import os
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Optional


def _default_data_dir() -> Path:
	"""
	Determine the default data directory with platform-specific logic.
	
	Uses platform-specific app data directory (NOT temp directory):
	   - Windows: %APPDATA%/com.rounak77382.modmanager
	   - macOS: ~/Library/Application Support/com.rounak77382.modmanager
	   - Linux: ~/.local/share/com.rounak77382.modmanager
	
	Falls back to ~/.com.rounak77382.modmanager if platform detection fails.
	
	Returns:
		Path: The resolved data directory
	"""
	import platform
	
	system = platform.system()
	
	# Platform-specific paths (matching Tauri's data directory structure)
	if system == "Windows":
		# Windows: Use %APPDATA% (Roaming)
		appdata = os.environ.get("APPDATA")
		if appdata:
			appdata_path = Path(appdata) / "com.rounak77382.modmanager"
		else:
			appdata_path = Path.home() / "AppData" / "Roaming" / "com.rounak77382.modmanager"
	elif system == "Darwin":
		# macOS: Use ~/Library/Application Support
		appdata_path = Path.home() / "Library" / "Application Support" / "com.rounak77382.modmanager"
	else:
		# Linux/Unix: Use XDG_DATA_HOME or ~/.local/share
		xdg_data = os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))
		appdata_path = Path(xdg_data) / "com.rounak77382.modmanager"
	
	# Create the directory if it doesn't exist
	try:
		appdata_path.mkdir(parents=True, exist_ok=True)
	except Exception:
		# Fallback to home directory
		appdata_path = Path.home() / ".com.rounak77382.modmanager"
		try:
			appdata_path.mkdir(parents=True, exist_ok=True)
		except Exception:
			pass
	
	return appdata_path


@dataclass(frozen=True)
class AppSettings:

	backend_host: str = "127.0.0.1"
	backend_port: int = 8000
	data_dir: Path = _default_data_dir()
	marvel_rivals_root: Optional[Path] = None
	marvel_rivals_local_downloads_root: Optional[Path] = None
	nexus_api_key: str = "PhrRky7c5F7tKmdgPfr4Pgysj8FnViJxJuVPrAMnpvuPpZqS/g==--9S1Pqt+a/SVjJfsW--kbc5zktMJuy/y2HxgLtVHw=="
	aes_key_hex: str = "0x0C263D8C22DCB085894899C3A3796383E9BF9DE0CBFB08C9BF2DEF2E84F29D74"
	allow_direct_api_downloads: bool = False
	repak_bin: Optional[Path] = None
	retoc_cli: Optional[Path] = None
	seven_zip_bin: Optional[Path] = None



# Path to settings file in data_dir
def _settings_file_path(data_dir: Path = None) -> Path:
	if data_dir is None:
		data_dir = _default_data_dir()
	return data_dir / "settings.json"

def _normalize_path(value: Optional[str | Path]) -> Optional[Path]:
	if value is None or value == "":
		return None
	if isinstance(value, Path):
		return value.expanduser().resolve()
	return Path(value).expanduser().resolve()

def save_settings(settings: AppSettings) -> None:
	import json
	path = _settings_file_path(settings.data_dir)
	try:
		# Ensure the directory exists
		path.parent.mkdir(parents=True, exist_ok=True)
		data = {
			"backend_host": settings.backend_host,
			"backend_port": settings.backend_port,
			"data_dir": str(settings.data_dir),
			"marvel_rivals_root": str(settings.marvel_rivals_root) if settings.marvel_rivals_root else None,
			"marvel_rivals_local_downloads_root": str(settings.marvel_rivals_local_downloads_root) if settings.marvel_rivals_local_downloads_root else None,
			"nexus_api_key": settings.nexus_api_key,
			"aes_key_hex": settings.aes_key_hex,
			"allow_direct_api_downloads": settings.allow_direct_api_downloads,
			"repak_bin": str(settings.repak_bin) if settings.repak_bin else None,
			"retoc_cli": str(settings.retoc_cli) if settings.retoc_cli else None,
			"seven_zip_bin": str(settings.seven_zip_bin) if settings.seven_zip_bin else None,
		}
		with open(path, "w", encoding="utf-8") as f:
			json.dump(data, f, indent=2)
		print(f"[Settings] Saved settings to {path}")
		print(f"[Settings] marvel_rivals_root: {data.get('marvel_rivals_root')}")
		print(f"[Settings] marvel_rivals_local_downloads_root: {data.get('marvel_rivals_local_downloads_root')}")
	except Exception as e:
		print(f"[Settings] ERROR saving settings: {e}")
		import traceback
		traceback.print_exc()

def load_settings() -> AppSettings:
	import json
	path = _settings_file_path()
	if not path.exists():
		print(f"[Settings] No settings file at {path}, using defaults")
		return AppSettings()
	try:
		with open(path, "r", encoding="utf-8") as f:
			data = json.load(f)
		print(f"[Settings] Loaded settings from {path}")
		print(f"[Settings] marvel_rivals_root: {data.get('marvel_rivals_root')}")
		print(f"[Settings] marvel_rivals_local_downloads_root: {data.get('marvel_rivals_local_downloads_root')}")
		# Use default AppSettings values for missing keys
		defaults = AppSettings()
		return AppSettings(
			backend_host=data.get("backend_host", defaults.backend_host),
			backend_port=data.get("backend_port", defaults.backend_port),
			data_dir=_normalize_path(data.get("data_dir")) or defaults.data_dir,
			marvel_rivals_root=_normalize_path(data.get("marvel_rivals_root")),
			marvel_rivals_local_downloads_root=_normalize_path(data.get("marvel_rivals_local_downloads_root")),
			nexus_api_key=data.get("nexus_api_key", defaults.nexus_api_key),
			aes_key_hex=data.get("aes_key_hex", defaults.aes_key_hex),
			allow_direct_api_downloads=bool(data.get("allow_direct_api_downloads", defaults.allow_direct_api_downloads)),
			repak_bin=_normalize_path(data.get("repak_bin")),
			retoc_cli=_normalize_path(data.get("retoc_cli")),
			seven_zip_bin=_normalize_path(data.get("seven_zip_bin")),
		)
	except Exception as e:
		print(f"[Settings] ERROR loading settings: {e}")
		import traceback
		traceback.print_exc()
		return AppSettings()

# Load settings from disk on startup
SETTINGS = load_settings()


def configure(**overrides: object) -> AppSettings:
	print(f"[Settings] configure() called with overrides: {list(overrides.keys())}")
	normalized: dict[str, object] = {}
	path_keys = {
		"data_dir",
		"marvel_rivals_root",
		"marvel_rivals_local_downloads_root",
		"repak_bin",
		"retoc_cli",
		"seven_zip_bin",
	}
	for key, value in overrides.items():
		if key in path_keys:
			normalized[key] = _normalize_path(value) if value is not None else None
		else:
			normalized[key] = value
	global SETTINGS
	SETTINGS = replace(SETTINGS, **normalized)
	target = SETTINGS.data_dir
	try:
		Path(target).mkdir(parents=True, exist_ok=True)
	except Exception:
		pass
	print(f"[Settings] Updated SETTINGS object:")
	print(f"[Settings]   marvel_rivals_root: {SETTINGS.marvel_rivals_root}")
	print(f"[Settings]   marvel_rivals_local_downloads_root: {SETTINGS.marvel_rivals_local_downloads_root}")
	save_settings(SETTINGS)
	return SETTINGS
