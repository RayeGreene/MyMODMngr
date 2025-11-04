from pathlib import Path
import sqlite3
import json
import pprint


def main():
    db = Path("mods.db")
    conn = sqlite3.connect(str(db))
    cur = conn.cursor()
    rows = cur.execute(
        "SELECT mod_id, changelogs FROM v_mod_changelogs_json ORDER BY mod_id LIMIT 5;"
    ).fetchall()
    pp = pprint.pprint
    for mod_id, changelogs_json in rows:
        print("mod_id", mod_id)
        if changelogs_json:
            try:
                parsed = json.loads(changelogs_json)
            except Exception:
                parsed = changelogs_json
            pp(parsed)
        else:
            print(None)
        print()


if __name__ == "__main__":
    main()
