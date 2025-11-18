# Moved from project root to core/assets
from __future__ import annotations
import json, os, shutil, subprocess, sys, tempfile, zipfile
from pathlib import Path
from typing import List, Optional

from core.config.settings import SETTINGS

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = REPO_ROOT / "src"
if SRC_DIR.exists():
    sys.path.insert(0, str(SRC_DIR))

__all__ = [
    "extract_uasset_paths_from_zip",
    "extract_pak_asset_map_from_folder",
]

EXTENSIONS_TO_PRINT = {".uasset", ".umap", ".bnk", ".json", ".wem", ".fbx", ".obj", ".glb", ".gltf", ".ini", ".wav", ".mp3", ".ogg", ".uplugin", ".usf"}

def _find_repak_binary(explicit: Optional[str] = None) -> str:
    if explicit:
        p = Path(explicit)
        if p.is_file():
            return str(p)
        raise FileNotFoundError(f"repak binary not found at: {explicit}")
    if SETTINGS.repak_bin:
        p = SETTINGS.repak_bin
        if p.is_file():
            return str(p)
    exe = "repak.exe" if os.name == "nt" else "repak"
    
    # Check if running as PyInstaller bundle (bundled executable)
    if getattr(sys, 'frozen', False):
        # PyInstaller extracts bundled files to sys._MEIPASS
        bundle_dir = Path(sys._MEIPASS)
        bundled_exe = bundle_dir / exe
        if bundled_exe.exists():
            return str(bundled_exe)
    
    # Check if running as Tauri bundle (sidecars in the same directory as the executable)
    try:
        tauri_path = Path(sys.executable).parent
        tauri_sidecar = tauri_path / exe
        if tauri_sidecar.exists():
            return str(tauri_sidecar)
    except Exception:
        pass
    
    found = shutil.which(exe)
    if found:
        return found
    # Fallback to repo root
    local = REPO_ROOT / exe
    if local.exists():
        return str(local)
    raise FileNotFoundError("Could not find repak binary. Ensure it's on PATH or place repak.exe in repo root, or pass repak_bin.")

def _find_retoc_binary(explicit: Optional[str] = None) -> Optional[str]:
    """Find retoc_cli binary. Returns None if not found (retoc is optional)."""
    if explicit:
        p = Path(explicit)
        if p.is_file():
            return str(p)
        return None
    if SETTINGS.retoc_cli:
        p = SETTINGS.retoc_cli
        if p.is_file():
            return str(p)
    exe = "retoc_cli.exe" if os.name == "nt" else "retoc_cli"
    
    # Check if running as PyInstaller bundle (bundled executable)
    if getattr(sys, 'frozen', False):
        # PyInstaller extracts bundled files to sys._MEIPASS
        bundle_dir = Path(sys._MEIPASS)
        bundled_exe = bundle_dir / exe
        if bundled_exe.exists():
            return str(bundled_exe)
    
    # Check if running as Tauri bundle (sidecars in the same directory as the executable)
    try:
        tauri_path = Path(sys.executable).parent
        tauri_sidecar = tauri_path / exe
        if tauri_sidecar.exists():
            return str(tauri_sidecar)
    except Exception:
        pass
    
    found = shutil.which(exe)
    if found:
        return found
    # Fallback to repo root
    local = REPO_ROOT / exe
    if local.exists():
        return str(local)
    return None


def _run(cmd: List[str]) -> None:
    proc = subprocess.run(cmd, check=False)
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed ({proc.returncode}): {' '.join(cmd)}")

def _run_capture(cmd: List[str]) -> str:
    proc = subprocess.run(cmd, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            f"Command failed ({proc.returncode}): {' '.join(cmd)}\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
        )
    return proc.stdout

def _to_asset_style_path(p: Path, base_dir: Path) -> str:
    parts = p.parts
    content_idx = next((i for i, part in enumerate(parts) if part.lower() == "content"), None)
    if content_idx is not None and content_idx > 0:
        return Path(*parts[content_idx - 1 :]).as_posix()
    try:
        return p.relative_to(base_dir).as_posix()
    except Exception:
        return p.name

def _ensure_extension_str(path_str: str) -> str:
    try:
        p = Path(path_str)
        if p.suffix:
            return Path(path_str).as_posix()
        return f"{Path(path_str).as_posix()}.uasset"
    except Exception:
        s = path_str.replace("\\", "/")
        return s if "." in Path(s).name else f"{s}.uasset"

def extract_uasset_paths_from_zip(zip_path: str, repak_bin: Optional[str] = None, aes_key: Optional[str] = None, keep_temp: bool = False) -> List[str]:
    repak = _find_repak_binary(repak_bin)
    tmpdir_obj = tempfile.TemporaryDirectory()
    tmpdir = Path(tmpdir_obj.name)
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmpdir)
        pak_files = list(tmpdir.rglob("*.pak"))
        has_utoc = any(tmpdir.rglob("*.utoc"))
        has_ucas_or_utac = any(tmpdir.rglob("*.ucas")) or any(tmpdir.rglob("*.utac"))
        io_store_present = has_utoc and has_ucas_or_utac
        uasset_paths: List[str] = []
        seen = set()
        if pak_files:
            for pak in pak_files:
                out_dir = pak.with_suffix("")
                cmd: List[str] = [repak]
                if aes_key:
                    cmd += ["--aes-key", aes_key]
                cmd += ["unpack", str(pak), "-o", str(out_dir), "-q", "-f"]
                _run(cmd)
                if io_store_present:
                    utoc_candidates = list(tmpdir.rglob("*.utoc"))
                    if utoc_candidates:
                        retoc_cli = _find_retoc_binary()
                        if retoc_cli:
                            for utoc in utoc_candidates:
                                cmd2: List[str] = [retoc_cli]
                                if aes_key:
                                    cmd2 += ["--aes-key", aes_key]
                                cmd2 += ["list", str(utoc), "--json"]
                                try:
                                    out = _run_capture(cmd2)
                                    try:
                                        names = json.loads(out)
                                        if isinstance(names, list):
                                            for n in names:
                                                if isinstance(n, str) and n:
                                                    norm = _ensure_extension_str(n.strip())
                                                    print(norm)
                                                    uasset_paths.append(norm)
                                    except json.JSONDecodeError:
                                        for line in out.splitlines():
                                            line = line.strip()
                                            if line:
                                                norm = _ensure_extension_str(line)
                                                print(norm)
                                                uasset_paths.append(norm)
                                except Exception as e:
                                    print(f"Warning: retoc_cli failed: {e}")
                        else:
                            chunknames_files = list(out_dir.rglob("chunknames"))
                            for chunk_file in chunknames_files:
                                try:
                                    with open(chunk_file, "r", encoding="utf-8", errors="ignore") as cf:
                                        for line in cf:
                                            line = line.strip()
                                            if line:
                                                norm = _ensure_extension_str(line)
                                                print(norm)
                                                uasset_paths.append(norm)
                                except Exception as e:
                                    print(f"Warning: could not read '{chunk_file}': {e}")
                else:
                    exts_to_include = EXTENSIONS_TO_PRINT
                    for path in out_dir.rglob("*"):
                        if path.is_file() and path.suffix.lower() in exts_to_include:
                            ap = _to_asset_style_path(path, out_dir)
                            print(ap)
                            if ap not in seen:
                                seen.add(ap)
                                uasset_paths.append(ap)
        else:
            for path in tmpdir.rglob("*"):
                if path.is_file() and path.suffix.lower() in EXTENSIONS_TO_PRINT:
                    ap = _to_asset_style_path(path, tmpdir)
                    if ap not in seen:
                        seen.add(ap)
                        uasset_paths.append(ap)
        if keep_temp:
            print(tmpdir)
        if pak_files and io_store_present:
            for pak in pak_files:
                out_dir = pak.with_suffix("")
                for path in out_dir.rglob("*"):
                    if path.is_file() and path.suffix.lower() in EXTENSIONS_TO_PRINT:
                        ap = _to_asset_style_path(path, out_dir)
                        print(ap)
                        if ap not in seen:
                            seen.add(ap)
                            uasset_paths.append(ap)
        return uasset_paths
    finally:
        if not keep_temp:
            tmpdir_obj.cleanup()

def extract_pak_asset_map_from_folder(folder_path: str, repak_bin: Optional[str] = None, aes_key: Optional[str] = None) -> dict[str, List[str]]:
    """Return mapping of pak_name -> asset paths for content already extracted to a folder.

    This scans for classic .pak files and IoStore (.utoc + .ucas/.utac) files within the folder tree
    and enumerates contained assets, supporting both formats in a single pass.
    """
    base = Path(folder_path)
    if not base.exists() or not base.is_dir():
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    repak = _find_repak_binary(repak_bin)
    result: dict[str, List[str]] = {}

    # Classic .pak: unpack with repak then walk files
    pak_files = list(base.rglob("*.pak"))
    for pak in pak_files:
        out_dir = pak.with_suffix("")
        cmd: List[str] = [repak]
        if aes_key:
            cmd += ["--aes-key", aes_key]
        cmd += ["unpack", str(pak), "-o", str(out_dir), "-q", "-f"]
        _run(cmd)
        exts_to_include = EXTENSIONS_TO_PRINT
        assets: List[str] = []
        seen: set[str] = set()
        for path in out_dir.rglob("*"):
            if path.is_file() and path.suffix.lower() in exts_to_include:
                ap = _to_asset_style_path(path, out_dir)
                if ap not in seen:
                    seen.add(ap)
                    assets.append(ap)
        result[pak.name] = assets

    # IoStore: list via retoc_cli or chunknames
    utoc_files = list(base.rglob("*.utoc"))
    if utoc_files:
        retoc_cli = _find_retoc_binary()
        if not retoc_cli:
            # Fallback removed - _find_retoc_binary already checks all locations
            pass
        for utoc in utoc_files:
            pak_name = utoc.name
            assets: List[str] = []
            if retoc_cli:
                cmd2: List[str] = [retoc_cli]
                if aes_key:
                    cmd2 += ["--aes-key", aes_key]
                cmd2 += ["list", str(utoc), "--json"]
                try:
                    out = _run_capture(cmd2)
                    try:
                        names = json.loads(out)
                        if isinstance(names, list):
                            for n in names:
                                if isinstance(n, str) and n:
                                    assets.append(_ensure_extension_str(n.strip()))
                    except json.JSONDecodeError:
                        for line in out.splitlines():
                            line = line.strip()
                            if line:
                                assets.append(_ensure_extension_str(line))
                except Exception as e:
                    print(f"Warning: retoc_cli failed for {utoc.name}: {e}")
            if not assets:
                # fallback: search extracted directories for chunknames near utoc
                chunknames_files = list(utoc.parent.rglob("chunknames"))
                for chunk_file in chunknames_files:
                    try:
                        with open(chunk_file, "r", encoding="utf-8", errors="ignore") as cf:
                            for line in cf:
                                line = line.strip()
                                if line:
                                    assets.append(_ensure_extension_str(line))
                    except Exception as e:
                        print(f"Warning: could not read '{chunk_file}': {e}")
            # Also attempt local directory walk (post-unpack) if a same-named directory exists
            unpack_dir = utoc.with_suffix("")
            if unpack_dir.is_dir():
                exts_to_include = EXTENSIONS_TO_PRINT
                seen_additional = set(assets)
                for path in unpack_dir.rglob("*"):
                    if path.is_file() and path.suffix.lower() in exts_to_include:
                        ap = _to_asset_style_path(path, unpack_dir)
                        if ap not in seen_additional:
                            seen_additional.add(ap)
                            assets.append(ap)
            result[pak_name] = assets

    return result

def main() -> int:
    import sys
    if len(sys.argv) > 1:
        zip_path = sys.argv[1]
    else:
        zip_path = input("Enter path to the UE zip file: ").strip()
    if not zip_path or not os.path.isfile(zip_path):
        print("Zip file not found or not provided")
        return 2
    repak_bin = str(SETTINGS.repak_bin) if SETTINGS.repak_bin else None
    aes_key = SETTINGS.aes_key_hex or None
    try:
        paths = extract_uasset_paths_from_zip(zip_path, repak_bin=repak_bin, aes_key=aes_key)
    except Exception as e:
        print(f"Error: {e}")
        return 1
    for p in paths:
        print(p)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
