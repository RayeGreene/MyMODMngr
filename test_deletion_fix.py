#!/usr/bin/env python3
"""
Test script to verify the mod deletion fix.
This script simulates the deletion process and checks if files are properly removed from ~mods folder.
"""

import os
import sys
import sqlite3
import tempfile
from pathlib import Path
from typing import List
import json

# Add the project root to Python path
project_root = Path(__file__).resolve().parents[0]
sys.path.insert(0, str(project_root))

def test_file_removal():
    """Test the file removal functions."""
    print("Testing file removal functions...")
    
    # Create a temporary mods directory with test files
    with tempfile.TemporaryDirectory() as temp_dir:
        mods_dir = Path(temp_dir) / "~mods"
        mods_dir.mkdir()
        
        # Create test files
        test_files = [
            "TestMod1_P.pak",
            "TestMod1_P.utoc", 
            "TestMod1_P.ucas",
            "TestMod2_P.pak",
            "TestMod2_P.utoc",
            "TestMod2_P.ucas"
        ]
        
        for filename in test_files:
            (mods_dir / filename).touch()
        
        print(f"Created test files in {mods_dir}:")
        for f in mods_dir.rglob("*"):
            if f.is_file():
                print(f"  - {f.name}")
        
        # Test the removal functions
        from core.db.db import _remove_in_mods_by_names, _remove_in_mods_by_stems
        
        # Remove by stems (should remove all variants)
        removed_by_stems = _remove_in_mods_by_stems(mods_dir, ["TestMod1_P"])
        print(f"\nRemoved by stems: {removed_by_stems}")
        
        # Remove by names (should remove specific files)
        removed_by_names = _remove_in_mods_by_names(mods_dir, ["TestMod2_P.pak"])
        print(f"Removed by names: {removed_by_names}")
        
        # Check remaining files
        remaining_files = []
        for f in mods_dir.rglob("*"):
            if f.is_file():
                remaining_files.append(f.name)
        
        print(f"\nRemaining files: {remaining_files}")
        
        if remaining_files == ["TestMod2_P.utoc", "TestMod2_P.ucas"]:
            print("✅ File removal test PASSED")
            return True
        else:
            print("❌ File removal test FAILED")
            return False

def test_mods_folder_path():
    """Test getting the mods folder path."""
    print("\nTesting mods folder path function...")
    
    try:
        from core.db.db import _get_mods_folder_for_deletion
        mods_dir = _get_mods_folder_for_deletion()
        print(f"Mods folder path: {mods_dir}")
        print("✅ Mods folder path test PASSED")
        return True
    except Exception as e:
        print(f"❌ Mods folder path test FAILED: {e}")
        return False

if __name__ == "__main__":
    print("Testing the mod deletion fix...")
    print("=" * 50)
    
    tests_passed = 0
    total_tests = 2
    
    if test_file_removal():
        tests_passed += 1
    
    if test_mods_folder_path():
        tests_passed += 1
    
    print("=" * 50)
    print(f"Tests passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print("🎉 All tests PASSED! The deletion fix should work correctly.")
    else:
        print("💥 Some tests FAILED. Please check the implementation.")