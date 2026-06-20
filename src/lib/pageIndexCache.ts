/**
 * Cache simples em IndexedDB para o índice de texto por página do PDF.
 * Evita reindexar o livro toda vez que o leitor é aberto.
 */
const DB_NAME = "auraread-page-index";
const STORE = "pages";
const VERSION = 1;

export interface PageIndexEntry {
  bookId: string;
  pages: string[];
  numPages: number;
  indexedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "bookId" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
  return dbPromise;
};

export const getCachedPageIndex = async (
  bookId: string
): Promise<PageIndexEntry | null> => {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(bookId);
      req.onsuccess = () => resolve((req.result as PageIndexEntry) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[pageIndexCache] get error", err);
    return null;
  }
};

export const setCachedPageIndex = async (
  entry: PageIndexEntry
): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[pageIndexCache] set error", err);
  }
};

export const clearCachedPageIndex = async (bookId: string): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[pageIndexCache] delete error", err);
  }
};
