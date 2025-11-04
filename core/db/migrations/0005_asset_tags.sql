-- Create table to store tags for UE asset paths derived from pak_assets
BEGIN;

CREATE TABLE IF NOT EXISTS asset_tags (
    asset_path TEXT PRIMARY KEY,
    entity     TEXT,
    category   TEXT NOT NULL,
    tag        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asset_tags_category ON asset_tags(category);
CREATE INDEX IF NOT EXISTS idx_asset_tags_entity   ON asset_tags(entity);

COMMIT;
