// Persistencia efimera de la BD demo en IndexedDB con TTL 24h.
//
// Al arrancar:
//   1. Si hay snapshot en IndexedDB y timestamp < 24h -> restaurar
//   2. Si no -> retornar null (el caller sembrara datos fresh)
//
// Cada vez que se muta la BD (via un save() debounced) guardamos el snapshot.

const DB_NAME = 'ruyx-office-demo';
const STORE_NAME = 'snapshots';
const KEY = 'main';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

function _openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Devuelve { data: Uint8Array, savedAt: number } o null si no hay/expirado.
export async function loadSnapshot() {
  try {
    const idb = await _openIdb();
    const tx = idb.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(KEY);
    const record = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    idb.close();
    if (!record) return null;
    const now = Date.now();
    if (!record.savedAt || now - record.savedAt > TTL_MS) {
      // Expirado -> lo borramos para no ocupar espacio
      await clearSnapshot();
      return null;
    }
    return record;
  } catch (e) {
    console.warn('[persistence] loadSnapshot fallo:', e);
    return null;
  }
}

// Guarda snapshot (Uint8Array). Reinicia el TTL.
export async function saveSnapshot(data) {
  try {
    const idb = await _openIdb();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ data, savedAt: Date.now() }, KEY);
    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    idb.close();
  } catch (e) {
    console.warn('[persistence] saveSnapshot fallo:', e);
  }
}

export async function clearSnapshot() {
  try {
    const idb = await _openIdb();
    const tx = idb.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(KEY);
    await new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    idb.close();
  } catch (e) {
    console.warn('[persistence] clearSnapshot fallo:', e);
  }
}

// Debouncer: agrupa multiples saves en uno. La app hace muchas mutaciones
// seguidas al crear una factura (INSERT factura + N INSERT lineas). Guardar
// tras cada una seria excesivo.
export function createSaveDebouncer(getDb, delayMs = 500) {
  let timer = null;
  return function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      try {
        const db = getDb();
        if (!db) return;
        const data = db.export();
        saveSnapshot(data);
      } catch (e) {
        console.warn('[persistence] save debounced fallo:', e);
      }
    }, delayMs);
  };
}
