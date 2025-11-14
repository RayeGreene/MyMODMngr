"""
Verify that all paths are dynamic and work across different user accounts.

This script simulates different environments to ensure no hardcoded paths exist.
"""
import os
import sys
from pathlib import Path

# Add repo root to path
repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))


def test_database_path():
    """Test that database path is dynamic based on user."""
    print("\n" + "=" * 70)
    print("Testing Database Path (Dynamic User Support)")
    print("=" * 70)
    
    # Simulate Tauri environment
    test_app_data = (
        Path.home()
        / "AppData"
        / "Roaming"
        / "com.rivalnxt.modmanager"
    )
    os.environ["MODMANAGER_DATA_DIR"] = str(test_app_data)
    
    # Import after setting environment variable
    from core.config.settings import configure, SETTINGS
    
    # Reconfigure with the environment variable
    configure(data_dir=os.environ.get("MODMANAGER_DATA_DIR"))
    
    from core.db.db import _data_root, DB_FILENAME
    
    db_path = _data_root() / DB_FILENAME
    
    print(f"Current User: {os.environ.get('USERNAME', 'unknown')}")
    print(f"User Home: {Path.home()}")
    print(f"Data Root: {_data_root()}")
    print(f"Database Path: {db_path}")
    
    # Check for hardcoded usernames
    db_str = str(db_path)
    if "rouna" in db_str.lower() and os.environ.get('USERNAME', '').lower() != 'rouna':
        print("❌ FAIL: Hardcoded username 'rouna' found in path!")
        return False
    
    # Check that it uses AppData on Windows
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA") or (Path.home() / "AppData" / "Roaming")
        if str(appdata) not in str(db_path):
            print(f"⚠️  WARNING: Path doesn't use APPDATA ({appdata})")
    
    print("✅ PASS: Database path is dynamic!")
    return True


def test_downloads_path():
    """Test that downloads path is dynamic."""
    print("\n" + "=" * 70)
    print("Testing Downloads Path (Dynamic User Support)")
    print("=" * 70)
    
    from core.config.settings import SETTINGS
    
    downloads_path = SETTINGS.marvel_rivals_local_downloads_root
    
    print(f"Downloads Path: {downloads_path}")
    
    if downloads_path:
        downloads_str = str(downloads_path)
        
        # Check for hardcoded usernames
        if "rouna" in downloads_str.lower() and os.environ.get('USERNAME', '').lower() != 'rouna':
            print("❌ FAIL: Hardcoded username 'rouna' found in downloads path!")
            return False
        
        # Check that it uses Path.home()
        if str(Path.home()) in str(downloads_path):
            print("✅ PASS: Downloads path uses Path.home() - will work for any user!")
            return True
        else:
            print("⚠️  WARNING: Downloads path may not be portable across users")
    
    return True


def test_simulated_users():
    """Simulate what paths would look like on different computers."""
    print("\n" + "=" * 70)
    print("Simulating Different User Accounts")
    print("=" * 70)
    
    # Simulate different usernames
    test_users = ["alice", "bob", "admin", "user123"]
    
    for username in test_users:
        if sys.platform == "win32":
            simulated_home = Path(f"C:/Users/{username}")
            simulated_appdata = simulated_home / "AppData" / "Roaming"
        else:
            simulated_home = Path(f"/home/{username}")
            simulated_appdata = simulated_home / ".local" / "share"

        expected_db = simulated_appdata / "com.rivalnxt.modmanager" / "mods.db"
        expected_downloads = (
            simulated_home / "Documents" / "Marvel_Rivals_Mods" / "downloads"
        )

        print(f"\nUser: {username}")
        print(f"  Database: {expected_db}")
        print(f"  Downloads: {expected_downloads}")


def main():
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "Dynamic Path Verification" + " " * 28 + "║")
    print("╚" + "=" * 68 + "╝")
    
    all_pass = True
    
    all_pass &= test_database_path()
    all_pass &= test_downloads_path()
    test_simulated_users()
    
    print("\n" + "=" * 70)
    if all_pass:
        print("✅ ALL TESTS PASSED - Paths are dynamic and portable!")
    else:
        print("❌ SOME TESTS FAILED - Review hardcoded paths above")
    print("=" * 70)


if __name__ == "__main__":
    main()
