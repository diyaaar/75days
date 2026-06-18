import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Hatırlatıcı gönderici — pg_cron tarafından her 5 dakikada bir tetiklenir.
// (Vercel Hobby cron'u günde 1 kez sınırı olduğu için mantık Supabase'e taşındı.)
// Yetki: Authorization: Bearer <CRON_SECRET>.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

webpush.setVapidDetails('mailto:noreply@75hard.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req: Request) => {
  // Yetki kontrolü
  const auth = req.headers.get('authorization');
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Türkiye saati (UTC+3) ile 5 dakikalık pencere
  const nowUtc = new Date();
  const trMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + 3 * 60;
  const currentTime = `${Math.floor((trMinutes % 1440) / 60).toString().padStart(2, '0')}:${(trMinutes % 60).toString().padStart(2, '0')}`;
  const timeWindow: string[] = [];
  for (let i = 0; i < 5; i++) {
    const m = trMinutes + i;
    timeWindow.push(`${Math.floor((m % 1440) / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`);
  }

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
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, time: currentTime, tasks: tasks.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
