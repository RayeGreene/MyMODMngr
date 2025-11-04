-- Add description columns to mods table for storing Nexus BBCode and rendered HTML
ALTER TABLE mods ADD COLUMN description_bbcode TEXT;
ALTER TABLE mods ADD COLUMN description_html TEXT;
