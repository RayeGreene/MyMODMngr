#!/usr/bin/env python3
"""Exercise the Nexus download-link flow using a captured nxm URI.

The script parses an nxm link (from stdin, a file, or the latest handler log),
invokes the same helper used by the backend to resolve Nexus CDN candidates,
and optionally downloads the archive using the new key/expires workflow.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import Iterable, Optional

from fastapi import HTTPException

from core.api.server import _download_archive_via_nxm, _resolve_nexus_download_candidates
from core.nexus.nxm import NXMParseError, parse_nxm_uri

DEFAULT_LAST_URI_PATH = Path(__file__).resolve().parent / "nxm_last_uri.txt"


def _load_nxm_source(source: Optional[str]) -> str:
	"""Return an nxm URI from a direct string or a file path."""
	if source:
		candidate_path = Path(source)
		if candidate_path.exists():
			for line in candidate_path.read_text(encoding="utf-8").splitlines():
				stripped = line.strip()
				if stripped:
					return stripped
			raise FileNotFoundError(f"No nxm URI found in {candidate_path}")
		return source.strip()
	if DEFAULT_LAST_URI_PATH.exists():
		for line in DEFAULT_LAST_URI_PATH.read_text(encoding="utf-8").splitlines():
			stripped = line.strip()
			if stripped:
				return stripped
	raise FileNotFoundError(
		"Provide an nxm URI or place one in scripts/nxm_last_uri.txt via the protocol handler"
	)


def _mask_token(token: Optional[str]) -> str:
	if not token:
		return ""
	value = str(token)
	if len(value) <= 8:
		return "*" * len(value)
	return f"{value[:4]}...{value[-4:]}"


def _build_demo_record(nxm_uri: str) -> dict:
	parsed = parse_nxm_uri(nxm_uri)
	record = {
		"id": f"demo-{int(time.time())}",
		"created_at": time.time(),
		"request": {
			"raw": parsed.raw,
			"game": parsed.game_domain,
			"mod_id": parsed.mod_id,
			"file_id": parsed.file_id,
			"query": dict(parsed.query),
		},
		"metadata": {
			"mod_id": parsed.mod_id,
			"key": parsed.query.get("key"),
			"expires": parsed.query.get("expires"),
			"user_id": parsed.query.get("user_id"),
		},
	}
	return record


def _emit_candidates(candidates: Iterable[tuple[str, Optional[str]]]) -> None:
	for idx, (url, label) in enumerate(candidates, start=1):
		display_label = label or ""
		print(json.dumps({"idx": idx, "label": display_label, "url": url}, indent=2))


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(description="Resolve Nexus CDN download URLs from an nxm URI")
	parser.add_argument(
		"source",
		nargs="?",
		help="nxm URI literal or path to a file containing one (defaults to scripts/nxm_last_uri.txt)",
	)
	parser.add_argument(
		"--download",
		action="store_true",
		help="attempt to download using the resolved CDN links",
	)
	parser.add_argument(
		"--verbose",
		action="store_true",
		help="enable verbose logging",
	)
	args = parser.parse_args(argv)

	logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="[%(levelname)s] %(message)s")

	try:
		nxm_uri = _load_nxm_source(args.source)
	except Exception as exc:
		print(f"Failed to load nxm URI: {exc}", file=sys.stderr)
		return 2

	try:
		record = _build_demo_record(nxm_uri)
	except NXMParseError as exc:
		print(f"Invalid nxm URI: {exc}", file=sys.stderr)
		return 2

	request = record["request"]
	query = dict(request.get("query") or {})
	game = request.get("game") or ""
	file_id = request.get("file_id")
	if not isinstance(file_id, int):
		print("Resolved record is missing a numeric file_id", file=sys.stderr)
		return 2
	print(
		json.dumps(
			{
				"nxm": request.get("raw"),
				"game": request.get("game"),
				"mod_id": request.get("mod_id"),
				"file_id": request.get("file_id"),
				"key": _mask_token(query.get("key")),
				"expires": query.get("expires"),
				"user_id": query.get("user_id"),
			},
			indent=2,
		)
	)

	try:
		candidates = _resolve_nexus_download_candidates(record, game, file_id)
	except HTTPException as exc:
		detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail)
		print(f"Failed to resolve download candidates ({exc.status_code}): {detail}", file=sys.stderr)
		return 1

	print("Resolved Nexus CDN candidates:")
	_emit_candidates(candidates)

	if not args.download:
		return 0

	try:
		path, url = _download_archive_via_nxm(record, game, file_id)
	except HTTPException as exc:
		detail = exc.detail if isinstance(exc.detail, str) else json.dumps(exc.detail)
		print(f"Download failed ({exc.status_code}): {detail}", file=sys.stderr)
		return 1

	print(
		json.dumps(
			{
				"downloaded_path": str(path),
				"source_url": url,
			},
			indent=2,
		)
	)
	return 0


if __name__ == "__main__":
	sys.exit(main())
