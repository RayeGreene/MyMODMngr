from __future__ import annotations
import argparse, os, sys
from pathlib import Path

# Path bootstrap for direct execution
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.db import get_connection, init_schema
from core.db.conflicts import list_asset_conflicts, get_asset_conflict_detail

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Demonstrate asset conflict detection.")
    p.add_argument("--db", dest="db_path", default=None, help="Path to SQLite DB (defaults mods.db)")
    p.add_argument("--active", action="store_true", help="Show only active conflicts view")
    p.add_argument("--limit", type=int, default=25, help="Limit conflicts rows")
    p.add_argument("--detail", dest="detail", help="Show detail for specific asset path")
    return p.parse_args(argv)

def main(argv=None) -> int:
    args = parse_args(argv)
    conn = get_connection(args.db_path)
    init_schema(conn)
    if args.detail:
        detail = get_asset_conflict_detail(conn, args.detail.lower())
        if not detail:
            print("No conflict or asset not found.")
            return 0
        print(f"Conflict detail for: {detail['asset_path']}")
        print(f"Mods involved: {detail['mod_count']} | Paks: {detail['pak_count']}")
        for prov in detail['providers']:
            print(f"  mod_id={prov['mod_id']} pak={prov['pak_name']} zip={prov['source_zip']} name={prov.get('mod_name')}")
        return 0
    rows = list_asset_conflicts(conn, active_only=args.active, limit=args.limit)
    if not rows:
        print("No conflicts detected.")
        return 0
    print(f"Showing {len(rows)} conflict asset paths (active_only={args.active})")
    for r in rows:
        print(f"{r['asset_path']}  mods={r['mod_count']} paks={r['pak_count']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
