-- Add profile URL and member id columns for authors pulled from Nexus
ALTER TABLE mods ADD COLUMN author_profile_url TEXT;
ALTER TABLE mods ADD COLUMN author_member_id INTEGER;
