from core.db import get_connection, init_schema


def main():
    conn = get_connection()
    init_schema(conn)
    cur = conn.cursor()

    print("-- mods (5) --")
    for row in cur.execute("SELECT mod_id, name, author, version, updated_at FROM mods ORDER BY mod_id LIMIT 5;"):
        print(row)

    print("\n-- mod_files (5) --")
    for row in cur.execute("SELECT mod_id, file_id, name, version, size_in_bytes, uploaded_at FROM mod_files ORDER BY mod_id, file_id LIMIT 5;"):
        print(row)

    print("\n-- mod_changelogs (5) --")
    for row in cur.execute("SELECT mod_id, version, substr(changelog,1,60) AS snippet, uploaded_at FROM mod_changelogs ORDER BY mod_id, version LIMIT 5;"):
        print(row)

    print("\n-- v_latest_file_per_mod (5) --")
    for row in cur.execute("SELECT mod_id, file_id, file_version, uploaded_at FROM v_latest_file_per_mod ORDER BY mod_id LIMIT 5;"):
        print(row)

    print("\n-- v_mods_with_latest_by_version (5) --")
    for row in cur.execute("SELECT mod_id, latest_file_id, latest_uploaded_at FROM v_mods_with_latest_by_version ORDER BY mod_id LIMIT 5;"):
        print(row)

    print("\n-- v_local_without_remote (5) --")
    for row in cur.execute("SELECT * FROM v_local_without_remote ORDER BY local_count DESC, mod_id LIMIT 5;"):
        print(row)


if __name__ == "__main__":
    main()
