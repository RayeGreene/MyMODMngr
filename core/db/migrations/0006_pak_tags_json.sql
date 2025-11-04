BEGIN;

-- Table to store aggregated tags per pak (multiple tags in JSON array)
CREATE TABLE IF NOT EXISTS pak_tags_json (
    pak_name  TEXT PRIMARY KEY,
    mod_id    INTEGER,
    tags_json TEXT NOT NULL,
    FOREIGN KEY(pak_name) REFERENCES mod_paks(pak_name) ON DELETE CASCADE,
    FOREIGN KEY(mod_id) REFERENCES mods(mod_id) ON DELETE SET NULL
);

COMMIT;
