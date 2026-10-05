// IndexedDB Vault for Storing Attached Documents, PDFs, Images, and Audio/Video files
const DB_NAME = 'QRNovaMediaVault';
const DB_VERSION = 1;
const STORE_NAME = 'media_documents';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Stores a document/media in IndexedDB
 * @param {Object} item - { id, type, title, description, fileName, mimeType, dataUrl, author, timestamp, pin }
 */
export async function storeMediaInVault(item) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error saving to media vault:', err);
    // Fallback to localStorage for small items if IndexedDB fails
    try {
      localStorage.setItem(`vault_${item.id}`, JSON.stringify(item));
      return item;
    } catch (e) {
      console.error('LocalStorage fallback also failed:', e);
      return item;
    }
  }
}

/**
 * Retrieves a document/media from IndexedDB by ID
 * @param {string} id
 */
export async function getMediaFromVault(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          // Check localStorage fallback
          const local = localStorage.getItem(`vault_${id}`);
          resolve(local ? JSON.parse(local) : null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error fetching from media vault:', err);
    const local = localStorage.getItem(`vault_${id}`);
    return local ? JSON.parse(local) : null;
  }
}

/**
 * Lists all stored documents
 */
export async function listMediaFromVault() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error listing media vault:', err);
    return [];
  }
}
