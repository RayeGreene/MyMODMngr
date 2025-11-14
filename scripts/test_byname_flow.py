from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

# Ensure repo root on path
ROOT = Path(__file__).resolve().parents[1]
import sys
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.db.db import get_connection, init_schema, next_local_download_id, resolve_created_at
from scripts import activate_mods as activate_script
from scripts import deactivate_mods as deactivate_script


def setup_fixture(name: str) -> dict:
    base = ROOT / "tmp_test"
    game_root = base / "game"
    mods_dir = game_root / "MarvelGame/Marvel/Content/Paks/~mods"
    downloads_dir = base / "downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    mods_dir.mkdir(parents=True, exist_ok=True)
    # Create a fake pak file
    pak_name = "FakePak_P.pak"
    pak_path = downloads_dir / pak_name
    pak_path.write_bytes(b"TEST-PAK-CONTENT")

    # Insert/replace a local_download row pointing to this .pak
    conn = get_connection()
    try:
        init_schema(conn)
        cur = conn.cursor()
        # Remove any previous row with same name
        cur.execute("DELETE FROM local_downloads WHERE name = ?", (name,))
        new_id = next_local_download_id(conn)
        created_at_iso = resolve_created_at(path=pak_path)

        cur.execute(
            """
            INSERT INTO local_downloads(path, id, name, mod_id, version, contents, active_paks, created_at)
            VALUES(?, ?, ?, NULL, '', ?, ?, ?)
            """,
            (
                str(pak_path.resolve()),
                new_id,
                name,
                json.dumps([pak_name], ensure_ascii=False),
                json.dumps([], ensure_ascii=False),
                created_at_iso,
            ),
        )
        conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass

    return {
        "base": base,
        "game_root": game_root,
        "mods_dir": mods_dir,
        "pak_name": pak_name,
        "pak_path": pak_path,
        "name": name,
    }


def teardown_fixture(fx: dict):
    # Remove row and cleanup files
    conn = get_connection()
    try:
        init_schema(conn)
        conn.cursor().execute("DELETE FROM local_downloads WHERE name = ?", (fx["name"],))
        conn.commit()
    finally:
        try:
            conn.close()
        except Exception:
            pass
    try:
        if fx.get("base") and Path(fx["base"]).exists():
            shutil.rmtree(fx["base"], ignore_errors=True)
    except Exception:
        pass


def main() -> int:
    test_name = "UnitTest ByName"
    fx = setup_fixture(test_name)
    # Point scripts to the temp game root
    os.environ["MARVEL_RIVALS_ROOT"] = str(fx["game_root"])

    print("-- Activate by name (all) --")
    rc_act = activate_script.main(["--name", test_name, "--all"])  # type: ignore[arg-type]
    if rc_act != 0:
        print("Activation script returned:", rc_act)
        teardown_fixture(fx)
        return 1
    applied = (fx["mods_dir"] / fx["pak_name"]).exists()
    print("Applied exists:", applied)
    if not applied:
        teardown_fixture(fx)
        return 2

    print("-- Deactivate by name --")
    rc_de = deactivate_script.main(["--name", test_name])  # type: ignore[arg-type]
    if rc_de != 0:
        print("Deactivation script returned:", rc_de)
        teardown_fixture(fx)
        return 3
    removed = not (fx["mods_dir"] / fx["pak_name"]).exists()
    print("Removed ok:", removed)
    if not removed:
        teardown_fixture(fx)
        return 4

    teardown_fixture(fx)
    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
