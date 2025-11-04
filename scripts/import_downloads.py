import json
import os
from typing import Any, Dict

from core.db import get_connection, init_schema, replace_local_downloads


def main():
    # Allow running from scripts/ but JSON may be in project root
    script_dir = os.path.dirname(__file__)
    root_dir = os.path.abspath(os.path.join(script_dir, os.pardir))
    candidates = [
        os.path.join(script_dir, "downloads_list.json"),
        os.path.join(root_dir, "downloads_list.json"),
    ]
    json_path = next((p for p in candidates if os.path.exists(p)), None)
    if not json_path:
        raise SystemExit("Missing downloads_list.json. Generate it with your scan/download tooling.")

    with open(json_path, "r", encoding="utf-8") as f:
        payload: Dict[str, Any] = json.load(f)

    rows = payload.get("rows") or []
    conn = get_connection()
    init_schema(conn)
    count = replace_local_downloads(conn, rows)
    print(f"Imported {count} local downloads into SQLite from {os.path.relpath(json_path, root_dir)}.")


if __name__ == "__main__":
    main()
