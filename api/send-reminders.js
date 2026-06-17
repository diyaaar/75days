import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: 'Missing env vars' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  webpush.setVapidDetails('mailto:noreply@75hard.app', vapidPublic, vapidPrivate);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Türkiye saati (UTC+3) ile şu anki HH:MM — 5 dakikalık pencere
  const nowUtc = new Date();
  const trOffset = 3 * 60; // dakika
  const trMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + trOffset;
  const trHH = Math.floor((trMinutes % 1440) / 60).toString().padStart(2, '0');
  const trMM = (trMinutes % 60).toString().padStart(2, '0');
  const currentTime = `${trHH}:${trMM}`;

  // 5 dakikalık penceredeki zamanları oluştur (HH:MM formatı)
  const timeWindow = [];
  for (let i = 0; i < 5; i++) {
    const m = trMinutes + i;
    const hh = Math.floor((m % 1440) / 60).toString().padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    timeWindow.push(`${hh}:${mm}`);
  }

  // Hatırlatıcısı bu pencereye düşen task'leri çek
  const { data: tasks, error } = await supabase
    .from('user_tasks')
    .select('user_id, task_name, reminder_time')
    .in('reminder_time', timeWindow);

  if (error || !tasks || tasks.length === 0) {
    return new Response(JSON.stringify({ sent: 0, time: currentTime, window: timeWindow }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  let sent = 0;
  for (const task of tasks) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, id')
      .eq('user_id', task.user_id);

    if (!subs || subs.length === 0) continue;

    const payload = JSON.stringify({
      title: '75 HARD 🔥',
      body: `⏰ ${task.task_name} zamanı!`,
      url: '/',
      icon: '/icon.svg',
      badge: '/icon.svg',
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, time: currentTime, tasks: tasks.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
