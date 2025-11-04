from __future__ import annotations
import argparse
from core.db import get_connection, init_schema, rebuild_conflicts

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Rebuild materialized conflict tables (all, active, or both).")
    g = p.add_mutually_exclusive_group()
    g.add_argument('--all-only', action='store_true', help='Rebuild only all conflicts (asset_conflicts)')
    g.add_argument('--active-only', action='store_true', help='Rebuild only active conflicts (asset_conflicts_active)')
    p.add_argument('--db', dest='db_path', default=None, help='Optional path to DB file')
    p.add_argument('--limit', type=int, default=5, help='Sample row limit to print')
    p.add_argument('--show-participants', action='store_true', help='Also print a grouped sample from ordered participant views')
    p.add_argument('--show-named', action='store_true', help='Print sample from named participant views (with mod names)')
    return p.parse_args(argv)

def main(argv=None) -> int:
    args = parse_args(argv)
    conn = get_connection(args.db_path)
    init_schema(conn)  # ensures base + migrations applied
    if args.all_only:
        res = rebuild_conflicts(conn, active_only=False)
    elif args.active_only:
        res = rebuild_conflicts(conn, active_only=True)
    else:
        res = rebuild_conflicts(conn, active_only=None)
    print('Rebuild results:', res)
    cur = conn.cursor()
    if 'asset_conflicts' in res:
        print('\nSample asset_conflicts:')
        for row in cur.execute('SELECT asset_path, distinct_mods, distinct_paks FROM asset_conflicts LIMIT ?', (args.limit,)):
            print(row)
    if 'asset_conflicts_active' in res:
        print('\nSample asset_conflicts_active:')
        for row in cur.execute('SELECT asset_path, distinct_mods, distinct_paks FROM asset_conflicts_active LIMIT ?', (args.limit,)):
            print(row)
    if args.show_participants:
        print('\nSample participants (ordered):')
        # Show first 2 assets and up to 5 rows per asset for readability
        assets = [r[0] for r in cur.execute('SELECT asset_path FROM asset_conflicts ORDER BY distinct_mods DESC, asset_path LIMIT 2').fetchall()]
        for asset in assets:
            print(f"\n[asset] {asset}")
            for row in cur.execute('SELECT pak_name, mod_id, source_zip FROM v_conflict_participants_ordered WHERE asset_path = ? LIMIT 5', (asset,)):
                print('  ', row)
    if args.show_named:
        print('\nSample participants (named):')
        assets = [r[0] for r in cur.execute('SELECT asset_path FROM asset_conflicts ORDER BY distinct_mods DESC, asset_path LIMIT 2').fetchall()]
        for asset in assets:
            print(f"\n[asset] {asset}")
            for row in cur.execute('SELECT pak_name, mod_id, mod_name, source_zip FROM v_conflict_participants_named WHERE asset_path = ? LIMIT 5', (asset,)):
                print('  ', row)
        print('\nPer-mod summary (active):')
        for row in cur.execute('SELECT mod_id, active_conflicting_assets, active_opposing_mods FROM v_mod_conflicts_active ORDER BY active_conflicting_assets DESC, active_opposing_mods DESC LIMIT 5'):
            print('  ', row)
        # Show drilldown for top mod
        top = cur.execute('SELECT mod_id FROM v_mod_conflicts_active ORDER BY active_conflicting_assets DESC, active_opposing_mods DESC LIMIT 1').fetchone()
        if top:
            mod_id = top[0]
            print(f"\nDrilldown for mod {mod_id} (active named):")
            for row in cur.execute('SELECT asset_path, self_pak, opponents_json FROM v_mod_conflict_assets_active_named WHERE mod_id = ? LIMIT 5', (mod_id,)):
                print('  ', row)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
