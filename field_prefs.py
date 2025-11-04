"""
Nexus API field filtering and preferences.

This module provides utilities to load and apply field preferences
for Nexus API responses, allowing selective retention of API fields.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Set, Optional


def load_prefs(prefs_file: str | Path = "nexus_field_prefs.json") -> Dict[str, Any]:
    """
    Load field preferences from a JSON file.
    
    Args:
        prefs_file: Path to the preferences JSON file
        
    Returns:
        Dictionary of field preferences, or empty dict if file doesn't exist
    """
    prefs_path = Path(prefs_file)
    if not prefs_path.exists():
        # Return empty preferences if file doesn't exist
        return {}
    
    try:
        with open(prefs_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        # Return empty preferences on error
        return {}


def filter_aggregate_payload(
    payload: Dict[str, Any],
    prefs: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Filter an aggregate Nexus API payload based on field preferences.
    
    Args:
        payload: The API response payload to filter
        prefs: Field preferences dictionary (if None, returns payload as-is)
        
    Returns:
        Filtered payload with only preferred fields retained
    """
    if not prefs:
        # No preferences - return payload unmodified
        return payload
    
    # If preferences exist but are empty/disabled, return payload as-is
    if not isinstance(prefs, dict):
        return payload
    
    # Apply filtering based on preferences structure
    # This is a simplified version - customize based on your actual needs
    filtered = {}
    
    for key, value in payload.items():
        # Check if this key should be retained
        if key in prefs:
            pref_value = prefs[key]
            
            # If preference is a boolean True, keep the field
            if pref_value is True:
                filtered[key] = value
            # If preference is a dict, recursively filter nested structure
            elif isinstance(pref_value, dict) and isinstance(value, dict):
                filtered[key] = filter_aggregate_payload(value, pref_value)
            # If preference is a dict but value is a list, filter each item
            elif isinstance(pref_value, dict) and isinstance(value, list):
                filtered[key] = [
                    filter_aggregate_payload(item, pref_value)
                    if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                # Keep the field
                filtered[key] = value
        else:
            # Field not in preferences - could either keep or omit
            # For safety, keep unknown fields
            filtered[key] = value
    
    return filtered


def get_field_set(prefs: Dict[str, Any], prefix: str = "") -> Set[str]:
    """
    Extract a flat set of field paths from nested preferences.
    
    Args:
        prefs: Nested preferences dictionary
        prefix: Path prefix for recursion
        
    Returns:
        Set of dot-separated field paths
    """
    fields = set()
    
    for key, value in prefs.items():
        field_path = f"{prefix}.{key}" if prefix else key
        
        if value is True:
            fields.add(field_path)
        elif isinstance(value, dict):
            # Recursively get nested fields
            fields.update(get_field_set(value, field_path))
    
    return fields
