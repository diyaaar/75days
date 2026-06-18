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

// ── Yardımcılar ───────────────────────────────────────────────────────────────
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
  const q = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
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

// Büyük dosyalar için resumable upload: kaynağı (Supabase public URL) stream ederek
// Drive'a aktarır — dosyanın tamamı belleğe alınmaz (yüksek MB videolar için).
async function uploadResumableFromUrl(
  token: string,
  sourceUrl: string,
  size: number,
  filename: string,
  mimeType: string,
  parentFolderId: string,
): Promise<{ id: string }> {
  // 1) Resumable oturumu başlat
  const sessionRes = await fetch(`${DRIVE_UPLOAD_API}?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType,
      'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({ name: filename, parents: [parentFolderId] }),
  });
  if (!sessionRes.ok) throw new Error(`Resumable oturum hatası: ${await sessionRes.text()}`);
  const uploadUri = sessionRes.headers.get('location');
  if (!uploadUri) throw new Error('Resumable upload URI alınamadı');

  // 2) Kaynağı stream olarak indir
  const src = await fetch(sourceUrl);
  if (!src.ok || !src.body) throw new Error(`Kaynak indirilemedi (${src.status})`);

  // 3) Tek PUT ile stream'i Drive'a aktar (Content-Length zorunlu)
  const putRes = await fetch(uploadUri, {
    method: 'PUT',
    headers: { 'Content-Length': String(size), 'Content-Type': mimeType },
    body: src.body,
    // @ts-ignore Deno streaming request body
    duplex: 'half',
  });
  if (putRes.status !== 200 && putRes.status !== 201) {
    throw new Error(`Resumable PUT hatası: ${putRes.status} ${await putRes.text()}`);
  }
  return await putRes.json();
}

async function getFileParents(token: string, fileId: string): Promise<string[]> {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}?fields=parents&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.parents ?? [];
}

// Dosyayı yeni klasöre TAŞIR (aynı fileId korunur → lh3 URL'si bozulmaz)
async function moveFile(token: string, fileId: string, newParentId: string): Promise<boolean> {
  const current = await getFileParents(token, fileId);
  if (current.length === 1 && current[0] === newParentId) return false; // zaten doğru yerde
  const params = new URLSearchParams({ addParents: newParentId, fields: 'id,parents', supportsAllDrives: 'true' });
  if (current.length > 0) params.set('removeParents', current.join(','));
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}?${params.toString()}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Taşıma hatası (${fileId}): ${await res.text()}`);
  return true;
}

// Dosyayı çöp kutusuna taşır (geri alınabilir, KALICI SİLME DEĞİL)
async function trashFile(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${DRIVE_FILES_API}/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok) throw new Error(`Çöpe taşıma hatası (${fileId}): ${await res.text()}`);
}

async function listFolderChildren(token: string, folderId: string): Promise<any[]> {
  const out: any[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id,name,mimeType,size,createdTime,parents)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${DRIVE_FILES_API}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Listeleme hatası (${folderId}): ${await res.text()}`);
    const data = await res.json();
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

// ── URL üreticiler ────────────────────────────────────────────────────────────
function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}
function driveVideoEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

// Herhangi bir Drive URL'sinden / file_id alanından dosya kimliğini çıkarır
function extractDriveId(url: string | null): string | null {
  if (!url) return null;
  let m = url.match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function turkishDateFolder(isoDate?: string): string {
  const d = isoDate ? new Date(isoDate + 'T12:00:00Z') : new Date();
  return `${d.getUTCDate()} ${TR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

// İnsanca feed dosya adı: "Diyar 17 Haz 2026 14-30.jpg"
function feedFilename(username: string | null, isoDateTime: string | undefined, ext: string): string {
  const base = isoDateTime ? new Date(isoDateTime) : new Date();
  const tr = new Date(base.getTime() + 3 * 3600 * 1000); // UTC+3
  const date = `${tr.getUTCDate()} ${TR_MONTHS[tr.getUTCMonth()]} ${tr.getUTCFullYear()}`;
  const time = `${String(tr.getUTCHours()).padStart(2, '0')}-${String(tr.getUTCMinutes()).padStart(2, '0')}`;
  const who = username ? username.charAt(0).toUpperCase() + username.slice(1) : 'Feed';
  return `${who} ${date} ${time}.${ext}`;
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

async function getUsername(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('profiles').select('username').eq('id', userId).single();
  return data?.username ?? null;
}

// Kullanıcının kişisel klasörü (Diyar/Bahar) — task fotoğrafları için
async function getUserDriveRootFolder(token: string, supabaseAdmin: any, userId: string): Promise<string> {
  const username = (await getUsername(supabaseAdmin, userId) || '').toLowerCase().trim();
  if (username === 'diyar') return Deno.env.get('DRIVE_FOLDER_DIYAR')!;
  if (username === 'bahar') return Deno.env.get('DRIVE_FOLDER_BAHAR')!;
  const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
  return findOrCreateFolder(token, userId, rootId);
}

// Ortak Feed klasörü (ROOT/Feed) — TÜM feed foto & videoları buraya gider
let _feedFolderCache: string | null = null;
async function getFeedFolder(token: string): Promise<string> {
  if (_feedFolderCache) return _feedFolderCache;
  const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
  _feedFolderCache = await findOrCreateFolder(token, 'Feed', rootId);
  return _feedFolderCache;
}

async function uploadFromStorage(token: string, supabaseAdmin: any, stagingPath: string, driveFilename: string, mimeType: string, parentFolderId: string) {
  const { data: fileBlob, error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).download(stagingPath);
  if (error || !fileBlob) throw new Error(`Storage indirme hatası: ${error?.message}`);
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  const driveFile = await uploadFileMultipart(token, bytes, { name: driveFilename, mimeType, parents: [parentFolderId] });
  await setPublicReadable(token, driveFile.id);
  await supabaseAdmin.storage.from(MEDIA_BUCKET).remove([stagingPath]);
  return driveFile;
}

// ── ACTION: upload_task_photo ─────────────────────────────────────────────────
// Task fotoğrafları → Diyar/Bahar → "17 Haz 2026" alt klasörü → task_name.jpg
async function handleUploadTaskPhoto(payload: any, supabaseAdmin: any) {
  const { staging_path, user_id, task_name } = payload;
  if (!staging_path || !user_id || !task_name) throw new Error('staging_path, user_id ve task_name zorunlu');
  const token = await getAccessToken();
  const userRootFolderId = await getUserDriveRootFolder(token, supabaseAdmin, user_id);
  const dateFolderId = await findOrCreateFolder(token, turkishDateFolder(), userRootFolderId);
  const ext = staging_path.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = `${sanitizeFilename(task_name)}.${ext}`;
  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, filename, guessMimeType(filename, false), dateFolderId);
  return { drive_file_id: driveFile.id, photo_url: driveImageUrl(driveFile.id) };
}

// ── ACTION: upload_photo (feed) → ROOT/Feed ───────────────────────────────────
async function handleUploadPhoto(payload: any, supabaseAdmin: any) {
  const { staging_path, user_id } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');
  const token = await getAccessToken();
  const feedFolderId = await getFeedFolder(token);
  const username = await getUsername(supabaseAdmin, user_id);
  const ext = staging_path.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filename = feedFilename(username, undefined, ext);
  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, filename, guessMimeType(filename, false), feedFolderId);
  return { drive_file_id: driveFile.id, photo_url: driveImageUrl(driveFile.id) };
}

// ── ACTION: upload_video (feed) → ROOT/Feed ───────────────────────────────────
async function handleUploadVideo(payload: any, supabaseAdmin: any) {
  const { staging_path, user_id } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');
  const token = await getAccessToken();
  const feedFolderId = await getFeedFolder(token);
  const username = await getUsername(supabaseAdmin, user_id);
  const ext = staging_path.split('.').pop()?.toLowerCase() ?? 'mp4';
  const filename = feedFilename(username, undefined, ext);
  const driveFile = await uploadFromStorage(token, supabaseAdmin, staging_path, filename, guessMimeType(filename, true), feedFolderId);
  return {
    drive_file_id: driveFile.id,
    drive_web_view_link: driveFile.webViewLink,
    drive_embed_url: driveVideoEmbedUrl(driveFile.id),
  };
}

// ── ACTION: stage_video_to_drive ──────────────────────────────────────────────
// Supabase'deki geçici videoyu Drive'a (ROOT/Feed) resumable upload ile aktarır.
// Supabase kopyası SİLİNMEZ — render bir süre Supabase'den devam eder, cron 1 gün
// sonra Supabase'i silip Drive'a geçirir. post_id verilirse satıra drive id yazılır.
async function handleStageVideoToDrive(payload: any, supabaseAdmin: any) {
  const { staging_path, user_id, post_id } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');

  const token = await getAccessToken();
  const feedFolderId = await getFeedFolder(token);
  const { data: pub } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(staging_path);
  const sourceUrl = pub.publicUrl;

  // Boyut + mime tipini kaynaktan öğren
  const head = await fetch(sourceUrl, { method: 'HEAD' });
  const size = Number(head.headers.get('content-length') || 0);
  if (!size) throw new Error('Kaynak boyutu alınamadı');
  const mime = head.headers.get('content-type') || guessMimeType(staging_path, true);

  const username = await getUsername(supabaseAdmin, user_id);
  const ext = staging_path.split('.').pop()?.toLowerCase() ?? 'mp4';
  const filename = feedFilename(username, undefined, ext);

  const driveFile = await uploadResumableFromUrl(token, sourceUrl, size, filename, mime, feedFolderId);
  await setPublicReadable(token, driveFile.id);

  if (post_id) {
    await supabaseAdmin.from('social_feed').update({
      video_drive_file_id: driveFile.id,
      video_drive_url: driveVideoEmbedUrl(driveFile.id),
    }).eq('id', post_id);
  }
  return { drive_file_id: driveFile.id, drive_embed_url: driveVideoEmbedUrl(driveFile.id) };
}

// ── ACTION: admin_remove_objects (Storage'dan KALICI siler) ───────────────────
// avatars bucket'ı korumalıdır. Verilen path listesini batch'ler hâlinde siler.
async function handleAdminRemoveObjects(supabaseAdmin: any, payload: any) {
  const bucket = payload.bucket;
  if (!bucket) throw new Error('bucket zorunlu');
  if (bucket === 'avatars') throw new Error('avatars bucket korumalı — silinemez');
  const paths: string[] = payload.paths ?? [];
  if (!paths.length) return { removed: 0, errors: [] };

  let removed = 0;
  const errors: string[] = [];
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data, error } = await supabaseAdmin.storage.from(bucket).remove(batch);
    if (error) errors.push(error.message);
    else removed += data?.length ?? batch.length;
  }
  return { removed, errors };
}

// ── İç: Feed migrasyonu (TAŞIMA temelli, yeniden yükleme YOK) ──────────────────
// 1) Storage URL'si olan feed postları → Feed klasörüne yükle
// 2) Drive'da olan feed postları → Feed klasörüne TAŞI (aynı fileId), URL'yi lh3'e çevir
async function processFeedMigration(supabaseAdmin: any, token: string, batchSize = 20) {
  const feedFolderId = await getFeedFolder(token);
  const { data: posts, error } = await supabaseAdmin
    .from('social_feed')
    .select('id, user_id, photo_url, photo_drive_file_id, video_drive_file_id, media_type')
    .not('photo_url', 'is', null);
  if (error) throw new Error(`Feed sorgu: ${error.message}`);

  let moved = 0, uploaded = 0, fixed = 0;
  const errors: string[] = [];

  for (const post of (posts ?? []).slice(0, batchSize)) {
    try {
      const isVideo = post.media_type === 'video';
      const url: string = post.photo_url;
      const storageMatch = url.match(/\/object\/public\/([^/]+)\/(.+?)(\?.*)?$/);

      if (storageMatch) {
        // Storage'da → Feed'e yükle
        const [, bucket, path] = storageMatch;
        const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(path);
        if (dlErr || !blob) throw new Error(`Storage indirme: ${dlErr?.message}`);
        const username = await getUsername(supabaseAdmin, post.user_id);
        const ext = path.split('.').pop()?.toLowerCase() ?? (isVideo ? 'mp4' : 'jpg');
        const filename = feedFilename(username, undefined, ext);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const driveFile = await uploadFileMultipart(token, bytes, { name: filename, mimeType: guessMimeType(path, isVideo), parents: [feedFolderId] });
        await setPublicReadable(token, driveFile.id);
        const payload: any = isVideo
          ? { video_drive_file_id: driveFile.id, video_drive_url: driveVideoEmbedUrl(driveFile.id), photo_drive_file_id: driveFile.id }
          : { photo_url: driveImageUrl(driveFile.id), photo_drive_file_id: driveFile.id };
        await supabaseAdmin.from('social_feed').update(payload).eq('id', post.id);
        uploaded++;
      } else {
        // Drive'da → Feed klasörüne taşı, URL'yi düzelt
        const fileId = post.photo_drive_file_id || extractDriveId(url);
        if (!fileId) throw new Error('file_id bulunamadı');
        const didMove = await moveFile(token, fileId, feedFolderId);
        if (didMove) moved++;
        const correctUrl = isVideo ? driveVideoEmbedUrl(fileId) : driveImageUrl(fileId);
        const needsFix = url !== correctUrl || post.photo_drive_file_id !== fileId;
        if (needsFix) {
          const payload: any = { photo_drive_file_id: fileId };
          if (!isVideo) payload.photo_url = driveImageUrl(fileId);
          await supabaseAdmin.from('social_feed').update(payload).eq('id', post.id);
          fixed++;
        }
      }
    } catch (err: any) {
      errors.push(`Post ${post.id}: ${err?.message ?? err}`);
    }
  }
  return { moved, uploaded, fixed, total: (posts ?? []).length, errors };
}

// ── İç: Task fotoğrafı migrasyonu (Storage → Diyar/Bahar/tarih) ────────────────
async function processTaskMigration(supabaseAdmin: any, token: string, batchSize = 4) {
  const { data: allTasks, error } = await supabaseAdmin
    .from('tasks')
    .select('id, user_id, date, task_name, photo_url')
    .not('photo_url', 'is', null)
    .like('photo_url', 'https://%supabase.co%');
  if (error) throw new Error(`Tasks sorgu: ${error.message}`);
  const remaining = (allTasks ?? []).length;
  if (remaining === 0) return { migrated: 0, remaining: 0, errors: [] };

  const folderCache: Record<string, string> = {};
  async function userFolder(uid: string) {
    if (!folderCache[uid]) folderCache[uid] = await getUserDriveRootFolder(token, supabaseAdmin, uid);
    return folderCache[uid];
  }

  let migrated = 0;
  const errors: string[] = [];
  for (const task of allTasks.slice(0, batchSize)) {
    try {
      const dateFolderId = await findOrCreateFolder(token, turkishDateFolder(task.date), await userFolder(task.user_id));
      const url: string = task.photo_url;
      const m = url.match(/\/object\/public\/([^/]+)\/(.+?)(\?.*)?$/);
      if (!m) throw new Error(`Storage path çıkarılamadı: ${url}`);
      const [, bucket, path] = m;
      const { data: blob, error: dlErr } = await supabaseAdmin.storage.from(bucket).download(path);
      if (dlErr || !blob) throw new Error(`Storage indirme: ${dlErr?.message}`);
      const ext = path.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filename = `${sanitizeFilename(task.task_name)}.${ext}`;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const driveFile = await uploadFileMultipart(token, bytes, { name: filename, mimeType: guessMimeType(path, false), parents: [dateFolderId] });
      await setPublicReadable(token, driveFile.id);
      // NOT: Supabase Storage'daki orijinal silinmez (yedek/güvenlik) — sadece DB referansı güncellenir
      await supabaseAdmin.from('tasks').update({ photo_url: driveImageUrl(driveFile.id) }).eq('id', task.id);
      migrated++;
    } catch (err: any) {
      errors.push(`Task ${task.id} (${task.task_name}): ${err?.message ?? err}`);
    }
  }
  return { migrated, remaining: remaining - migrated, errors };
}

// ── İç: DB'de referans verilen tüm Drive file_id'leri topla ───────────────────
async function collectReferencedIds(supabaseAdmin: any): Promise<Set<string>> {
  const ids = new Set<string>();
  const { data: feed } = await supabaseAdmin
    .from('social_feed')
    .select('photo_url, photo_drive_file_id, video_drive_file_id, video_drive_url');
  for (const r of feed ?? []) {
    if (r.photo_drive_file_id) ids.add(r.photo_drive_file_id);
    if (r.video_drive_file_id) ids.add(r.video_drive_file_id);
    const a = extractDriveId(r.photo_url); if (a) ids.add(a);
    const b = extractDriveId(r.video_drive_url); if (b) ids.add(b);
  }
  const { data: tasks } = await supabaseAdmin.from('tasks').select('photo_url').not('photo_url', 'is', null);
  for (const t of tasks ?? []) {
    const a = extractDriveId(t.photo_url); if (a) ids.add(a);
  }
  return ids;
}

// ── İç: ROOT ağacını gez (klasör + dosyalar), derinlik sınırlı ─────────────────
async function walkDriveTree(token: string, rootId: string, rootName: string) {
  const files: any[] = [];   // tüm dosyalar (klasör değil)
  const folders: any[] = []; // tüm klasörler
  async function recurse(folderId: string, pathPrefix: string, depth: number) {
    if (depth > 4) return;
    const children = await listFolderChildren(token, folderId);
    for (const c of children) {
      const path = `${pathPrefix}/${c.name}`;
      if (c.mimeType === FOLDER_MIME) {
        folders.push({ id: c.id, path, parent: folderId });
        await recurse(c.id, path, depth + 1);
      } else {
        files.push({ id: c.id, name: c.name, path, parent: folderId, size: c.size, mimeType: c.mimeType });
      }
    }
  }
  await recurse(rootId, rootName, 0);
  return { files, folders };
}

// ── ACTION: admin_list_drive (SALT-OKUNUR) ────────────────────────────────────
async function handleAdminListDrive(supabaseAdmin: any) {
  const token = await getAccessToken();
  const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
  const { files, folders } = await walkDriveTree(token, rootId, '75 Hard Challenge');
  const referenced = await collectReferencedIds(supabaseAdmin);

  const orphans = files.filter((f) => !referenced.has(f.id));
  const referencedFiles = files.filter((f) => referenced.has(f.id));

  // İçerik bazlı mükerrer tespiti (aynı isim + boyut)
  const byKey: Record<string, any[]> = {};
  for (const f of files) {
    const key = `${f.name}|${f.size ?? '?'}`;
    (byKey[key] ||= []).push(f);
  }
  const duplicateGroups = Object.entries(byKey)
    .filter(([, arr]) => arr.length > 1)
    .map(([key, arr]) => ({ key, count: arr.length, ids: arr.map((x) => ({ id: x.id, path: x.path, referenced: referenced.has(x.id) })) }));

  return {
    summary: {
      total_files: files.length,
      total_folders: folders.length,
      referenced_in_db: referencedFiles.length,
      orphans: orphans.length,
      duplicate_groups: duplicateGroups.length,
      db_referenced_ids: referenced.size,
    },
    folders: folders.map((f) => f.path),
    orphans: orphans.map((f) => ({ id: f.id, path: f.path, size: f.size })),
    duplicateGroups,
  };
}

// ── ACTION: admin_migrate ─────────────────────────────────────────────────────
async function handleAdminMigrate(supabaseAdmin: any, payload: any) {
  const token = await getAccessToken();
  const feed = await processFeedMigration(supabaseAdmin, token, payload.feed_batch ?? 20);
  const tasks = await processTaskMigration(supabaseAdmin, token, payload.task_batch ?? 4);
  return { feed, tasks, tasks_remaining: tasks.remaining };
}

// ── ACTION: admin_cleanup (dryRun varsayılan; çöp kutusuna, KALICI SİLME YOK) ──
async function handleAdminCleanup(supabaseAdmin: any, payload: any) {
  const token = await getAccessToken();
  const rootId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;
  const feedFolderId = await getFeedFolder(token);
  const diyarId = Deno.env.get('DRIVE_FOLDER_DIYAR')!;
  const baharId = Deno.env.get('DRIVE_FOLDER_BAHAR')!;
  const protectedFolders = new Set([rootId, feedFolderId, diyarId, baharId]);

  const { files, folders } = await walkDriveTree(token, rootId, '75 Hard Challenge');
  const referenced = await collectReferencedIds(supabaseAdmin);
  const orphanFiles = files.filter((f) => !referenced.has(f.id));

  // Legacy klasör adayları: ROOT'un doğrudan altındaki, korumalı olmayan klasörler.
  // GÜVENLİK: içinde DB'de referanslı dosya varsa ASLA dokunulmaz.
  const rootChildFolders = folders.filter((f) => f.parent === rootId && !protectedFolders.has(f.id));
  const legacyFolders: any[] = [];
  for (const folder of rootChildFolders) {
    const inside = files.filter((f) => f.path.startsWith(folder.path + '/'));
    const hasReferenced = inside.some((f) => referenced.has(f.id));
    if (!hasReferenced) legacyFolders.push({ id: folder.id, path: folder.path });
  }

  const dryRun = payload.dry_run !== false; // varsayılan true
  if (dryRun) {
    return {
      dry_run: true,
      would_trash_files: orphanFiles.length,
      files: orphanFiles.map((f) => ({ id: f.id, path: f.path, size: f.size })),
      would_trash_folders: legacyFolders.length,
      folders: legacyFolders.map((f) => f.path),
    };
  }

  let trashedFiles = 0, trashedFolders = 0;
  const errors: string[] = [];
  for (const f of orphanFiles) {
    try { await trashFile(token, f.id); trashedFiles++; }
    catch (err: any) { errors.push(`file ${f.path}: ${err?.message ?? err}`); }
  }
  // Boşalan legacy klasörleri (alt klasörleriyle birlikte) çöpe taşı
  for (const f of legacyFolders) {
    try { await trashFile(token, f.id); trashedFolders++; }
    catch (err: any) { errors.push(`folder ${f.path}: ${err?.message ?? err}`); }
  }
  return { dry_run: false, trashedFiles, trashedFolders, errors };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const { action, ...payload } = body;

    // Admin aksiyonları: paylaşılan gizli anahtar ile (kullanıcı JWT'si gerekmez)
    const ADMIN_SECRET = Deno.env.get('MIGRATION_ADMIN_SECRET');
    const isAdminAction = action?.startsWith('admin_');
    const isAdmin = ADMIN_SECRET && payload.admin_secret === ADMIN_SECRET;

    if (isAdminAction) {
      if (!isAdmin) return new Response(JSON.stringify({ error: 'admin yetkisi gerekli' }), { status: 401, headers: jsonHeaders });
      if (action === 'admin_list_drive') return json(await handleAdminListDrive(supabaseAdmin));
      if (action === 'admin_migrate') return json(await handleAdminMigrate(supabaseAdmin, payload));
      if (action === 'admin_cleanup') return json(await handleAdminCleanup(supabaseAdmin, payload));
      if (action === 'admin_remove_objects') return json(await handleAdminRemoveObjects(supabaseAdmin, payload));
      return new Response(JSON.stringify({ error: `Bilinmeyen admin action: ${action}` }), { status: 400, headers: jsonHeaders });
    }

    // Normal aksiyonlar: kullanıcı JWT'si zorunlu
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Yetkilendirme başlığı eksik' }), { status: 401, headers: jsonHeaders });
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return new Response(JSON.stringify({ error: 'Geçersiz token' }), { status: 401, headers: jsonHeaders });

    if (action === 'upload_task_photo') return json(await handleUploadTaskPhoto({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin));
    if (action === 'upload_photo') return json(await handleUploadPhoto({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin));
    if (action === 'upload_video') return json(await handleUploadVideo({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin));
    if (action === 'stage_video_to_drive') return json(await handleStageVideoToDrive({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin));

    return new Response(JSON.stringify({ error: `Bilinmeyen action: ${action}` }), { status: 400, headers: jsonHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), { headers: jsonHeaders });
}
