from __future__ import annotations

"""
Report local downloads that still have NULL tags and optionally fix them.

This script inspects the SQLite view v_local_downloads_with_tags to find
downloads where tags are NULL. For each such download, it diagnoses which
stage is missing:

- NO_PAKS: mod_paks has no rows for this download
- ASSETS_MISSING: pak_assets has no rows for the download's paks
- ASSET_TAGS_MISSING: some asset paths have no entries in asset_tags
- PAK_TAGS_MISSING: pak_tags_json has no rows for the download's paks

With --fix, it will re-run ingestion and rebuild tags for the affected
downloads using scripts.ingest_download_assets (with --only) and then
scripts.build_asset_tags and scripts.build_pak_tags.
"""

import argparse
import logging
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import sys

# Ensure project root on sys.path for direct execution
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.db.db import get_connection, init_schema, run_migrations


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Report downloads with NULL tags and optionally fix them.")
    p.add_argument("--db", dest="db_path", default=None, help="Path to mods.db (optional)")
    p.add_argument("--limit", type=int, default=None, help="Limit number of rows to inspect")
    p.add_argument("--fix", action="store_true", help="Attempt to fix by re-ingesting and rebuilding tags")
    p.add_argument(
        "--log-level",
        dest="log_level",
        default="INFO",
        choices=["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"],
    )
    return p.parse_args(argv)


def _fetch_missing_downloads(conn, limit: Optional[int]) -> List[Tuple[int, str, str]]:
    cur = conn.cursor()
    q = (
        "SELECT download_id, download_name, local_path "
        "FROM v_local_downloads_with_tags WHERE tags_json IS NULL ORDER BY download_id"
    )
    if limit and limit > 0:
        q += " LIMIT ?"
        rows = cur.execute(q, (limit,)).fetchall()
    else:
        rows = cur.execute(q).fetchall()
    return rows


def _diagnose_download(conn, download_id: int) -> Dict[str, object]:
    cur = conn.cursor()
    # paks associated with this download (by FK)
    paks = [r[0] for r in cur.execute(
        "SELECT pak_name FROM mod_paks WHERE local_download_id = ?", (download_id,)
    ).fetchall()]
    if not paks:
        return {
            "stage": "NO_PAKS",
            "paks": [],
            "assets": 0,
            "asset_tags_missing": None,
            "pak_tags": 0,
        }
    # assets present for those paks
    placeholders = ",".join(["?"] * len(paks))
    assets_count = (
        conn.execute(
            f"SELECT COUNT(*) FROM pak_assets WHERE pak_name IN ({placeholders})",
            tuple(paks),
        ).fetchone()[0]
        or 0
    )
    if assets_count == 0:
        return {
            "stage": "ASSETS_MISSING",
            "paks": paks,
            "assets": 0,
            "asset_tags_missing": None,
            "pak_tags": 0,
        }
    # how many assets are missing tags
    asset_tags_missing = (
        conn.execute(
            f"""
            SELECT COUNT(*)
            FROM pak_assets pa
            LEFT JOIN asset_tags at ON at.asset_path = pa.asset_path
            WHERE pa.pak_name IN ({placeholders})
              AND at.asset_path IS NULL
            """,
            tuple(paks),
        ).fetchone()[0]
        or 0
    )
    if asset_tags_missing > 0:
        return {
            "stage": "ASSET_TAGS_MISSING",
            "paks": paks,
            "assets": assets_count,
            "asset_tags_missing": asset_tags_missing,
            "pak_tags": 0,
        }
    # pak tags
    pak_tags_count = (
        conn.execute(
            f"SELECT COUNT(*) FROM pak_tags_json WHERE pak_name IN ({placeholders})",
            tuple(paks),
        ).fetchone()[0]
        or 0
    )
    if pak_tags_count == 0:
        return {
            "stage": "PAK_TAGS_MISSING",
            "paks": paks,
            "assets": assets_count,
            "asset_tags_missing": 0,
            "pak_tags": 0,
        }
    # All pieces seem present; view mismatch likely name/extension edge
    return {
        "stage": "VIEW_MISMATCH",
        "paks": paks,
        "assets": assets_count,
        "asset_tags_missing": 0,
        "pak_tags": pak_tags_count,
    }


def _fix_downloads(conn, names: List[str], log_level: str) -> None:
    """Re-ingest only the specified download names and rebuild tags."""
    # Import here to avoid heavy deps when only reporting
    from scripts import ingest_download_assets as ingest  # type: ignore
    from scripts import build_asset_tags as bat  # type: ignore
    from scripts import build_pak_tags as bpt  # type: ignore

    args: List[str] = []
    for n in names:
        args.extend(["--only", n])
    # Pass log level through; rely on env for downloads root
    args.extend(["--log-level", log_level, "--rebuild-tags"])
    ingest.main(args)
    # Safety rebuild in case only tags were missing
    bat.main(["--log-level", log_level])
    bpt.main(["--log-level", log_level])


def main(argv=None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [report_missing_tags] %(message)s",
    )
    log = logging.getLogger("report_missing_tags")
    conn = get_connection(args.db_path)
    init_schema(conn)
    run_migrations(conn)

    rows = _fetch_missing_downloads(conn, args.limit)
    if not rows:
        log.info("All downloads have tags. Nothing to report.")
        return 0

    log.info("Found %d download(s) with NULL tags", len(rows))
    to_fix_names: List[str] = []
    for download_id, name, local_path in rows:
        diag = _diagnose_download(conn, download_id)
        stage = diag["stage"]
        assets = diag["assets"]
        missing = diag["asset_tags_missing"]
        pak_tags = diag["pak_tags"]
        log.info(
            "#%s name='%s' path='%s' stage=%s assets=%s asset_tags_missing=%s pak_tags=%s",
            download_id,
            name,
            local_path,
            stage,
            assets,
            missing,
            pak_tags,
        )
        if args.fix:
            # For any stage, re-ingest this name to be safe
            to_fix_names.append(name)

    if args.fix and to_fix_names:
        uniq = sorted(set(to_fix_names))
        log.info("Attempting to fix %d download(s): %s", len(uniq), ", ".join(uniq[:5]) + ("..." if len(uniq) > 5 else ""))
        _fix_downloads(conn, uniq, args.log_level)
        log.info("Fix attempt complete.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
