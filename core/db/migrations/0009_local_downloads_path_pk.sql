PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

DROP VIEW IF EXISTS v_mod_pak_version_status;
DROP VIEW IF EXISTS v_local_pak_version_status;
DROP VIEW IF EXISTS v_local_downloads_with_tags;
DROP VIEW IF EXISTS v_asset_conflicts_active;
DROP VIEW IF EXISTS v_local_without_remote;

CREATE TABLE IF NOT EXISTS local_downloads__new (
	path TEXT PRIMARY KEY,
	id INTEGER NOT NULL,
	name TEXT NOT NULL,
	mod_id INTEGER,
	version TEXT,
	contents TEXT,
	active_paks TEXT,
	last_activated_at TEXT,
	last_deactivated_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO local_downloads__new (
	path,
	id,
	name,
	mod_id,
	version,
	contents,
	active_paks,
	last_activated_at,
	last_deactivated_at,
	created_at
)
SELECT
	path,
	id,
	name,
	mod_id,
	version,
	contents,
	active_paks,
	last_activated_at,
	last_deactivated_at,
	created_at
FROM local_downloads;

-- Remove records that lack a usable path key to satisfy the new PRIMARY KEY constraint.
DELETE FROM local_downloads__new WHERE path IS NULL OR TRIM(path) = '';

DROP TABLE local_downloads;
ALTER TABLE local_downloads__new RENAME TO local_downloads;

CREATE UNIQUE INDEX IF NOT EXISTS idx_local_downloads_id_unique ON local_downloads(id);
CREATE INDEX IF NOT EXISTS idx_local_downloads_mod_id ON local_downloads(mod_id);
CREATE INDEX IF NOT EXISTS idx_local_downloads_name ON local_downloads(name);

COMMIT;
PRAGMA foreign_keys = ON;
