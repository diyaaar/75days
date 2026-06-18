import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = 'mailto:noreply@75hard.app';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
  'Content-Type': 'application/json',
};

function buildNotificationBody(posterName: string, mediaType: string | null, content: string | null): string {
  const name = posterName || 'Someone';
  const text = content?.trim() || '';

  let headline: string;
  if (mediaType === 'photo' || mediaType === 'image') {
    headline = `${name} shared a photo 📸`;
  } else if (mediaType === 'video') {
    headline = `${name} shared a video 🎥`;
  } else {
    headline = `${name} posted something 💬`;
  }

  return text ? `${headline}\n${text}` : headline;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { post_id, user_id, poster_name, content, media_type } = body;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .neq('user_id', user_id);

    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscribers' }), {
        headers: corsHeaders,
      });
    }

    const notificationBody = buildNotificationBody(poster_name, media_type, content);

    const payload = JSON.stringify({
      title: '75 HARD 🔥',
      body: notificationBody,
      url: '/#feed',
      icon: '/icon.svg',
      badge: '/icon.svg',
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub: any) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };
        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { success: true, id: sub.id };
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
          return { success: false, id: sub.id, error: err.message };
        }
      })
    );

    const sent = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as any).success
    ).length;

    console.log(`Push notifications: ${sent}/${subscriptions.length} sent`);

    return new Response(
      JSON.stringify({ sent, total: subscriptions.length }),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
