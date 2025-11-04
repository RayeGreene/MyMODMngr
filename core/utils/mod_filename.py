from __future__ import annotations

import re
from pathlib import Path
from typing import Optional, Tuple

__all__ = ["parse_mod_filename", "parse_mod_filename_to_row"]


def parse_mod_filename(filename: str) -> Tuple[str, Optional[int], str]:
	"""Best-effort extraction of ``(name, mod_id, version)`` from a file name.

	The heuristic tolerates a wide range of naming conventions, looking for the
	last 4+ digit chunk as the Nexus mod ID and interpreting any trailing numeric
	segments as the version. If parsing fails, the function returns ``(name, None,
	"")`` so callers can fallback to explicit overrides.
	"""
	base = Path(filename or "").stem
	if not base:
		return "", None, ""
	tokens = re.split(r"[-_\s]+", base)
	tokens = [tok for tok in tokens if tok]
	mod_id_val: Optional[int] = None
	mod_idx: Optional[int] = None
	version_tokens: list[str] = []
	# Primary heuristic: find the first 4+ digit token whose successors are all numeric-ish -> treat as mod id
	for idx, tok in enumerate(tokens):
		if not tok.isdigit():
			continue
		if len(tok) < 4:
			continue
		suffix = tokens[idx + 1 :]
		if not suffix:
			continue
		if all(re.fullmatch(r"\d+", part) for part in suffix):
			mod_idx = idx
			version_tokens = suffix
			break
	# Secondary heuristic: look for any 4+ digit token and treat the remaining numeric tokens as version
	if mod_idx is None:
		for idx, tok in reversed(list(enumerate(tokens))):
			if tok.isdigit() and len(tok) >= 4:
				mod_idx = idx
				suffix = tokens[idx + 1 :]
				version_tokens = [part for part in suffix if part.isdigit()]
				if version_tokens:
					break
				else:
					version_tokens = []
					break
	if mod_idx is not None:
		mod_id_str = tokens[mod_idx]
		try:
			mod_id_val = int(mod_id_str)
		except Exception:
			mod_id_val = None
		name_tokens = tokens[:mod_idx]
	else:
		name_tokens = tokens
		version_tokens = []
	# Normalize version tokens (allowing v-prefixed forms)
	clean_version_tokens: list[str] = []
	for tok in version_tokens:
		if tok.lower().startswith("v") and tok[1:].isdigit():
			clean_version_tokens.append(tok[1:])
		elif tok.isdigit():
			clean_version_tokens.append(tok)
	version = ".".join(clean_version_tokens)
	name_segment = " ".join(name_tokens).strip()
	if not name_segment:
		name_segment = re.sub(r"[-_.]+", " ", base).strip()
	if not name_segment:
		name_segment = base
	return name_segment, mod_id_val, version


def parse_mod_filename_to_row(filename: str) -> tuple[str, str, str]:
	"""Compatibility helper returning ``(name, mod_id_string, version)``."""
	name, mod_id_val, version = parse_mod_filename(filename)
	return name, str(mod_id_val) if mod_id_val is not None else "", version
