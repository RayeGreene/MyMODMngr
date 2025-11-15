from __future__ import annotations

import re
from pathlib import Path
from typing import Optional, Tuple

__all__ = ["parse_mod_filename", "parse_mod_filename_to_row"]


def parse_mod_filename(filename: str) -> Tuple[str, Optional[int], str]:
    
	base = Path(filename or "").stem
	if not base:
		return "", None, ""
	
	# Split by "-" and filter empty tokens
	tokens = [token for token in base.split("-") if token]
	
	# Need at least 2 tokens to potentially have mod_id-version pattern
	if len(tokens) < 2:
		return base, None, ""
	
	# Find the first numeric token that could be a mod_id
	mod_id_index = -1
	mod_id_val = None
	
	for i in range(1, len(tokens)):
		token = tokens[i]
		# Must be purely numeric
		if not token.isdigit():
			continue
		
		# Check for placeholder ID (7 or more digits starting with 9999999)
		if token.startswith("9999999") and len(token) >= 7:
			continue
		
		# Convert to int to validate
		try:
			mod_id_val = int(token)
			mod_id_index = i
			break
		except ValueError:
			continue
	
	# No valid mod_id found
	if mod_id_index == -1:
		return base, None, ""
	
	# All tokens before mod_id become the name (joined with "-")
	name_tokens = tokens[:mod_id_index]
	name = "-".join(name_tokens) if name_tokens else tokens[0]
	
	# All remaining tokens after mod_id should be numeric for version
	version_tokens = tokens[mod_id_index + 1:]
	if version_tokens and all(token.isdigit() for token in version_tokens):
		version = ".".join(version_tokens)
	else:
		version = ""
	
	return name, mod_id_val, version


def parse_mod_filename_to_row(filename: str) -> tuple[str, str, str]:
	"""Compatibility helper returning ``(name, mod_id_string, version)``."""
	name, mod_id_val, version = parse_mod_filename(filename)
	return name, str(mod_id_val) if mod_id_val is not None else "", version
