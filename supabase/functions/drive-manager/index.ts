// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const MEDIA_BUCKET = 'task_photos';
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('DRIVE_CLIENT_ID')!,
      client_secret: Deno.env.get('DRIVE_CLIENT_SECRET')!,
      refresh_token: Deno.env.get('DRIVE_REFRESH_TOKEN')!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`OAuth2 token hatası: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const q = encodeURIComponent(`name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const res = await fetch(`${DRIVE_FILES_API}?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0].id;
  const createRes = await fetch(`${DRIVE_FILES_API}?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  if (!createRes.ok) throw new Error(`Klasör oluşturma hatası: ${await createRes.text()}`);
  return (await createRes.json()).id;
}

async function uploadFileMultipart(token: string, fileData: Uint8Array, metadata: Record<string, unknown>) {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const metaPart = `${delimiter}Content-Type: application/json\r\n\r\n${JSON.stringify(metadata)}`;
  const dataPart = `${delimiter}Content-Type: ${metadata.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  const metaBytes = new TextEncoder().encode(metaPart);
  const dataHeaderBytes = new TextEncoder().encode(dataPart);
  const base64Bytes = new TextEncoder().encode(uint8ArrayToBase64(fileData));
  const closeBytes = new TextEncoder().encode(closeDelimiter);
  const body = new Uint8Array(metaBytes.length + dataHeaderBytes.length + base64Bytes.length + closeBytes.length);
  let offset = 0;
  body.set(metaBytes, offset); offset += metaBytes.length;
  body.set(dataHeaderBytes, offset); offset += dataHeaderBytes.length;
  body.set(base64Bytes, offset); offset += base64Bytes.length;
  body.set(closeBytes, offset);
  const res = await fetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary="${boundary}"` },
    body,
  });
  if (!res.ok) throw new Error(`Drive yükleme hatası: ${await res.text()}`);
  return res.json();
}

async function setPublicReadable(token: string, fileId: string) {
  await fetch(`${DRIVE_FILES_API}/${fileId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
}

// img tag'lerde güvenilir çalışan URL
function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

function driveVideoEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function turkishDateFolder(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate + 'T12:00:00Z') : new Date();
  return `${d.getUTCDate()} ${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function guessMimeType(url: string, isVideo: boolean): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (isVideo) {
    const map: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
    return map[ext] ?? 'video/webm';
  }
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
  return map[ext] ?? 'image/jpeg';
}

// Kullanıcının Drive root klasörünü döner (Diyar/Bahar veya fallback)
async function getUserDriveRootFolder(
  token: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data: p } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
  const username = (p?.username || '').toLowerCase().trim();
  if (username === 'diyar') return Deno.env.get('DRIVE_FOLDER_DIYAR')!;
  if (username === 'bahar') return Deno.env.get('DRIVE_FOLDER_BAHAR')!;
  // Bilinmeyen kullanıcı → kök altında user_id klasörü
  const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
  return findOrCreateFolder(token, userId, rootId);
}

// Storage'dan indir, Drive'a yükle, staging'i sil
async function uploadFromStorage(
  token: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  stagingPath: string,
  driveFilename: string,
  mimeType: string,
  parentFolderId: string,
): Promise<{ id: string; webViewLink: string }> {
  const { data: fileBlob, error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).download(stagingPath);
  if (error || !fileBlob) throw new Error(`Storage indirme hatası: ${error?.message}`);
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  const driveFile = await uploadFileMultipart(token, bytes, { name: driveFilename, mimeType, parents: [parentFolderId] });
  await setPublicReadable(token, driveFile.id);
  await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([stagingPath]);
  return driveFile;
}

// URL'den indir, Drive'a yükle
async function uploadFromUrl(
  token: string,
  url: string,
  driveFilename: string,
  mimeType: string,
  parentFolderId: string,
): Promise<{ id: string; webViewLink: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`URL indirme hatası: ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const driveFile = await uploadFileMultipart(token, bytes, { name: driveFilename, mimeType, parents: [parentFolderId] });
  await setPublicReadable(token, driveFile.id);
  return driveFile;
}

// ── ACTION: upload_task_photo ─────────────────────────────────────────────────
// Task fotoğrafları → Diyar/Bahar → "17 Haz 2026" alt klasörü → task_name.jpg
async function handleUploadTaskPhoto(
  payload: { staging_path: string; user_id: string; task_name: string },
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { staging_path, user_id, task_name } = payload;
  if (!staging_path || !user_id || !task_name) throw new Error('staging_path, user_id ve task_name zorunlu');

  const token = await getAccessToken();
  const userRootFolderId = await getUserDriveRootFolder(token, supabaseAdmin, user_id);
  const dateFolderId = await findOrCreateFolder(token, turkishDateFolder(), userRootFolderId);

  const ext = staging_path.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${sanitizeFilename(task_name)}.${ext}`;
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
  const mimeType = mimeMap[ext] ?? 'image/jpeg';

  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, filename, mimeType, dateFolderId);
  return { drive_file_id: driveFile.id, photo_url: driveImageUrl(driveFile.id) };
}

// ── ACTION: upload_photo (feed fotoğrafları) ──────────────────────────────────
// Feed fotoğrafları → Diyar/Bahar root klasörüne direkt (alt klasör yok)
async function handleUploadPhoto(
  payload: { staging_path: string; user_id: string; filename?: string },
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { staging_path, user_id, filename } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');

  const token = await getAccessToken();
  const userRootFolderId = await getUserDriveRootFolder(token, supabaseAdmin, user_id);

  const uploadedFilename = filename || `photo_${Date.now()}.jpg`;
  const ext = uploadedFilename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
  const mimeType = mimeMap[ext] ?? 'image/jpeg';

  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, uploadedFilename, mimeType, userRootFolderId);
  return { drive_file_id: driveFile.id, photo_url: driveImageUrl(driveFile.id) };
}

// ── ACTION: upload_video ──────────────────────────────────────────────────────
async function handleUploadVideo(
  payload: { staging_path: string; user_id: string; filename?: string },
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { staging_path, user_id, filename } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');

  const token = await getAccessToken();
  const userRootFolderId = await getUserDriveRootFolder(token, supabaseAdmin, user_id);
  const videosFolderId = await findOrCreateFolder(token, 'Videos', userRootFolderId);

  const uploadedFilename = filename || `video_${Date.now()}.mp4`;
  const ext = uploadedFilename.split('.').pop()?.toLowerCase() ?? 'mp4';
  const mimeMap: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
  const mimeType = mimeMap[ext] ?? 'video/mp4';

  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, uploadedFilename, mimeType, videosFolderId);
  return {
    drive_file_id: driveFile.id,
    drive_web_view_link: driveFile.webViewLink,
    drive_embed_url: driveVideoEmbedUrl(driveFile.id),
  };
}

// ── ACTION: migrate_task_photos ───────────────────────────────────────────────
async function handleMigrateTaskPhotos(supabaseAdmin: ReturnType<typeof createClient>) {
  const token = await getAccessToken();
  const { data: tasks, error } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, date, task_name, photo_url')
    .not('photo_url', 'is', null)
    .not('photo_url', 'like', 'https://lh3.googleusercontent.com%')
    .not('photo_url', 'like', 'https://drive.google.com%');

  if (error) throw new Error(`Tasks sorgu hatası: ${error.message}`);
  if (!tasks || tasks.length === 0) return { migrated: 0, message: "Tüm task fotoğrafları zaten Drive'da" };

  const folderCache: Record<string, string> = {};
  async function getUserFolder(userId: string): Promise<string> {
    if (folderCache[userId]) return folderCache[userId];
    const folderId = await getUserDriveRootFolder(token, supabaseAdmin, userId);
    folderCache[userId] = folderId;
    return folderId;
  }

  let migrated = 0;
  const errors: string[] = [];

  for (const task of tasks) {
    try {
      const userFolderId = await getUserFolder(task.user_id);
      const dateFolderId = await findOrCreateFolder(token, turkishDateFolder(task.date), userFolderId);
      const url: string = task.photo_url;
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg';
      const filename = `${sanitizeFilename(task.task_name)}.${ext}`;
      const mimeType = guessMimeType(url, false);

      let driveFileId: string;
      const storageMatch = url.match(/\/object\/public\/([^/]+)\/(.+)$/);
      if (storageMatch) {
        const [, bucket, path] = storageMatch;
        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(path);
        if (dlErr || !blob) throw new Error(`Storage indirme: ${dlErr?.message}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const driveFile = await uploadFileMultipart(token, bytes, { name: filename, mimeType, parents: [dateFolderId] });
        await setPublicReadable(token, driveFile.id);
        driveFileId = driveFile.id;
      } else {
        const driveFile = await uploadFromUrl(token, url, filename, mimeType, dateFolderId);
        driveFileId = driveFile.id;
      }

      await supabaseAdmin.from('tasks').update({ photo_url: driveImageUrl(driveFileId) }).eq('id', task.id);
      migrated++;
    } catch (err: unknown) {
      errors.push(`Task ${task.id} (${task.task_name}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { migrated, total: tasks.length, errors };
}

// ── ACTION: migrate_existing_posts ────────────────────────────────────────────
// Feed postlarındaki fotoğrafları Diyar/Bahar root klasörüne direkt taşır
async function handleMigrateExistingPosts(supabaseAdmin: ReturnType<typeof createClient>) {
  const token = await getAccessToken();

  const { data: posts, error } = await supabaseAdmin
    .from('social_feed')
    .select('id, user_id, photo_url, video_drive_file_id, media_type')
    .not('photo_url', 'is', null)
    .is('photo_drive_file_id', null);

  if (error) throw new Error(`Post sorgu hatası: ${error.message}`);
  if (!posts || posts.length === 0) return { migrated: 0, message: 'Tüm postlar zaten migrate edilmiş' };

  const folderCache: Record<string, string> = {};
  async function getUserFolder(userId: string): Promise<string> {
    if (folderCache[userId]) return folderCache[userId];
    const folderId = await getUserDriveRootFolder(token, supabaseAdmin, userId);
    folderCache[userId] = folderId;
    return folderId;
  }

  let migrated = 0;
  const errors: string[] = [];

  for (const post of posts) {
    try {
      const isVideo = post.media_type === 'video';
      const url: string = post.photo_url;
      const userRootFolderId = await getUserFolder(post.user_id);

      // Videolar Videos/ alt klasörüne, fotoğraflar direkt root'a
      const targetFolderId = isVideo
        ? await findOrCreateFolder(token, 'Videos', userRootFolderId)
        : userRootFolderId;

      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
      const filename = `${isVideo ? 'video' : 'photo'}_${post.id.slice(0, 8)}.${ext}`;
      const mimeType = guessMimeType(url, isVideo);

      let driveFileId: string;
      const storageMatch = url.match(/\/object\/public\/([^/]+)\/(.+)$/);
      if (storageMatch) {
        const [, bucket, path] = storageMatch;
        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(path);
        if (dlErr || !blob) throw new Error(`Storage indirme hatası: ${dlErr?.message}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const driveFile = await uploadFileMultipart(token, bytes, { name: filename, mimeType, parents: [targetFolderId] });
        await setPublicReadable(token, driveFile.id);
        driveFileId = driveFile.id;
      } else {
        const driveFile = await uploadFromUrl(token, url, filename, mimeType, targetFolderId);
        driveFileId = driveFile.id;
      }

      const updatePayload: Record<string, unknown> = { photo_drive_file_id: driveFileId };
      if (!isVideo) updatePayload.photo_url = driveImageUrl(driveFileId);
      if (isVideo) {
        updatePayload.video_drive_file_id = driveFileId;
        updatePayload.video_drive_url = `https://drive.google.com/file/d/${driveFileId}/view`;
      }

      await supabaseAdmin.from('social_feed').update(updatePayload).eq('id', post.id);
      migrated++;
    } catch (err: unknown) {
      errors.push(`Post ${post.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { migrated, total: posts.length, errors };
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Yetkilendirme başlığı eksik' }), { status: 401, headers: jsonHeaders });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Geçersiz token' }), { status: 401, headers: jsonHeaders });

    const body = await req.json();
    const { action, ...payload } = body;

    if (action === 'upload_task_photo') {
      const result = await handleUploadTaskPhoto({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }
    if (action === 'upload_photo') {
      const result = await handleUploadPhoto({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }
    if (action === 'upload_video') {
      const result = await handleUploadVideo({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }
    if (action === 'migrate_task_photos') {
      const result = await handleMigrateTaskPhotos(supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }
    if (action === 'migrate_existing_posts') {
      const result = await handleMigrateExistingPosts(supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: `Bilinmeyen action: ${action}` }), { status: 400, headers: jsonHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
