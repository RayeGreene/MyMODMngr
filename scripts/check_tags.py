from __future__ import annotations
import json
from typing import List, Tuple

from core.db import get_connection, init_schema


def main() -> int:
    conn = get_connection()
    init_schema(conn)
    cur = conn.cursor()

    print("-- sanity: asset_tags categories --")
    rows: List[Tuple[str, int]] = cur.execute(
        "SELECT COALESCE(LOWER(category), ''), COUNT(1) FROM asset_tags GROUP BY LOWER(category) ORDER BY 2 DESC"
    ).fetchall()
    for cat, cnt in rows:
        print(f"{cat or '<null>'}: {cnt}")

    # Check for lingering 'data' category explicitly
    count_data = cur.execute(
        "SELECT COUNT(1) FROM asset_tags WHERE LOWER(category) = 'data'"
    ).fetchone()[0]
    print(f"\nasset_tags_data_count: {count_data}")

    print("\n-- sanity: pak_tags_json possibly containing 'data' --")
    # First do a coarse LIKE filter to reduce scanning
    coarse = cur.execute(
        "SELECT pak_name, tags_json FROM pak_tags_json WHERE tags_json LIKE '%data%' LIMIT 50"
    ).fetchall()
    print("coarse_rows_with_data_like:", len(coarse))

    # Parse JSON and check tokens precisely
    offending = []
    for pak_name, tags_json in coarse:
        try:
            arr = json.loads(tags_json) or []
        except Exception:
            arr = []
        # Current format stores a single consolidated comma-joined string in the array
        for entry in arr:
            if not entry:
                continue
            tokens = [t.strip().lower() for t in str(entry).split(',') if t.strip()]
            if 'data' in tokens:
                offending.append((pak_name, tokens))
                break

    print("exact_rows_with_data_token:", len(offending))
    for pak_name, tokens in offending[:10]:
        print(" ", pak_name, "->", tokens)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
