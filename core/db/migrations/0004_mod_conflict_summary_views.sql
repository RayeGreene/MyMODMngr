-- Migration 0004: Convenience views for frontend consumption
BEGIN;

-- v_mod_conflicts_active: per-mod badge counts (active loadout)
DROP VIEW IF EXISTS v_mod_conflicts_active;
CREATE VIEW v_mod_conflicts_active AS
WITH edges AS (
    SELECT p1.mod_id AS self_mod,
           p2.mod_id AS other_mod,
           p1.asset_path
    FROM asset_conflict_participants_active p1
    JOIN asset_conflict_participants_active p2
      ON p1.asset_path = p2.asset_path AND p2.mod_id <> p1.mod_id
)
SELECT self_mod AS mod_id,
       COUNT(DISTINCT asset_path) AS active_conflicting_assets,
       COUNT(DISTINCT other_mod)  AS active_opposing_mods
FROM edges
GROUP BY self_mod;

-- v_mod_conflict_assets_active_named: drilldown rows per mod and self pak with opponents JSON
DROP VIEW IF EXISTS v_mod_conflict_assets_active_named;
CREATE VIEW v_mod_conflict_assets_active_named AS
WITH pairs AS (
    SELECT p1.mod_id AS self_mod_id,
           p1.pak_name AS self_pak,
           p1.asset_path,
           p2.mod_id AS other_mod_id,
           COALESCE(m.name, CAST(p2.mod_id AS TEXT)) AS other_mod_name,
           p2.pak_name AS other_pak
    FROM asset_conflict_participants_active p1
    JOIN asset_conflict_participants_active p2
      ON p1.asset_path = p2.asset_path AND p2.mod_id <> p1.mod_id
    LEFT JOIN mods m ON m.mod_id = p2.mod_id
)
SELECT self_mod_id AS mod_id,
       asset_path,
       self_pak,
       json_group_array(
         DISTINCT json_object(
           'mod_id', other_mod_id,
           'mod_name', other_mod_name,
           'pak_name', other_pak
         )
       ) AS opponents_json
FROM pairs
GROUP BY self_mod_id, asset_path, self_pak
ORDER BY mod_id, asset_path, self_pak;

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0004_mod_conflict_summary_views');

COMMIT;
