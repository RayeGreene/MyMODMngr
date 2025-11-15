#!/usr/bin/env python3

import sys
import os

# Add the core directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'core'))

from utils.mod_filename import parse_mod_filename

def test_parsing():
    test_cases = [
        ("Venom/(VIBE) IF I BACK IT UP - Normal Version-2732-2-0-1743611945.rar", 
         "(VIBE) IF I BACK IT UP - Normal Version", 2732, "2.0.1743611945"),
        ("Spider_man/Alirica x Lazuli's Ghost-Spider Textures-2587-2-0-1747441125.rar", 
         "Alirica x Lazuli's Ghost-Spider Textures", 2587, "2.0.1747441125")
    ]
    
    for filename, expected_name, expected_modid, expected_version in test_cases:
        name, mod_id, version = parse_mod_filename(filename)
        print(f"\nFilename: {filename}")
        print(f"Expected: name='{expected_name}', mod_id={expected_modid}, version='{expected_version}'")
        print(f"Got:      name='{name}', mod_id={mod_id}, version='{version}'")
        print(f"Match: {name == expected_name and mod_id == expected_modid and version == expected_version}")

if __name__ == "__main__":
    test_parsing()