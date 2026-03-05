-- Migration 0013: Premium/Patreon mod source tracking
-- Tracks which local_downloads are "premium" versions of existing mods,
-- links them to matching Nexus mods via shared PAK names, and stores
-- preview images bundled inside premium zips.

-- Each local_download can optionally have a source designation.
-- source: "nexus" (default/NULL), "premium", "local"
-- linked_mod_id: if premium, the mod_id of the matching Nexus mod
-- premium_pak_count: total PAKs in the premium download
-- shared_pak_count: PAKs that overlap with the linked Nexus mod
-- extra_pak_count:  PAKs exclusive to this premium download
ALTER TABLE local_downloads ADD COLUMN source TEXT DEFAULT NULL;
ALTER TABLE local_downloads ADD COLUMN linked_mod_id INTEGER DEFAULT NULL;
ALTER TABLE local_downloads ADD COLUMN premium_pak_count INTEGER DEFAULT NULL;
ALTER TABLE local_downloads ADD COLUMN shared_pak_count INTEGER DEFAULT NULL;
ALTER TABLE local_downloads ADD COLUMN extra_pak_count INTEGER DEFAULT NULL;

-- Preview images extracted from premium zip files (non-PAK image files)
CREATE TABLE IF NOT EXISTS premium_preview_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_download_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'image/png',
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(local_download_id) REFERENCES local_downloads(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_premium_preview_images_dl ON premium_preview_images(local_download_id);
