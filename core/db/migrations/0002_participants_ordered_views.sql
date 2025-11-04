-- Migration 0002: Ordered participant views for readability
BEGIN;

-- Helpful indexes for ordered scans
CREATE INDEX IF NOT EXISTS idx_participants_asset_path ON asset_conflict_participants(asset_path);
CREATE INDEX IF NOT EXISTS idx_participants_active_asset_path ON asset_conflict_participants_active(asset_path);
CREATE INDEX IF NOT EXISTS idx_participants_mod_id ON asset_conflict_participants(mod_id);
CREATE INDEX IF NOT EXISTS idx_participants_active_mod_id ON asset_conflict_participants_active(mod_id);

-- Read-friendly ordered views (do not change storage, only presentation)
DROP VIEW IF EXISTS v_conflict_participants_ordered;
CREATE VIEW v_conflict_participants_ordered AS
SELECT asset_path, pak_name, mod_id, source_zip
FROM asset_conflict_participants
ORDER BY asset_path, mod_id, pak_name;

DROP VIEW IF EXISTS v_conflict_participants_active_ordered;
CREATE VIEW v_conflict_participants_active_ordered AS
SELECT asset_path, pak_name, mod_id, source_zip
FROM asset_conflict_participants_active
ORDER BY asset_path, mod_id, pak_name;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0002_participants_ordered_views');

COMMIT;
