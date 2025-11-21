import os
import sys
from PyInstaller.utils.hooks import collect_data_files

# DEBUG: Print current working directory and list files to verify environment
print(f"DEBUG: CWD is {os.getcwd()}")
try:
    print(f"DEBUG: Files in CWD: {os.listdir(os.getcwd())}")
except Exception as e:
    print(f"DEBUG: Could not list files: {e}")

datas = []
datas += collect_data_files('core.db.migrations')


a = Analysis(
    ['src-python\\run_server.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=[],
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
