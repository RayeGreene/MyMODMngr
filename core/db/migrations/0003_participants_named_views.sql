-- Migration 0003: Participant views with mod names for readability
BEGIN;

DROP VIEW IF EXISTS v_conflict_participants_named;
CREATE VIEW v_conflict_participants_named AS
SELECT p.asset_path,
       p.pak_name,
       p.mod_id,
       COALESCE(m.name, CAST(p.mod_id AS TEXT)) AS mod_name,
       p.source_zip
FROM asset_conflict_participants p
LEFT JOIN mods m ON m.mod_id = p.mod_id
ORDER BY p.asset_path, p.mod_id, p.pak_name;

DROP VIEW IF EXISTS v_conflict_participants_active_named;
CREATE VIEW v_conflict_participants_active_named AS
SELECT p.asset_path,
       p.pak_name,
       p.mod_id,
       COALESCE(m.name, CAST(p.mod_id AS TEXT)) AS mod_name,
       p.source_zip
FROM asset_conflict_participants_active p
LEFT JOIN mods m ON m.mod_id = p.mod_id
ORDER BY p.asset_path, p.mod_id, p.pak_name;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0003_participants_named_views');

COMMIT;
