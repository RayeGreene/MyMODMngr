from __future__ import annotations

import urllib.parse
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class NXMRequest:
	"""Structured representation of an nxm:// download link."""
	raw: str
	game_domain: str
	mod_id: int
	file_id: int
	query: Dict[str, str]

	@property
	def expires(self) -> Optional[str]:
		return self.query.get("expires")

	@property
	def key(self) -> Optional[str]:
		return self.query.get("key")

	@property
	def user_id(self) -> Optional[str]:
		return self.query.get("user_id")


class NXMParseError(ValueError):
	"""Raised when an nxm URI cannot be parsed into the expected shape."""


def parse_nxm_uri(uri: str) -> NXMRequest:
	"""Parse an nxm:// URI into its components.

	Parameters
	----------
	uri:
		The raw nxm URI string supplied by the protocol handler.

	Returns
	-------
	NXMRequest
		Structured data describing the nxm link.

	Raises
	------
	NXMParseError
		If the URI is missing required components or is malformed.
	"""
	if not isinstance(uri, str) or not uri.strip():
		raise NXMParseError("nxm URI must be a non-empty string")

	parsed = urllib.parse.urlparse(uri.strip())
	if parsed.scheme.lower() != "nxm":
		raise NXMParseError("URI scheme must be nxm://")

	domain = (parsed.netloc or "").strip()
	if not domain:
		raise NXMParseError("nxm URI missing game domain host component")

	# Example path: /mods/2732/files/7689
	segments = [segment for segment in parsed.path.split("/") if segment]
	if len(segments) < 4 or segments[0].lower() != "mods" or segments[2].lower() != "files":
		raise NXMParseError("nxm URI path must look like /mods/<mod_id>/files/<file_id>")

	try:
		mod_id = int(segments[1])
	except (TypeError, ValueError):
		raise NXMParseError("nxm URI contains a non-numeric mod id") from None

	try:
		file_id = int(segments[3])
	except (TypeError, ValueError):
		raise NXMParseError("nxm URI contains a non-numeric file id") from None

	query_pairs: Dict[str, str] = {}
	if parsed.query:
		for key, values in urllib.parse.parse_qs(parsed.query, keep_blank_values=True).items():
			if values:
				query_pairs[key] = values[0]

	return NXMRequest(
		raw=uri.strip(),
		game_domain=domain,
		mod_id=mod_id,
		file_id=file_id,
		query=query_pairs,
	)


__all__ = ["NXMRequest", "NXMParseError", "parse_nxm_uri"]
