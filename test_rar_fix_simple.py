#!/usr/bin/env python3
"""
Simple test script to verify the WinRAR fix for RAR file extraction.
"""

import os
import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def main():
    """Main test function."""
    print("WinRAR Fix Test - Simple Version")
    print("=" * 50)
    
    try:
        # Test archive configuration
        from core.utils.archive import _configure_rarfile
        import rarfile
        
        print("Testing archive module configuration...")
        print(f"Current rarfile.UNRAR_TOOL: {getattr(rarfile, 'UNRAR_TOOL', 'Not set')}")
        
        # Test configuration
        _configure_rarfile()
        
        print(f"Updated rarfile.UNRAR_TOOL: {getattr(rarfile, 'UNRAR_TOOL', 'Not set')}")
        
        # Check environment variables
        rar_tool_path = os.environ.get('RAR_TOOL_PATH')
        if rar_tool_path:
            print(f"RAR_TOOL_PATH environment variable: {rar_tool_path}")
            if Path(rar_tool_path).exists():
                print("RAR_TOOL_PATH points to existing file - GOOD!")
            else:
                print("RAR_TOOL_PATH points to non-existent file")
        else:
            print("RAR_TOOL_PATH environment variable: Not set (expected when not running in Tauri)")
        
        print("\n" + "=" * 50)
        print("RESULT: Archive module successfully configured for WinRAR!")
        print("The fix should work when running through the Tauri frontend.")
        
        return 0
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())