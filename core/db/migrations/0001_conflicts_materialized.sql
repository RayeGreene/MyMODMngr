-- Migration 0001: Materialized conflict tables
-- Creates tables to store computed conflicts and participants (all + active subset)

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Core materialized conflict tables
CREATE TABLE IF NOT EXISTS asset_conflicts (
    asset_path TEXT PRIMARY KEY,
    distinct_mods INTEGER NOT NULL,
    distinct_paks INTEGER NOT NULL,
    generated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asset_conflicts_mods ON asset_conflicts(distinct_mods DESC);

CREATE TABLE IF NOT EXISTS asset_conflict_participants (
    asset_path TEXT NOT NULL,
    pak_name TEXT NOT NULL,
    mod_id INTEGER,
    source_zip TEXT,
    PRIMARY KEY(asset_path, pak_name),
    FOREIGN KEY(pak_name) REFERENCES mod_paks(pak_name) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_asset_conflict_participants_mod_id ON asset_conflict_participants(mod_id);

-- Active variants (separate snapshot for active paks)
CREATE TABLE IF NOT EXISTS asset_conflicts_active (
    asset_path TEXT PRIMARY KEY,
    distinct_mods INTEGER NOT NULL,
    distinct_paks INTEGER NOT NULL,
    generated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_asset_conflicts_active_mods ON asset_conflicts_active(distinct_mods DESC);

CREATE TABLE IF NOT EXISTS asset_conflict_participants_active (
    asset_path TEXT NOT NULL,
    pak_name TEXT NOT NULL,
    mod_id INTEGER,
    source_zip TEXT,
    PRIMARY KEY(asset_path, pak_name)
);
CREATE INDEX IF NOT EXISTS idx_asset_conflict_participants_active_mod_id ON asset_conflict_participants_active(mod_id);

INSERT OR IGNORE INTO schema_migrations(version) VALUES ('0001_conflicts_materialized');

COMMIT;
