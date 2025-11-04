from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional

# Allow running this file directly (python core/ingestion/scan_active_mods.py) by ensuring project root on sys.path
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.config.settings import SETTINGS
from core.db import get_connection, init_schema, update_local_download_active_paks

RELATIVE_MODS_PATH = Path("MarvelGame/Marvel/Content/Paks/~mods")

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def parse_args(argv: List[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Scan active (installed) .pak mods and update local_downloads.active_paks")
    p.add_argument("--game-root", help="Path to game root containing MarvelGame/ (defaults to settings)")
    p.add_argument("--db", dest="db_path", default=None, help="Path to SQLite DB (defaults to mods.db in repo)")
    ns = p.parse_args(argv)
    if not ns.game_root:
        if not SETTINGS.marvel_rivals_root:
            p.error("--game-root not provided and Marvel Rivals root not configured in settings")
        ns.game_root = str(SETTINGS.marvel_rivals_root)
    return ns

def discover_paks(mods_root: Path) -> List[str]:
    out: List[str] = []
    if not mods_root.is_dir():
        return out
    seen = set()
    for path in mods_root.rglob("*.pak"):
        if path.is_file():
            name = path.name
            if name not in seen:
                seen.add(name)
                out.append(name)
    return out

def _parse_json_array(raw: str | None) -> List[str]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x) for x in data if isinstance(x, str)]
    except Exception:
        return []
    return []


_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _ts(value: Optional[datetime]) -> float:
    if value is None:
        return float("-inf")
    try:
        return value.timestamp()
    except Exception:
        return _EPOCH.timestamp()

def main(argv: List[str] | None = None) -> int:
    args = parse_args(argv)
    game_root = Path(args.game_root).expanduser().resolve()
    mods_root = game_root / RELATIVE_MODS_PATH
    conn = get_connection(args.db_path)
    init_schema(conn)
    active_paks = set(discover_paks(mods_root))
    cur = conn.cursor()
    updated = 0
    rows = cur.execute(
        "SELECT id, contents, active_paks, last_activated_at, last_deactivated_at, created_at FROM local_downloads;"
    ).fetchall()
    now_iso = utc_now()

    downloads = []
    for _id, contents_raw, active_raw, last_activated_raw, last_deactivated_raw, created_raw in rows:
        downloads.append(
            {
                "id": _id,
                "contents": _parse_json_array(contents_raw),
                "prev_active": _parse_json_array(active_raw),
                "last_activated": _parse_iso(last_activated_raw),
                "last_deactivated": _parse_iso(last_deactivated_raw),
                "created_at": _parse_iso(created_raw),
            }
        )

    downloads.sort(
        key=lambda item: (
            _ts(item["last_activated"]),
            _ts(item["created_at"]),
            item["id"],
        ),
        reverse=True,
    )

    remaining = set(active_paks)

    for info in downloads:
        contents_list = info["contents"]
        subset = [p for p in contents_list if p in remaining]
        if subset:
            for name in subset:
                if name in remaining:
                    remaining.remove(name)
        prev_list = info["prev_active"]
        if prev_list != subset:
            update_local_download_active_paks(conn, info["id"], subset, now_iso=now_iso)
            updated += 1
    print(f"Active scan: discovered {len(active_paks)} active pak(s); updated {updated} row(s).")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
