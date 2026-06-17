// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const VIDEO_STORAGE_BUCKET = 'task_photos';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
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
  const data = await res.json();
  return data.access_token;
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
  const folder = await createRes.json();
  return folder.id;
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

async function handleUploadVideo(payload: {
  staging_path: string;
  user_id: string;
  filename?: string;
}, supabaseAdmin: ReturnType<typeof createClient>) {
  const { staging_path, user_id, filename } = payload;
  if (!staging_path || !user_id) throw new Error('staging_path ve user_id zorunlu');

  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from(VIDEO_STORAGE_BUCKET)
    .download(staging_path);
  if (downloadError || !fileData) throw new Error(`Storage indirme hatası: ${downloadError?.message}`);

  const arrayBuffer = await fileData.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const token = await getAccessToken();
  const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID')!;

  const videosFolderId = await findOrCreateFolder(token, 'Videos', rootFolderId);
  const userFolderId = await findOrCreateFolder(token, user_id, videosFolderId);

  const uploadedFilename = filename || `video_${Date.now()}.webm`;
  const mimeType = uploadedFilename.endsWith('.mp4') ? 'video/mp4' : 'video/webm';

  const driveFile = await uploadFileMultipart(token, bytes, {
    name: uploadedFilename,
    mimeType,
    parents: [userFolderId],
  });

  await setPublicReadable(token, driveFile.id);

  // staging dosyasını temizle
  await supabaseAdmin.storage.from(VIDEO_STORAGE_BUCKET).remove([staging_path]);

  return {
    drive_file_id: driveFile.id,
    drive_web_view_link: driveFile.webViewLink,
    drive_embed_url: `https://drive.google.com/file/d/${driveFile.id}/preview`,
  };
}

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

    if (action === 'upload_video') {
      const result = await handleUploadVideo({ ...payload, user_id: payload.user_id || user.id }, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: `Bilinmeyen action: ${action}` }), { status: 400, headers: jsonHeaders });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
