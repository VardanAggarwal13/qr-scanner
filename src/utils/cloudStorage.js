import { createClient } from '@supabase/supabase-js';

// Default / Environment Supabase Config (can also be configured from Settings in UI)
const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const DEFAULT_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'documents';

/**
 * Gets active Supabase client if configured
 */
export function getSupabaseUrl() {
  // Build-time env wins: a stale value saved in this browser must not override a corrected .env / Vercel setting
  const raw = (DEFAULT_SUPABASE_URL || localStorage.getItem('qr_supabase_url') || '').trim();
  // tolerate pasted URLs like https://x.supabase.co/rest/v1/ or with a trailing slash
  return raw.replace(/\/(rest|storage|auth)\/v1.*$/, '').replace(/\/+$/, '');
}

export function getSupabaseClient() {
  const url = getSupabaseUrl();
  const key = (DEFAULT_SUPABASE_ANON_KEY || localStorage.getItem('qr_supabase_key') || '').trim();

  if (url && key) {
    try {
      return createClient(url, key);
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
    }
  }
  return null;
}

export function getActiveBucketName() {
  return ((import.meta.env.VITE_SUPABASE_BUCKET || localStorage.getItem('qr_supabase_bucket')) || DEFAULT_BUCKET).trim();
}

export function saveSupabaseConfig(url, key, bucket) {
  if (url) localStorage.setItem('qr_supabase_url', url.trim());
  if (key) localStorage.setItem('qr_supabase_key', key.trim());
  if (bucket) localStorage.setItem('qr_supabase_bucket', bucket.trim());
}

/**
 * Turns a raw Supabase/network error into a message that says what to fix.
 */
function explainUploadError(err, url, bucket) {
  const msg = err?.message || String(err);
  const host = url.replace(/^https?:\/\//, '');
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return `Cannot reach Supabase at "${host}". The project URL is wrong, or the project is paused/deleted. Copy the Project URL from Supabase → Project Settings → API into VITE_SUPABASE_URL.`;
  }
  if (/exceeded the maximum|too large|payload/i.test(msg)) {
    return 'This file is larger than the storage limit (50 MB on the free Supabase plan). Use a smaller file, or raise the limit in Supabase → Storage → Settings.';
  }
  if (/mime type/i.test(msg)) {
    return `Bucket "${bucket}" does not allow this file type. Clear the allowed MIME types in the bucket settings in Supabase → Storage.`;
  }
  if (/bucket not found/i.test(msg)) {
    return `Bucket "${bucket}" does not exist. Create it in Supabase → Storage (set it to Public), or fix VITE_SUPABASE_BUCKET.`;
  }
  if (/row-level security|violates|unauthorized|not allowed/i.test(msg)) {
    return `Supabase refused the upload. In Storage → Policies, add an INSERT policy for the "anon" role on bucket "${bucket}".`;
  }
  if (/invalid (jwt|api key)|apikey/i.test(msg)) {
    return 'Supabase rejected the key. Use the "anon public" key from Project Settings → API for VITE_SUPABASE_ANON_KEY.';
  }
  return `Supabase upload failed: ${msg}`;
}

/**
 * Uploads a file to the Supabase Storage bucket and returns its public URL.
 * @param {File} file
 * @returns {Promise<{ url: string, provider: string }>}
 */
export async function uploadMediaToCloud(file) {
  const supabase = getSupabaseClient();
  const bucket = getActiveBucketName();

  if (!supabase) {
    throw new Error('Supabase is not configured in this build. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Production environment in Vercel) and redeploy.');
  }

  const ext = file.name.split('.').pop() || 'bin';
  const filePath = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { cacheControl: '31536000', upsert: false, contentType: file.type || 'application/octet-stream' });
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase upload error:', err);
    throw new Error(explainUploadError(err, getSupabaseUrl(), bucket));
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  if (!data?.publicUrl) throw new Error('Upload worked but Supabase returned no public URL. Make the bucket Public.');
  return { url: data.publicUrl, provider: 'Supabase Storage' };
}
