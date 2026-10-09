import LZString from 'lz-string';
import { getMediaFromVault, storeMediaInVault } from './mediaVault';

/**
 * Generates a public globally-accessible QR viewer URL
 * NEVER puts large base64 data in the URL - only clean IDs or public HTTPS URLs
 * @param {Object} mediaData
 * @returns {string} Public clean URL
 */
export function getPublicBaseUrl() {
  const configured = (import.meta.env.VITE_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  return configured ? configured + '/' : window.location.origin + window.location.pathname;
}

/**
 * Returns reasons why a QR link would not open on another device:
 * the site is on localhost/private network, or the file only exists in this browser.
 */
export function getShareProblems(url, { checkUpload = true } = {}) {
  const problems = [];
  try {
    const host = new URL(url).hostname;
    if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host.endsWith('.local')) {
      problems.push(`This QR points to "${host}", which other devices cannot reach. Deploy the app (e.g. Vercel) and create the QR from the deployed site, or set VITE_PUBLIC_URL.`);
    }
  } catch {
    // ignore malformed URL
  }
  if (checkUpload && url.includes('#/view?') && !url.includes('url=') && !url.includes('v=')) {
    problems.push('The file is not uploaded to the cloud yet, so this QR only works in this browser. Click "Upload to Cloud & Create QR" first.');
  }
  return problems;
}

export function packMediaToViewerURL(mediaData) {
  const baseUrl = getPublicBaseUrl();
  const docId = mediaData.id || `doc_${Date.now()}`;
  
  // Store the full media in local IndexedDB vault for instant local preview/offline usage
  storeMediaInVault(mediaData);

  const params = new URLSearchParams();
  
  // Only include 'url' if it is a real public HTTP/HTTPS URL (NOT a base64 data: string!)
  const publicHttpUrl = (mediaData.cloudUrl && mediaData.cloudUrl.startsWith('http')) 
    ? mediaData.cloudUrl 
    : (mediaData.url && mediaData.url.startsWith('http')) 
      ? mediaData.url 
      : null;

  if (publicHttpUrl) {
    params.set('url', publicHttpUrl);
  } else {
    // If not a public URL yet, reference by clean local ID
    params.set('id', docId);
  }

  if (mediaData.type) params.set('t', mediaData.type);
  if (mediaData.fileName && mediaData.fileName.length < 80) params.set('fn', mediaData.fileName);
  if (mediaData.title && mediaData.title.length < 50) params.set('title', mediaData.title);
  if (mediaData.author && mediaData.author.length < 30) params.set('author', mediaData.author);
  if (mediaData.pin) params.set('pin', mediaData.pin);

  return `${baseUrl}#/view?${params.toString()}`;
}

/**
 * Unpacks a document or media object from URL hash / query parameters
 * Reads direct public cloud URL or checks local IndexedDB by ID
 * @param {string} hashOrQuery
 * @returns {Promise<Object|null>}
 */
export function parseViewerLinkSync(hashOrQuery) {
  try {
    const rawHash = hashOrQuery.replace(/^#\/?/, '').replace(/^\?/, '');
    const searchPart = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash;
    const params = new URLSearchParams(searchPart);
    const publicUrl = params.get('url');
    if (!publicUrl || !publicUrl.startsWith('http')) return null;
    return {
      id: params.get('id') || 'doc_' + publicUrl.slice(-24),
      type: params.get('t') || inferTypeFromUrl(publicUrl),
      title: params.get('title') || 'Attached Document',
      description: params.get('desc') || '',
      author: params.get('author') || '',
      fileName: params.get('fn') || '',
      dataUrl: publicUrl,
      url: publicUrl,
      cloudUrl: publicUrl,
      pin: params.get('pin') || '',
      timestamp: 0
    };
  } catch {
    return null;
  }
}

export async function unpackMediaFromURL(hashOrQuery) {
  try {
    const rawHash = hashOrQuery.replace(/^#\/?/, '').replace(/^\?/, '');
    const searchPart = rawHash.includes('?') ? rawHash.split('?')[1] : rawHash;
    const params = new URLSearchParams(searchPart);

    const publicUrl = params.get('url');
    const docId = params.get('id');
    const type = params.get('t') || inferTypeFromUrl(publicUrl);
    const title = params.get('title') || 'Attached Document';
    const description = params.get('desc') || '';
    const author = params.get('author') || '';
    const fileName = params.get('fn') || '';
    const pin = params.get('pin') || '';

    // 1. If public cloud URL is present, this works globally on any phone!
    if (publicUrl && publicUrl.startsWith('http')) {
      return {
        id: docId || `doc_${Date.now()}`,
        type: type || 'pdf',
        title,
        description,
        author,
        fileName,
        dataUrl: publicUrl,
        url: publicUrl,
        cloudUrl: publicUrl,
        pin,
        timestamp: Date.now()
      };
    }

    // 2. If docId is present, load from local IndexedDB Vault
    if (docId) {
      const fromVault = await getMediaFromVault(docId);
      if (fromVault) return fromVault;
    }

    // 3. Fallback: Check compressed v token if present
    const token = params.get('v');
    if (token) {
      const decompressed = LZString.decompressFromEncodedURIComponent(token);
      if (decompressed) {
        const raw = JSON.parse(decompressed);
        return {
          id: raw.id,
          type: raw.t,
          title: raw.n,
          description: raw.d,
          fileName: raw.fn,
          mimeType: raw.mt,
          dataUrl: raw.u,
          url: raw.u,
          author: raw.a,
          timestamp: raw.ts,
          pin: raw.p
        };
      }
    }

    return null;
  } catch (err) {
    console.error('Error unpacking media from URL:', err);
    return null;
  }
}

function inferTypeFromUrl(url) {
  if (!url) return 'file';
  const clean = url.toLowerCase().split('?')[0];
  if (clean.endsWith('.pdf')) return 'pdf';
  if (clean.match(/\.(jpg|jpeg|png|webp|gif|svg)$/)) return 'image';
  if (clean.match(/\.(mp4|webm|mov|mkv)$/)) return 'video';
  if (clean.match(/\.(mp3|wav|ogg|m4a)$/)) return 'audio';
  return 'file';
}

/**
 * Converts a File object to Data URL (Base64)
 */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image file before converting to Data URL if needed
 */
export async function compressImageFile(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Cannot decode image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Cannot read image'));
    reader.readAsDataURL(file);
  });
}
