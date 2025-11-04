from core.db import (
    get_connection,
    init_schema,
    get_mod,
    get_latest_file,
    list_local_without_remote,
    search_mods,
    mod_with_local_and_latest,
    get_latest_file_by_version,
    list_mod_files,
)


def main():
    conn = get_connection()
    init_schema(conn)

    mod_id = 2732

    print("== get_mod ==")
    print(get_mod(conn, mod_id))

    print("\n== get_latest_file ==")
    print(get_latest_file(conn, mod_id))

    print("\n== mod_with_local_and_latest ==")
    print(mod_with_local_and_latest(conn, mod_id))

    print("\n== get_latest_file_by_version ==")
    print(get_latest_file_by_version(conn, mod_id))

    print("\n== list_mod_files(order_by='version') top 5 ==")
    for row in list_mod_files(conn, mod_id, order_by="version")[:5]:
        print(row)

    print("\n== list_local_without_remote (top 5) ==")
    for row in list_local_without_remote(conn, 5):
        print(row)

    print("\n== search_mods('Venom') ==")
    for row in search_mods(conn, "Venom", limit=5):
        print(row)


if __name__ == "__main__":
    main()
