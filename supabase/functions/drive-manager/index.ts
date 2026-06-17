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
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
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

function driveImageUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function turkishDateFolder(): string {
  const now = new Date();
  return `${now.getDate()} ${TR_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

function driveVideoEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

// Dosyayı Supabase Storage'dan indirip Drive'a yükler
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

// URL'den indirip Drive'a yükler (migration için)
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

function guessMimeType(url: string, isVideo: boolean): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (isVideo) {
    const map: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
    return map[ext] ?? 'video/webm';
  }
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
  return map[ext] ?? 'image/jpeg';
}

// ── ACTION: upload_task_photo ─────────────────────────────────────────────────
// Task fotoğrafları Diyar/Bahar klasörüne tarih alt klasörüyle gider
async function handleUploadTaskPhoto(
  payload: { staging_path: string; user_id: string; task_name: string },
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { staging_path, user_id, task_name } = payload;
  if (!staging_path || !user_id || !task_name) throw new Error('staging_path, user_id ve task_name zorunlu');

  // Kullanıcının username'ini çek
  const { data: profileData } = await supabaseAdmin
    .from('profiles')
    .select('username')
    .eq('id', user_id)
    .single();
  const username = (profileData?.username || '').toLowerCase().trim();

  // Username'e göre kullanıcı klasör ID'si seç
  let userFolderId: string;
  if (username === 'diyar') {
    userFolderId = Deno.env.get('DRIVE_FOLDER_DIYAR')!;
  } else if (username === 'bahar') {
    userFolderId = Deno.env.get('DRIVE_FOLDER_BAHAR')!;
  } else {
    // Bilinmeyen kullanıcı → kök altında genel Photos klasörü
    const token0 = await getAccessToken();
    const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
    const photosFolderId = await findOrCreateFolder(token0, 'Photos', rootId);
    userFolderId = await findOrCreateFolder(token0, user_id, photosFolderId);
  }

  const token = await getAccessToken();

  // Türkçe tarih klasörü: "17 Haz 2026"
  const dateFolderName = turkishDateFolder();
  const dateFolderId = await findOrCreateFolder(token, dateFolderName, userFolderId);

  // Dosya adı = task ismi
  const ext = staging_path.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${sanitizeFilename(task_name)}.${ext}`;
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
  const mimeType = mimeMap[ext] ?? 'image/jpeg';

  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, filename, mimeType, dateFolderId);

  return {
    drive_file_id: driveFile.id,
    photo_url: driveImageUrl(driveFile.id),
  };
}

// ── ACTION: upload_photo ──────────────────────────────────────────────────────
async function handleUploadPhoto(
  payload: { staging_path: string; user_id: string; filename?: string },
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { staging_path, user_id, filename } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');
  const token = await getAccessToken();
  const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
  const photosFolderId = await findOrCreateFolder(token, 'Photos', rootFolderId);
  const userFolderId = await findOrCreateFolder(token, user_id, photosFolderId);
  const uploadedFilename = filename || `photo_${Date.now()}.jpg`;
  const ext = uploadedFilename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic' };
  const mimeType = mimeMap[ext] ?? 'image/jpeg';
  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, uploadedFilename, mimeType, userFolderId);
  return {
    drive_file_id: driveFile.id,
    photo_url: driveImageUrl(driveFile.id),
  };
}

// ── ACTION: upload_video ──────────────────────────────────────────────────────
async function handleUploadVideo(
  payload: { staging_path: string; user_id: string; filename?: string },
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { staging_path, user_id, filename } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');
  const token = await getAccessToken();
  const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
  const videosFolderId = await findOrCreateFolder(token, 'Videos', rootFolderId);
  const userFolderId = await findOrCreateFolder(token, user_id, videosFolderId);
  const uploadedFilename = filename || `video_${Date.now()}.mp4`;
  const ext = uploadedFilename.split('.').pop()?.toLowerCase() ?? 'mp4';
  const mimeMap: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
  const mimeType = mimeMap[ext] ?? 'video/mp4';
  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, uploadedFilename, mimeType, userFolderId);
  return {
    drive_file_id: driveFile.id,
    drive_web_view_link: driveFile.webViewLink,
    drive_embed_url: driveVideoEmbedUrl(driveFile.id),
  };
}

// ── ACTION: migrate_existing_posts ────────────────────────────────────────────
// Mevcut tüm postların medyasını Drive'a taşır (tek seferlik)
async function handleMigrateExistingPosts(
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const token = await getAccessToken();
  const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;

  // Henüz migrate edilmemiş medyası olan postları çek
  const { data: posts, error } = await supabaseAdmin
    .from('social_feed')
    .select('id, user_id, photo_url, video_drive_file_id, media_type')
    .not('photo_url', 'is', null)
    .is('photo_drive_file_id', null); // sadece henüz Drive'a geçmemişler

  if (error) throw new Error(`Post sorgu hatası: ${error.message}`);
  if (!posts || posts.length === 0) return { migrated: 0, message: 'Tüm postlar zaten migrate edilmiş' };

  let migrated = 0;
  const errors: string[] = [];

  for (const post of posts) {
    try {
      const isVideo = post.media_type === 'video';
      const url: string = post.photo_url;

      // Supabase Storage URL'si mi yoksa harici mi?
      const isStorageUrl = url.includes('.supabase.co/storage/');

      const folderCategory = isVideo ? 'Videos' : 'Photos';
      const categoryFolderId = await findOrCreateFolder(token, folderCategory, rootFolderId);
      const userFolderId = await findOrCreateFolder(token, post.user_id, categoryFolderId);

      const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
      const filename = `${isVideo ? 'video' : 'photo'}_${post.id.slice(0, 8)}.${ext}`;
      const mimeType = guessMimeType(url, isVideo);

      let driveFileId: string;
      let newPhotoUrl: string;

      if (isStorageUrl) {
        // Storage path'i çıkar
        const match = url.match(/\/object\/public\/([^/]+)\/(.+)$/);
        if (!match) throw new Error(`Storage path çıkarılamadı: ${url}`);
        const [, bucket, path] = match;
        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(path);
        if (dlErr || !blob) throw new Error(`Storage indirme hatası: ${dlErr?.message}`);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const driveFile = await uploadFileMultipart(token, bytes, { name: filename, mimeType, parents: [userFolderId] });
        await setPublicReadable(token, driveFile.id);
        driveFileId = driveFile.id;
      } else {
        // Harici URL'den indir
        const driveFile = await uploadFromUrl(token, url, filename, mimeType, userFolderId);
        driveFileId = driveFile.id;
      }

      newPhotoUrl = isVideo ? url : driveImageUrl(driveFileId);

      // DB güncelle
      const updatePayload: Record<string, unknown> = { photo_drive_file_id: driveFileId };
      if (!isVideo) updatePayload.photo_url = newPhotoUrl;
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
