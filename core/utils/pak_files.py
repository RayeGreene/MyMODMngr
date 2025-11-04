from __future__ import annotations

import os
from typing import Iterable, List

__all__ = ["collapse_pak_bundle"]


def collapse_pak_bundle(contents: Iterable[str]) -> List[str]:
    """Collapse Unreal pak/utoc/ucas triples to a single .pak entry per logical bundle.

    `contents` may contain repeated names or alternate extensions for the same base pak.
    The function preserves order for the first occurrence of each base name, replacing any
    `.utoc` or `.ucas` variants with the corresponding `.pak` filename. Non-UE entries are
    kept as-is with duplicates removed while keeping the original spelling of the first
    encounter.
    """

    filtered: List[str] = []
    seen_pak_bases: set[str] = set()
    seen_passthrough: set[str] = set()

    for raw in contents:
        if not isinstance(raw, str):
            continue
        name = raw.strip()
        if not name:
            continue
        stem, ext = os.path.splitext(name)
        ext_lower = ext.lower()
        if ext_lower in {".pak", ".utoc", ".ucas"}:
            base_key = stem.lower()
            if base_key in seen_pak_bases:
                continue
            seen_pak_bases.add(base_key)
            filtered.append(f"{stem}.pak")
            continue
        if name in seen_passthrough:
            continue
        seen_passthrough.add(name)
        filtered.append(name)

    return filtered
