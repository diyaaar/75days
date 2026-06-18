-- Video staging: feed videoları önce Supabase'den servis edilir (anında, Drive transcode beklemeden),
-- arka planda Drive'a yüklenir, 1 gün sonra cron Supabase kopyasını silip Drive'a geçer.
ALTER TABLE social_feed
  ADD COLUMN IF NOT EXISTS video_supabase_url TEXT,
  ADD COLUMN IF NOT EXISTS video_supabase_path TEXT;
