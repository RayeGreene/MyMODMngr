from __future__ import annotations
import sqlite3, argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.db import get_connection, init_schema

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Inspect mod_paks backfill status: sample populated rows, remaining NULL rows, counts.")
    p.add_argument('--db', dest='db_path', default=None, help='Path to SQLite DB (defaults to project mods.db)')
    p.add_argument('--populated', type=int, default=5, help='Number of populated sample rows to show')
    p.add_argument('--null', type=int, default=5, help='Number of NULL sample rows to show')
    return p.parse_args(argv)

def main(argv=None) -> int:
    args = parse_args(argv)
    conn = get_connection(args.db_path)
    init_schema(conn)
    cur = conn.cursor()

    total = cur.execute('SELECT count(*) FROM mod_paks').fetchone()[0]
    with_mod = cur.execute('SELECT count(*) FROM mod_paks WHERE mod_id IS NOT NULL').fetchone()[0]
    without_mod = total - with_mod

    print(f"Total mod_paks: {total}\nWith mod_id: {with_mod}\nWithout mod_id: {without_mod}")

    print('\nSample populated rows:')
    for pak_name, mod_id, source_zip in cur.execute('SELECT pak_name, mod_id, source_zip FROM mod_paks WHERE mod_id IS NOT NULL LIMIT ?', (args.populated,)):
        print(f"pak={pak_name} mod_id={mod_id} source_zip={source_zip}")

    if without_mod:
        print('\nSample NULL mod_id rows:')
        for pak_name, source_zip in cur.execute('SELECT pak_name, source_zip FROM mod_paks WHERE mod_id IS NULL LIMIT ?', (args.null,)):
            print(f"pak={pak_name} source_zip={source_zip}")

    # Optional: show why remaining NULL rows didn't match (diagnostics)
    if without_mod:
        print('\nDiagnostics for remaining NULL rows:')
        unresolved = cur.execute("SELECT source_zip FROM mod_paks WHERE mod_id IS NULL").fetchall()
        tails = {}
        for (src,) in unresolved:
            tail = src.replace('/', '\\').split('\\')[-1]
            tails[tail] = tails.get(tail, 0) + 1
        for tail, cnt in sorted(tails.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"tail={tail} count={cnt}")
        missing = cur.execute(
            "SELECT mp.source_zip FROM mod_paks mp LEFT JOIN local_downloads ld ON ld.path = mp.source_zip WHERE mp.mod_id IS NULL AND ld.path IS NULL LIMIT 5"
        ).fetchall()
        if missing:
            print('\nExamples not directly matching local_downloads.path (may need improved parsing):')
            for (src,) in missing:
                print(f"  {src}")

    return 0

if __name__ == '__main__':
    raise SystemExit(main())
