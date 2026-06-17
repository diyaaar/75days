-- Add video support to social_feed
ALTER TABLE social_feed
  ADD COLUMN IF NOT EXISTS video_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS video_drive_url TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'video'));

-- Backfill existing photo posts
UPDATE social_feed SET media_type = 'image' WHERE photo_url IS NOT NULL AND media_type = 'none';
