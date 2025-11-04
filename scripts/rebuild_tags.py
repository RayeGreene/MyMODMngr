from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Rebuild all tag artifacts (asset_tags, pak_tags_json, and dependent views)."
    )
    p.add_argument("--db", dest="db_path", default=None, help="Path to mods.db (optional)")
    p.add_argument("--map", dest="map_path", default=None, help="Optional path to character_ids.json for tagging")
    p.add_argument(
        "--log-level",
        dest="log_level",
        default="INFO",
        choices=["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"],
    )
    return p.parse_args(argv)


def _assemble_args(base: list[str], db_path: Optional[str], log_level: str, extra: Optional[list[str]] = None) -> list[str]:
    args = ["--log-level", log_level]
    if db_path:
        args.extend(["--db", db_path])
    args.extend(base)
    if extra:
        args.extend(extra)
    return args


def main(argv=None) -> int:
    args = parse_args(argv)

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [rebuild_tags] %(message)s",
    )
    log = logging.getLogger("rebuild_tags")

    root = Path(__file__).resolve().parents[1]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from scripts import build_asset_tags as bat  # type: ignore
    from scripts import build_pak_tags as bpt  # type: ignore
    from core.db.db import get_connection, init_schema, run_migrations

    log.info("Rebuilding asset_tags using map=%s", args.map_path or "<default>")
    bat_rc = bat.main(
        _assemble_args(["--rebuild"], args.db_path, args.log_level, ["--map", args.map_path] if args.map_path else None)
    )
    if bat_rc != 0:
        log.error("build_asset_tags exited with status %s", bat_rc)
        return bat_rc

    log.info("Rebuilding pak_tags_json ...")
    bpt_rc = bpt.main(_assemble_args(["--rebuild"], args.db_path, args.log_level))
    if bpt_rc != 0:
        log.error("build_pak_tags exited with status %s", bpt_rc)
        return bpt_rc

    conn = get_connection(args.db_path)
    try:
        init_schema(conn)
        run_migrations(conn)
        cur = conn.cursor()
        asset_count = cur.execute("SELECT COUNT(*) FROM asset_tags").fetchone()[0]
        pak_count = cur.execute("SELECT COUNT(*) FROM pak_tags_json").fetchone()[0]
        view_count = cur.execute("SELECT COUNT(*) FROM v_local_downloads_with_tags").fetchone()[0]
        log.info("asset_tags rows: %s", asset_count)
        log.info("pak_tags_json rows: %s", pak_count)
        log.info("v_local_downloads_with_tags rows: %s", view_count)
    finally:
        try:
            conn.close()
        except Exception:
            pass

    log.info("Tag rebuild complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
