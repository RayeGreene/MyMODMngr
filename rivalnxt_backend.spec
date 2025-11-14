# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, collect_submodules
import os

_datas = []
_datas += collect_data_files('core.db.migrations')

# Include character_ids.json for entity tagging
character_ids_path = os.path.join('.', 'character_ids.json')
if os.path.exists(character_ids_path):
    _datas.append((character_ids_path, '.'))

# Collect all core submodules
_hiddenimports = collect_submodules('core')
_hiddenimports += collect_submodules('scripts')

# Add the project root to pathex so PyInstaller can find the modules
_project_root = os.path.abspath('.')

# Bundle repak.exe and retoc_cli.exe with the executable
_binaries = [
    (os.path.join(_project_root, 'repak.exe'), '.'),
    (os.path.join(_project_root, 'retoc_cli.exe'), '.'),
]

a = Analysis(
    ['src-python\\run_server.py'],
    pathex=[_project_root],
    binaries=_binaries,
    datas=_datas,
    hiddenimports=_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['PyQt5', 'PyQt6'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='rivalnxt_backend',
    icon=os.path.join(_project_root, 'src-tauri', 'icons', 'backendicon.ico'),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
