#!/usr/bin/env python3
"""
Test script to verify the updated tag logic.
This tests various asset paths to ensure empty strings are returned 
when no meaningful tags can be generated.
"""

from pathlib import Path
import sys

# Add parent directory to path so we can import tag_assets
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.tag_assets import tag_asset, load_entity_map

def test_tag_logic():
    # Load entity map (if available)
    entity_map = load_entity_map("character_ids.json")
    
    # Test cases: (asset_path, expected_behavior_description)
    test_cases = [
        # Cases that should return meaningful tags (not empty)
        ("/Game/Characters/HeroKnight/meshes/sk_heroknight.skeletalmesh", "Should return character mesh tag"),
        ("/Game/UI/HUD/healthbar.uasset", "Should return UI tag"),
        ("/Game/Audio/sfx/laser.wav", "Should return audio tag"),
        ("/Game/Materials/m_concrete.uasset", "Should return material tag"),
        
        # Cases that should now return empty strings (previously might have returned "ui")
        ("/Game/random_folder/asset.uasset", "Should return empty - no meaningful categorization"),
        ("/Game/content/assets/data.dat", "Should return empty - data folder with unknown entity"),
        ("/Game/Props/prop_001.staticmesh", "Should return empty - generic prop without entity"),
        ("/Game/Test/folder/config.json", "Should return empty - config file without meaningful category"),
        ("/Game/New/Path/asset.bundle", "Should return empty - unknown asset type"),
        
        # Edge cases
        ("", "Should return empty - empty input"),
        ("/Game", "Should return empty - minimal path"),
        ("/Game/Content/Assets/Unknown/Asset.something", "Should return empty - unknown file type"),
        
        # Cases that should generate entity-only tags (should now be empty)
        ("/Game/Characters/HeroKnight/asset.uasset", "Should return empty - entity without category"),
    ]
    
    print("Testing updated tag logic...")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for asset_path, description in test_cases:
        result = tag_asset(asset_path, entity_map)
        
        # Determine if this is a success based on the test case
        is_good_result = result != ""  # Non-empty results are generally good
        if "empty" in description.lower():
            is_good_result = result == ""  # Empty results are expected
        
        status = "[PASS]" if is_good_result else "[FAIL]"
        
        print(f"{status} | {description}")
        print(f"       Path: {asset_path}")
        print(f"       Result: '{result}'")
        print()
        
        if is_good_result:
            passed += 1
        else:
            failed += 1
    
    print("=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("All tests passed! The tag logic is working correctly.")
    else:
        print("Some tests failed. Review the tag logic.")
    
    return failed == 0

if __name__ == "__main__":
    test_tag_logic()