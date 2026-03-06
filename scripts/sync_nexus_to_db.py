import argparse
import json
import sqlite3
import time
from typing import Iterable, List, Optional

# Reload settings from disk to ensure we have the latest configuration
from core.config.settings import reload_settings
reload_settings()

from core.db import (
    get_connection,
    init_schema,
    replace_mod_changelogs,
    replace_mod_files,
    upsert_api_cache,
    upsert_mod_info,
)
from core.nexus.nexus_api import collect_all_for_mod, get_api_key, DEFAULT_GAME
from core.utils.nexus_metadata import (
    derive_changelogs_from_files,
    extract_description_text,
)
from field_prefs import load_prefs, filter_aggregate_payload


def iter_mod_ids_from_db(conn) -> Iterable[int]:
    cur = conn.execute(
        "SELECT DISTINCT mod_id FROM local_downloads WHERE mod_id IS NOT NULL ORDER BY mod_id;"
    )
    for (mid,) in cur.fetchall():
        yield int(mid)


def sync_mods(mod_ids: List[int], game: Optional[str] = None, rate_delay: float = 0.6) -> None:
    if game is None:
        game = DEFAULT_GAME
    conn = get_connection()
    init_schema(conn)
    key = get_api_key()
    if not key:
        print("WARNING: Nexus API key not configured - skipping Nexus metadata sync.")
        print("To enable Nexus metadata sync, configure your API key in Settings.")
        return
    prefs = load_prefs()
    to_process = list(dict.fromkeys(mod_ids))
    for i, mod_id in enumerate(to_process, 1):
        data = collect_all_for_mod(key, game, mod_id)
        if i < len(to_process):
            time.sleep(max(0.0, rate_delay))
        filtered = filter_aggregate_payload(data, prefs)
        # Merge description payload into mod_info so DB can store it
        mod_info_payload = dict(filtered.get("mod_info") or {})
        desc_text = extract_description_text(filtered.get("description"))
        if desc_text:
            mod_info_payload["description"] = desc_text
        mod_info_status = int(data.get("mod_info_status", 0))
        files_status = int(data.get("files_status", 0))
        changelogs_status = int(data.get("changelogs_status", 0))
        changelogs_payload = filtered.get("changelogs") or {}
        if not changelogs_payload or (isinstance(changelogs_payload, dict) and not changelogs_payload.get("changelogs")):
            changelogs_payload = derive_changelogs_from_files(filtered.get("files"))
        # Retry DB writes in case another task holds the database lock
        for attempt in range(5):
            try:
                upsert_api_cache(conn, mod_id, filtered)
                upsert_mod_info(conn, game, mod_id, mod_info_status, mod_info_payload)
                replace_mod_files(conn, mod_id, filtered.get("files"))
                replace_mod_changelogs(conn, mod_id, changelogs_payload)
                break
            except sqlite3.OperationalError as e:
                if "locked" in str(e) and attempt < 4:
                    time.sleep(2 ** attempt)
                    continue
                raise
        print(
            f"Synced mod {mod_id}: info={mod_info_status} files={files_status} changelogs={changelogs_status}"
        )


def main():
    parser = argparse.ArgumentParser(description="Sync Nexus API data into SQLite")
    parser.add_argument("mod_ids", nargs="*", type=int, help="Specific mod IDs to sync")
    parser.add_argument("--game", default=DEFAULT_GAME, help="Nexus game slug")
    parser.add_argument("--from-file", help="Path to JSON aggregated payload")
    parser.add_argument("--rate-delay", type=float, default=0.6, help="Sleep seconds between requests")
    args = parser.parse_args()
    conn = get_connection()
    init_schema(conn)
    if args.from_file:
        p = json.load(open(args.from_file, "r", encoding="utf-8"))
        mid = int(p.get("mod_id"))
        to_process = [mid]
        payloads = {mid: p}
    else:
        payloads = {}
        if args.mod_ids:
            to_process = list(dict.fromkeys(args.mod_ids))
        else:
            to_process = list(iter_mod_ids_from_db(conn))
    prefs = load_prefs()
    for i, mod_id in enumerate(to_process, 1):
        if args.from_file:
            data = payloads[mod_id]
        else:
            key = get_api_key()
            if not key:
                raise SystemExit("Missing API key. Set NEXUS_API_KEY in .env or environment.")
            data = collect_all_for_mod(key, args.game, mod_id)
            if i < len(to_process):
                time.sleep(max(0.0, args.rate_delay))
        filtered = filter_aggregate_payload(data, prefs)
        # Merge description payload into mod_info so DB can store it
        mod_info_payload = dict(filtered.get("mod_info") or {})
        desc_text = extract_description_text(filtered.get("description"))
        if desc_text:
            mod_info_payload["description"] = desc_text
        mod_info_status = int(data.get("mod_info_status", 0))
        files_status = int(data.get("files_status", 0))
        changelogs_status = int(data.get("changelogs_status", 0))
        changelogs_payload = filtered.get("changelogs") or {}
        if not changelogs_payload or (isinstance(changelogs_payload, dict) and not changelogs_payload.get("changelogs")):
            changelogs_payload = derive_changelogs_from_files(filtered.get("files"))
        for attempt in range(5):
            try:
                upsert_api_cache(conn, mod_id, filtered)
                upsert_mod_info(conn, args.game, mod_id, mod_info_status, mod_info_payload)
                replace_mod_files(conn, mod_id, filtered.get("files"))
                replace_mod_changelogs(conn, mod_id, changelogs_payload)
                break
            except sqlite3.OperationalError as e:
                if "locked" in str(e) and attempt < 4:
                    time.sleep(2 ** attempt)
                    continue
                raise
        print(
            f"Synced mod {mod_id}: info={mod_info_status} files={files_status} changelogs={changelogs_status}"
        )


if __name__ == "__main__":
    main()
