from __future__ import annotations
import argparse
import logging
import sqlite3
from typing import Optional, Tuple
from pathlib import Path
import sys

# Reuse tagger from scripts.tag_assets (support both module and script execution)
try:
    from . import tag_assets as tagger  # type: ignore
except Exception:
    # When executed as a plain script, add project root to sys.path and import via absolute package name
    ROOT = Path(__file__).resolve().parents[1]
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from scripts import tag_assets as tagger  # type: ignore

from core.db.db import get_connection, init_schema, run_migrations


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Build or refresh asset_tags from pak_assets.")
    p.add_argument('--db', dest='db_path', default=None, help='Path to mods.db (optional)')
    p.add_argument('--map', dest='map_path', default=None, help='Optional character_ids.json mapping path')
    p.add_argument('--limit', type=int, default=None, help='Optional limit for testing')
    p.add_argument('--rebuild', action='store_true', help='Truncate and rebuild all tags')
    p.add_argument('--log-level', dest='log_level', default='INFO', choices=['CRITICAL','ERROR','WARNING','INFO','DEBUG'])
    return p.parse_args(argv)


def ensure_schema(conn: sqlite3.Connection) -> None:
    # Make sure base schema and migrations are applied (to get asset_tags table)
    init_schema(conn)
    run_migrations(conn)


def split_tag(tag: str) -> Tuple[Optional[str], str]:
    # tag is either 'category' or 'entity,category'
    if ',' in tag:
        ent, cat = tag.split(',', 1)
        return ent.strip() or None, cat.strip()
    return None, tag.strip()


def main(argv=None) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=getattr(logging, args.log_level.upper(), logging.INFO),
                        format='%(asctime)s %(levelname)s [asset_tags] %(message)s')
    log = logging.getLogger('build_asset_tags')
    conn = get_connection(args.db_path)
    ensure_schema(conn)

    entity_map = tagger.load_entity_map(args.map_path)
    cur = conn.cursor()

    if args.rebuild:
        log.info("Truncating asset_tags ...")
        cur.execute("DELETE FROM asset_tags;")
        conn.commit()

    # Select distinct asset paths missing in asset_tags, or all if rebuild.
    if args.rebuild:
        q = "SELECT DISTINCT asset_path FROM pak_assets"
        params = ()
    else:
        q = """
            SELECT DISTINCT pa.asset_path
            FROM pak_assets pa
            LEFT JOIN asset_tags t ON t.asset_path = pa.asset_path
            WHERE t.asset_path IS NULL
        """
        params = ()
    if args.limit:
        q += " LIMIT ?"
        params = (args.limit,)

    rows = cur.execute(q, params).fetchall()
    log.info("Assets to tag: %d", len(rows))
    if not rows:
        log.info("No asset paths to tag.")
        return 0

    to_upsert = []
    skipped = 0
    for (asset_path,) in rows:
        tag = tagger.tag_asset(asset_path, entity_map).strip()
        if not tag:
            skipped += 1
            continue
        entity, category = split_tag(tag)
        entity = entity.strip() if isinstance(entity, str) and entity.strip() else None
        category = category.strip() if isinstance(category, str) and category.strip() else None
        if not category:
            skipped += 1
            continue
        full_tag = f"{entity},{category}" if entity else category
        to_upsert.append((asset_path, entity, category, full_tag))

    cur.executemany(
        """
        INSERT INTO asset_tags(asset_path, entity, category, tag)
        VALUES(?, ?, ?, ?)
        ON CONFLICT(asset_path) DO UPDATE SET
            entity = excluded.entity,
            category = excluded.category,
            tag = excluded.tag
        ;
        """,
        to_upsert,
    )
    conn.commit()
    log.info("Tagged %d asset path(s).", len(to_upsert))
    if skipped:
        log.debug("Skipped %d asset path(s) without resolvable tags.", skipped)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
