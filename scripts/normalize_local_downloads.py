from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

# Ensure project root on sys.path when executed as a module
import sys
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.db.db import get_connection, init_schema, run_migrations, rebuild_conflicts
from core.utils.pak_files import collapse_pak_bundle


def normalize_local_downloads(db_path: Optional[str] = None) -> int:
    conn = get_connection(db_path)
    try:
        init_schema(conn)
        run_migrations(conn)
        cur = conn.cursor()
        rows = cur.execute("SELECT id, contents FROM local_downloads").fetchall()
        updated = 0
        for ident, contents_json in rows:
            current_json = contents_json if isinstance(contents_json, str) else None
            try:
                contents = json.loads(current_json) if current_json else []
            except Exception:
                contents = []
            collapsed = collapse_pak_bundle(contents)
            new_json = json.dumps(collapsed, ensure_ascii=False)
            if current_json != new_json:
                cur.execute(
                    "UPDATE local_downloads SET contents = ? WHERE id = ?",
                    (new_json, ident),
                )
                updated += 1
        conn.commit()
        rebuild_conflicts(conn, active_only=None)
        return updated
    finally:
        conn.close()


def main(argv: Optional[list[str]] = None) -> int:
    updated = normalize_local_downloads()
    print(f"Normalized {updated} local download entries")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
