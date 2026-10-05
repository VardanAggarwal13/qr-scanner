const SCANS_STORAGE_KEY = 'qr_scans_history_v1';
const CREATED_STORAGE_KEY = 'qr_created_documents_v1';

/**
 * Gets all saved scan history
 */
export function getScanHistory() {
  try {
    const raw = localStorage.getItem(SCANS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

/**
 * Saves a new scan to history
 */
export function addScanToHistory(scanItem) {
  try {
    const history = getScanHistory();
    const newItem = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      favorite: false,
      ...scanItem
    };
    // Avoid duplicate continuous scans within 5 seconds with exact same rawValue
    if (history.length > 0 && history[0].rawValue === newItem.rawValue && (newItem.timestamp - history[0].timestamp < 5000)) {
      return history[0];
    }
    const updated = [newItem, ...history].slice(0, 200); // keep max 200
    localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * Toggles favorite on a scan item
 */
export function toggleScanFavorite(id) {
  try {
    const history = getScanHistory();
    const updated = history.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item);
    localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error(e);
    return [];
  }
}

/**
 * Deletes a scan from history
 */
export function deleteScanFromHistory(id) {
  try {
    const history = getScanHistory();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error(e);
    return [];
  }
}

/**
 * Clears all scan history
 */
export function clearScanHistory() {
  localStorage.removeItem(SCANS_STORAGE_KEY);
}

/**
 * Gets all user-created document QR codes
 */
export function getCreatedDocuments() {
  try {
    const raw = localStorage.getItem(CREATED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

/**
 * Saves a created document QR code
 */
export function saveCreatedDocument(docItem) {
  try {
    const docs = getCreatedDocuments();
    const newItem = {
      id: docItem.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      ...docItem
    };
    const updated = [newItem, ...docs.filter(d => d.id !== newItem.id)];
    localStorage.setItem(CREATED_STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 * Deletes a created document
 */
export function deleteCreatedDocument(id) {
  try {
    const docs = getCreatedDocuments();
    const updated = docs.filter(d => d.id !== id);
    localStorage.setItem(CREATED_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error(e);
    return [];
  }
}
