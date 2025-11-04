from __future__ import annotations
import json
import sys
from pathlib import Path

# Ensure project root on sys.path when executed directly (so 'core' package resolves)
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
    
from core.db import get_connection, init_schema

def main():
    conn = get_connection()
    init_schema(conn)
    cur = conn.cursor()
    print('v_asset_conflicts_all (up to 5 rows):')
    rows = cur.execute("SELECT asset_path, mod_count, pak_count, conflict_paks_json FROM v_asset_conflicts_all LIMIT 5").fetchall()
    for asset_path, mod_count, pak_count, conflict_paks_json in rows:
        try:
            arr = json.loads(conflict_paks_json) if conflict_paks_json else []
        except Exception:
            arr = []
        print(f"asset={asset_path} mods={mod_count} paks={pak_count} entries={len(arr)} sample={arr[:2]}")
    print('\nv_asset_conflicts_active (up to 5 rows):')
    rows = cur.execute("SELECT asset_path, mod_count, pak_count, conflict_paks_json FROM v_asset_conflicts_active LIMIT 5").fetchall()
    for asset_path, mod_count, pak_count, conflict_paks_json in rows:
        try:
            arr = json.loads(conflict_paks_json) if conflict_paks_json else []
        except Exception:
            arr = []
        print(f"asset={asset_path} mods={mod_count} paks={pak_count} entries={len(arr)} sample={arr[:2]}")

if __name__ == '__main__':
    main()
