from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path
import sys

# Ensure repo root on path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _load_env_value(key: str) -> str | None:
    val = os.environ.get(key)
    if val:
        return val
    env_path = ROOT / ".env"
    try:
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == key:
                    return v.strip().strip('"').strip("'")
    except Exception:
        pass
    return None


def _resolve_downloads_root(arg_root: str | None) -> Path:
    # Prefer CLI arg, then MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT, then legacy MARVEL_RIVALS_MODS_ROOT, else <repo>/downloads
    root = arg_root or _load_env_value("MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT") or _load_env_value("MARVEL_RIVALS_MODS_ROOT")
    if not root:
        root = str(ROOT / "downloads")
    return Path(root).expanduser().resolve()


def normalize_paths(db_path: str | None, base_root: Path, dry_run: bool = False) -> dict:
    conn = sqlite3.connect(db_path or str(ROOT / "mods.db"))
    cur = conn.cursor()
    rows = cur.execute("SELECT id, path FROM local_downloads").fetchall()
    updated = 0
    skipped_abs_missing = 0
    changes: list[tuple[int, str, str]] = []
    for id_, path in rows:
        orig = (path or "").strip()
        if not orig:
            continue
        p = Path(orig)
        new_abs: Path | None = None
        if p.is_absolute():
            if p.exists():
                # already absolute and exists -> optionally normalize to resolved form
                new_abs = p.resolve()
            else:
                # absolute but missing; cannot infer reliably -> skip and count
                skipped_abs_missing += 1
                continue
        else:
            # make absolute under base_root regardless of existence
            new_abs = (base_root / p).resolve()
        if new_abs and str(new_abs) != orig:
            changes.append((id_, orig, str(new_abs)))
    if dry_run:
        return {"total": len(rows), "to_update": len(changes), "skipped_abs_missing": skipped_abs_missing, "changes": changes}
    # apply updates
    for id_, _old, new in changes:
        cur.execute("UPDATE local_downloads SET path = ? WHERE id = ?", (new, id_))
        updated += 1
    conn.commit()
    conn.close()
    return {"total": len(rows), "updated": updated, "skipped_abs_missing": skipped_abs_missing}


def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Normalize local_downloads.path to absolute paths under MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT")
    p.add_argument("--db", dest="db_path", default=None, help="Path to mods.db (defaults to repo mods.db)")
    p.add_argument("--root", dest="root_dir", default=None, help="Override downloads root (defaults to MARVEL_RIVALS_LOCAL_DOWNLOADS_ROOT/.env)")
    p.add_argument("--dry-run", action="store_true", help="Do not modify DB; print a summary of changes")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    base_root = _resolve_downloads_root(args.root_dir)
    res = normalize_paths(args.db_path, base_root, dry_run=args.dry_run)
    # Pretty-print summary
    if args.dry_run:
        print(f"Total rows: {res['total']}, to update: {res['to_update']}, absolute-missing skipped: {res['skipped_abs_missing']}")
        for id_, old, new in res.get("changes", [])[:50]:
            print(f"  id={id_}:\n    old: {old}\n    new: {new}")
        if len(res.get("changes", [])) > 50:
            print(f"  ... and {len(res['changes']) - 50} more")
    else:
        print(f"Updated {res['updated']} row(s); absolute-missing skipped: {res['skipped_abs_missing']}; base_root={base_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
