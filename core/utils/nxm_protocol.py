"""Cross-platform NXM protocol registration utilities."""
from __future__ import annotations

import os
import platform
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Optional

def get_tauri_executable() -> Optional[Path]:
    """Get the path to the current Tauri executable.
    
    In production builds, this will be the .exe in AppData/Local or wherever installed.
    In development, we'll detect the dev executable path.
    
    CRITICAL: This is called by the Python backend running INSIDE the Tauri app,
    so we need to detect the parent Tauri process executable.
    """
    if platform.system() != "Windows":
        return None
    
    # Method 1: Check if TAURI_APP_PATH env var is set (we'll set this from Tauri)
    tauri_path = os.environ.get("TAURI_APP_PATH")
    if tauri_path:
        exe_path = Path(tauri_path)
        if exe_path.exists():
            return exe_path
    
    # Method 2: Find parent process (Tauri .exe that launched this Python backend)
    try:
        import psutil
        current_process = psutil.Process()
        parent = current_process.parent()
        
        if parent and parent.name().lower().endswith('.exe'):
            parent_exe = Path(parent.exe())
            # Verify it looks like our Tauri app
            if parent_exe.exists() and any(token in parent_exe.stem.lower() for token in ('rival', 'mod')):
                return parent_exe
    except (ImportError, Exception):
        pass  # psutil not available or error
    
    # Method 3: Look for common Tauri installation paths
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    if local_app_data.exists():
        # Look for the app in Programs directory
        possible_paths = [
            local_app_data / "Programs" / "RivalNxt" / "RivalNxt.exe",
            local_app_data / "Programs" / "project-modmanager-rivals" / "project-modmanager-rivals.exe",
            local_app_data / "Programs" / "mod-manager" / "Mod Manager.exe",
            local_app_data / "mod-manager" / "Mod Manager.exe",
        ]
        for path in possible_paths:
            if path.exists():
                return path
    
    # Method 4: Check if running from src-tauri/target (dev build)
    # The Python backend is in src-python/, Tauri exe is in src-tauri/target/debug/ or release/
    try:
        backend_dir = Path(__file__).parent.parent  # Go up to project root
        for build_type in ['debug', 'release']:
            dev_exe = backend_dir / 'src-tauri' / 'target' / build_type / 'rivalnxt.exe'
            if dev_exe.exists():
                return dev_exe
    except:
        pass
    
    return None


def is_nxm_registered_windows() -> bool:
    """Check if nxm:// protocol is registered in Windows registry."""
    if platform.system() != "Windows":
        return False
    
    try:
        import winreg
        key_path = r"Software\Classes\nxm\shell\open\command"
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ) as key:
            value, _ = winreg.QueryValueEx(key, "")
            # Check if the value exists and is non-empty
            return bool(value and value.strip())
    except (OSError, ImportError):
        return False


def register_nxm_windows(tauri_exe_path: Path) -> Dict[str, Any]:
    """Register nxm:// protocol to launch Tauri app on Windows.
    
    Args:
        tauri_exe_path: Full path to the Tauri .exe file
        
    Returns:
        Dict with 'ok' status and optional 'error' message
    """
    if platform.system() != "Windows":
        return {"ok": False, "error": "Not on Windows"}
    
    if not tauri_exe_path.exists():
        return {"ok": False, "error": f"Tauri executable not found at {tauri_exe_path}"}
    
    try:
        import winreg
        
        # Normalize path for registry (backslashes, quoted)
        exe_str = str(tauri_exe_path.resolve()).replace("/", "\\")
        
        # Create nxm protocol key
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\nxm") as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:nxm Protocol")
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")
        
        # Set default icon
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\nxm\DefaultIcon") as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'"{exe_str}",0')
        
        # Set command to launch Tauri app with nxm:// argument
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\nxm\shell\open\command") as key:
            # Pass %1 (the nxm:// URL) as argument to Tauri app
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, f'"{exe_str}" "%1"')
        
        return {"ok": True, "message": "NXM protocol registered successfully"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def unregister_nxm_windows() -> Dict[str, Any]:
    """Unregister nxm:// protocol from Windows registry.
    
    Returns:
        Dict with 'ok' status and optional 'error' message
    """
    if platform.system() != "Windows":
        return {"ok": False, "error": "Not on Windows"}
    
    try:
        import winreg
        
        # Delete the entire nxm key tree
        def delete_key_recursive(root, path):
            try:
                with winreg.OpenKey(root, path, 0, winreg.KEY_READ) as key:
                    # Enumerate and delete all subkeys first
                    subkeys = []
                    i = 0
                    while True:
                        try:
                            subkeys.append(winreg.EnumKey(key, i))
                            i += 1
                        except OSError:
                            break
                    
                    for subkey in subkeys:
                        delete_key_recursive(root, f"{path}\\{subkey}")
                
                # Now delete the key itself
                winreg.DeleteKey(root, path)
            except OSError:
                pass  # Key doesn't exist or can't be deleted
        
        delete_key_recursive(winreg.HKEY_CURRENT_USER, r"Software\Classes\nxm")
        return {"ok": True, "message": "NXM protocol unregistered successfully"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_nxm_status() -> Dict[str, Any]:
    """Get the current NXM protocol registration status.
    
    Returns:
        Dict with 'registered' boolean and 'tauri_path' if detected
    """
    system = platform.system()
    
    if system == "Windows":
        registered = is_nxm_registered_windows()
        tauri_path = get_tauri_executable()
        
        # Get the currently registered path
        registered_path = None
        if registered:
            try:
                import winreg
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Classes\nxm\shell\open\command", 0, winreg.KEY_READ) as key:
                    value, _ = winreg.QueryValueEx(key, "")
                    # Extract path from command (remove quotes and %1)
                    if value:
                        registered_path = value.split('"')[1] if '"' in value else value.split()[0]
            except:
                pass
        
        return {
            "registered": registered,
            "tauri_path": str(tauri_path) if tauri_path else None,
            "registered_path": registered_path,
            "system": system
        }
    else:
        # macOS/Linux support can be added later
        return {
            "registered": False,
            "error": f"NXM protocol registration not yet supported on {system}",
            "system": system
        }
