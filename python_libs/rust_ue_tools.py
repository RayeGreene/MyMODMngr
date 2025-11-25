# Python wrapper for rust-ue-tools library 
# This module provides access to the Rust implementation of UE file operations 
 
import os 
import sys 
import platform 
from pathlib import Path 
 
# Add current directory to path so we can import the shared library 
current_dir = Path(__file__).parent 
sys.path.insert(0, str(current_dir)) 
 
# Try to load the shared library 
_lib = None 
_lib_name = None 
 
system = platform.system() 
if system == "Windows": 
    # REM Try debug version first, then release 
    for lib_name in ["rust_ue_tools.dll", "rust_ue_tools_release.dll"]: 
        try: 
            _lib = __import__(lib_name.rsplit(".", 1)[0]) 
            _lib_name = lib_name 
            break 
        except (ImportError, OSError): 
            continue 
else:  # Linux and macOS 
    # REM Handle other platforms similarly 
    pass 
 
if _lib is None: 
    print(f"Warning: Could not load rust-ue-tools library") 
    print("Falling back to external tools (repak.exe, retoc_cli.exe)") 
else: 
    print(f"✅ Loaded rust-ue-tools from {_lib_name}") 
 
# Import the functions from the Rust library 
try: 
    extract_asset_paths_from_zip_py = getattr(_lib, 'extract_asset_paths_from_zip_py') 
    extract_pak_asset_map_from_folder_py = getattr(_lib, 'extract_pak_asset_map_from_folder_py') 
    free_c_string = getattr(_lib, 'free_c_string') 
except AttributeError as e: 
    print(f"Warning: Could not import required functions: {e}") 
    extract_asset_paths_from_zip_py = None 
    extract_pak_asset_map_from_folder_py = None 
    free_c_string = None 
 
__all__ = [ 
    'extract_asset_paths_from_zip_py', 
    'extract_pak_asset_map_from_folder_py', 
    'free_c_string' 
] 
# Python wrapper for rust-ue-tools library 
# This module provides access to the Rust implementation of UE file operations 
 
import os 
import sys 
import platform 
from pathlib import Path 
 
# Add current directory to path so we can import the shared library 
current_dir = Path(__file__).parent 
sys.path.insert(0, str(current_dir)) 
 
# Try to load the shared library 
_lib = None 
_lib_name = None 
 
system = platform.system() 
if system == "Windows": 
    # REM Try debug version first, then release 
    for lib_name in ["rust_ue_tools.dll", "rust_ue_tools_release.dll"]: 
        try: 
            _lib = __import__(lib_name.rsplit(".", 1)[0]) 
            _lib_name = lib_name 
            break 
        except (ImportError, OSError): 
            continue 
else:  # Linux and macOS 
    # REM Handle other platforms similarly 
    pass 
 
if _lib is None: 
    print(f"Warning: Could not load rust-ue-tools library") 
    print("Falling back to external tools (repak.exe, retoc_cli.exe)") 
else: 
    print(f"✅ Loaded rust-ue-tools from {_lib_name}") 
 
# Import the functions from the Rust library 
try: 
    extract_asset_paths_from_zip_py = getattr(_lib, 'extract_asset_paths_from_zip_py') 
    extract_pak_asset_map_from_folder_py = getattr(_lib, 'extract_pak_asset_map_from_folder_py') 
    free_c_string = getattr(_lib, 'free_c_string') 
except AttributeError as e: 
    print(f"Warning: Could not import required functions: {e}") 
    extract_asset_paths_from_zip_py = None 
    extract_pak_asset_map_from_folder_py = None 
    free_c_string = None 
 
__all__ = [ 
    'extract_asset_paths_from_zip_py', 
    'extract_pak_asset_map_from_folder_py', 
    'free_c_string' 
] 
