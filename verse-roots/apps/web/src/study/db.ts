import type { Study } from './types';

const DB_NAME = 'verse-roots-studies';
const DB_VERSION = 1;
const STORE_NAME = 'studies';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openStudyDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('verseRef',     'verseRef',     { unique: false });
        store.createIndex('updatedAt',    'updatedAt',    { unique: false });
        store.createIndex('focusStrongs', 'focusStrongs', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    req.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

export async function saveStudy(study: Study): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(study);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getStudy(id: string): Promise<Study | null> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as Study) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllStudies(): Promise<Study[]> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('updatedAt');
    const results: Study[] = [];
    // Open cursor in descending order
    const req = index.openCursor(null, 'prev');
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        results.push(cursor.value as Study);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getStudiesByVerse(verseRef: string): Promise<Study[]> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('verseRef');
    const results: Study[] = [];
    const req = index.openCursor(IDBKeyRange.only(verseRef));
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        results.push(cursor.value as Study);
        cursor.continue();
      } else {
        // Sort by updatedAt desc
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getStudiesByStrongs(strongs: string): Promise<Study[]> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('focusStrongs');
    const results: Study[] = [];
    const req = index.openCursor(IDBKeyRange.only(strongs));
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        results.push(cursor.value as Study);
        cursor.continue();
      } else {
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteStudy(id: string): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
