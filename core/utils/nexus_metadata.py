from __future__ import annotations

from typing import Any, Dict, List

__all__ = ["derive_changelogs_from_files", "extract_description_text"]


def derive_changelogs_from_files(files_payload: Any) -> Dict[str, Any]:
	"""Create a minimal ``{"changelogs": [...]}`` payload from a files listing."""
	if not files_payload:
		return {}
	if isinstance(files_payload, dict):
		file_list = files_payload.get("files") or []
	elif isinstance(files_payload, list):
		file_list = files_payload
	else:
		return {}
	items: List[Dict[str, Any]] = []
	for f in file_list:
		if not isinstance(f, dict):
			continue
		version = f.get("mod_version") or f.get("version") or f.get("file_version") or ""
		if not version:
			continue
		text = (
			f.get("changelog")
			or f.get("changelog_html")
			or f.get("content")
			or f.get("description")
			or ""
		)
		uploaded_at = f.get("uploaded_time") or f.get("uploaded_at") or f.get("uploaded_timestamp")
		items.append({"mod_version": version, "changelog": text, "uploaded_time": uploaded_at})
	if not items:
		return {}
	return {"changelogs": items}


def extract_description_text(description_payload: Any) -> str:
	"""Best-effort string extractor for aggregated description payloads."""
	if isinstance(description_payload, dict):
		text = description_payload.get("description") or description_payload.get("content")
		if isinstance(text, str):
			return text
		body = description_payload.get("body")
		if isinstance(body, dict):
			text = body.get("description") or body.get("content")
			if isinstance(text, str):
				return text
	return ""
