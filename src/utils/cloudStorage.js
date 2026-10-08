import { createClient } from '@supabase/supabase-js';

// Default / Environment Supabase Config (can also be configured from Settings in UI)
const DEFAULT_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const DEFAULT_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const DEFAULT_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'documents';

/**
 * Gets active Supabase client if configured
 */
export function getSupabaseClient() {
  const url = localStorage.getItem('qr_supabase_url') || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem('qr_supabase_key') || DEFAULT_SUPABASE_ANON_KEY;

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
  return localStorage.getItem('qr_supabase_bucket') || DEFAULT_BUCKET;
}

export function saveSupabaseConfig(url, key, bucket) {
  if (url) localStorage.setItem('qr_supabase_url', url.trim());
  if (key) localStorage.setItem('qr_supabase_key', key.trim());
  if (bucket) localStorage.setItem('qr_supabase_bucket', bucket.trim());
}

/**
 * Uploads a file to Supabase Storage Bucket or Instant Public Fallback
 * @param {File} file
 * @param {string} customFileName
 * @returns {Promise<{ url: string, provider: string }>}
 */
export async function uploadMediaToCloud(file, customFileName) {
  const supabase = getSupabaseClient();
  const bucket = getActiveBucketName();
  const failures = [];
  if (!supabase) failures.push('Supabase is not configured in this build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing)');

  // 1. Try Supabase Storage first if keys are configured
  if (supabase) {
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const cleanName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = `${cleanName}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) {
        console.warn('Supabase upload error, falling back to public cloud upload:', error);
        failures.push(`Supabase bucket "${bucket}": ${error.message}`);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        if (publicUrlData?.publicUrl) {
          return {
            url: publicUrlData.publicUrl,
            provider: 'Supabase Storage'
          };
        }
      }
    } catch (err) {
      console.warn('Supabase direct error:', err);
      failures.push(`Supabase: ${err.message}`);
    }
  }

  // 2. Free Instant Public File Host Fallback (Catbox / Free File Host)
  // This allows instant testing without requiring a backend or pre-configured credentials!
  try {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);

    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const publicUrl = await res.text();
      if (publicUrl && publicUrl.startsWith('http')) {
        return {
          url: publicUrl.trim(),
          provider: 'Instant Cloud CDN'
        };
      }
    }
  } catch (err) {
    console.warn('Catbox upload fallback failed:', err);
    failures.push(`catbox.moe: ${err.message}`);
  }

  // 3. ImgBB / Free image fallback if it's an image
  if (file.type.startsWith('image/')) {
    try {
      const formData = new FormData();
      formData.append('image', file);
      // Free public client key for anonymous demo uploads
      const res = await fetch('https://api.imgbb.com/1/upload?key=6d207e02198a847aa5ad3ac2292fc10a', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json?.data?.url) {
        return {
          url: json.data.url,
          provider: 'ImgBB Cloud'
        };
      }
    } catch (err) {
      console.warn('ImgBB fallback failed:', err);
    }
  }

  throw new Error(`Cloud upload failed. ${failures.join(' | ')}`);
}
