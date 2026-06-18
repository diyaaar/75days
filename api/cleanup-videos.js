import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'edge' };

// Günlük cron: 1 günden eski, Drive'a aktarımı tamamlanmış (video_drive_file_id dolu)
// videoların geçici Supabase kopyasını siler ve görüntülenmeyi Drive'a geçirir.
// Drive aktarımı henüz bitmemiş (video_drive_file_id NULL) videolara DOKUNMAZ —
// böylece hiçbir video kaybolmaz, Supabase'den servis edilmeye devam eder.
export default async function handler(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 gün önce

  const { data: rows, error } = await supabase
    .from('social_feed')
    .select('id, video_supabase_path')
    .eq('media_type', 'video')
    .not('video_supabase_path', 'is', null)
    .not('video_drive_file_id', 'is', null)
    .lt('created_at', cutoff);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ cleaned: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  let cleaned = 0;
  const errors = [];
  for (const row of rows) {
    try {
      const { error: rmErr } = await supabase.storage.from('task_photos').remove([row.video_supabase_path]);
      if (rmErr) throw rmErr;
      // Supabase referanslarını temizle → render Drive iframe'ine düşer
      const { error: updErr } = await supabase
        .from('social_feed')
        .update({ video_supabase_url: null, video_supabase_path: null })
        .eq('id', row.id);
      if (updErr) throw updErr;
      cleaned++;
    } catch (err) {
      errors.push(`${row.id}: ${err.message || err}`);
    }
  }

  return new Response(JSON.stringify({ cleaned, total: rows.length, errors }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
