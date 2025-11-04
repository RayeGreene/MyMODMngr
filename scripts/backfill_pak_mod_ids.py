from __future__ import annotations
import argparse, sqlite3, sys
from pathlib import Path

# Ensure project root on sys.path when executed directly (so 'core' package resolves)
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.db import get_connection, init_schema

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Backfill mod_id in mod_paks and pak_assets_json where possible by joining local_downloads and mods.")
    p.add_argument('--db', dest='db_path', default=None)
    return p.parse_args(argv)

def backfill(conn: sqlite3.Connection) -> tuple[int, int]:
    """Attempt to set mod_paks.mod_id where NULL using multiple strategies:
    1. Direct local_downloads.path match: mod_paks.source_zip equals local_downloads.path
    2. Trailing filename match: last path component of local_downloads.path equals mod_paks.source_zip
    Only apply if the candidate mod_id exists in mods.
    """
    init_schema(conn)
    cur = conn.cursor()
    # Build lookup of candidate filename -> mod_id from local_downloads rows that have a mod_id
    candidates = {}
    for name, path, mod_id in cur.execute(
        "SELECT name, path, mod_id FROM local_downloads WHERE mod_id IS NOT NULL"
    ).fetchall():
        if mod_id is None:
            continue
        # Direct path (stored path relative with directories)
        if path:
            candidates[path] = mod_id
            tail = path.split('/')[-1].split('\\')[-1]
            candidates.setdefault(tail, mod_id)
        # Also store name as a key (in case source_zip captured that form)
        if name:
            candidates.setdefault(name, mod_id)
    # Filter to those mod_ids that truly exist in mods
    existing_mod_ids = {mid for (mid,) in cur.execute("SELECT mod_id FROM mods").fetchall()}
    # Collect unresolved paks
    unresolved = cur.execute(
        "SELECT pak_name, source_zip FROM mod_paks WHERE mod_id IS NULL"
    ).fetchall()
    updated = 0
    for pak_name, source_zip in unresolved:
        mod_id = None
        if source_zip in candidates:
            mod_id = candidates[source_zip]
        else:
            tail = source_zip.split('/')[-1].split('\\')[-1]
            mod_id = candidates.get(tail)
        if mod_id and mod_id in existing_mod_ids:
            cur.execute("UPDATE mod_paks SET mod_id = ? WHERE pak_name = ?", (mod_id, pak_name))
            cur.execute("UPDATE pak_assets_json SET mod_id = ? WHERE pak_name = ?", (mod_id, pak_name))
            updated += 1
    conn.commit()
    remaining_nulls = cur.execute("SELECT count(*) FROM mod_paks WHERE mod_id IS NULL").fetchone()[0]
    return updated, remaining_nulls

def main(argv=None) -> int:
    args = parse_args(argv)
    conn = get_connection(args.db_path)
    updated, remaining_nulls = backfill(conn)
    total = conn.execute("SELECT count(*) FROM mod_paks").fetchone()[0]
    print(f"Backfilled mod_id for {updated} pak(s). Remaining null mod_id paks: {remaining_nulls} (total paks={total}).")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
