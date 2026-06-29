import type { Study, StudyGroup } from './types';
import type { MemoryItem } from './memory';

const DB_NAME = 'verse-roots-studies';
const DB_VERSION = 4;
const STORE_NAME = 'studies';

let dbPromise: Promise<IDBDatabase> | null = null;

// ── Change notifications (used by the cloud-sync layer) ──
export type SyncKind = 'study' | 'group' | 'memory';
export type SyncChange =
  | { kind: SyncKind; op: 'put'; id: string; data: unknown }
  | { kind: SyncKind; op: 'delete'; id: string };

let changeListener: ((c: SyncChange) => void) | null = null;
export function setSyncChangeListener(fn: ((c: SyncChange) => void) | null): void {
  changeListener = fn;
}
function emitChange(c: SyncChange): void {
  if (changeListener) changeListener(c);
}

export function openStudyDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const target = event.target as IDBOpenDBRequest;
      const db = target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('verseRef',     'verseRef',     { unique: false });
        store.createIndex('updatedAt',    'updatedAt',    { unique: false });
        store.createIndex('focusStrongs', 'focusStrongs', { unique: false });
      }
      if (event.oldVersion < 2) {
        db.createObjectStore('groups', { keyPath: 'id' });
      }
      if (event.oldVersion < 3) {
        // Index passage reflections so we can look up existing journals on a passage.
        const store = target.transaction!.objectStore(STORE_NAME);
        if (!store.indexNames.contains('passageRef')) {
          store.createIndex('passageRef', 'passageRef', { unique: false });
        }
      }
      if (event.oldVersion < 4) {
        if (!db.objectStoreNames.contains('memoryItems')) {
          db.createObjectStore('memoryItems', { keyPath: 'id' });
        }
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
    req.onsuccess = () => { emitChange({ kind: 'study', op: 'put', id: study.id, data: study }); resolve(); };
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

export async function getStudiesByPassage(passageRef: string): Promise<Study[]> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('passageRef');
    const results: Study[] = [];
    const req = index.openCursor(IDBKeyRange.only(passageRef));
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
    req.onsuccess = () => { emitChange({ kind: 'study', op: 'delete', id }); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllGroups(): Promise<StudyGroup[]> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('groups', 'readonly');
    const store = tx.objectStore('groups');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as StudyGroup[]).sort((a, b) => a.createdAt - b.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function saveGroup(group: StudyGroup): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('groups', 'readwrite');
    const store = tx.objectStore('groups');
    const req = store.put(group);
    req.onsuccess = () => { emitChange({ kind: 'group', op: 'put', id: group.id, data: group }); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('groups', 'readwrite');
    const store = tx.objectStore('groups');
    const req = store.delete(id);
    req.onsuccess = () => { emitChange({ kind: 'group', op: 'delete', id }); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

// ── Memory Verses ──

export async function getAllMemoryItems(): Promise<MemoryItem[]> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('memoryItems', 'readonly');
    const store = tx.objectStore('memoryItems');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as MemoryItem[]).sort((a, b) => b.addedAt - a.addedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function saveMemoryItem(item: MemoryItem): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('memoryItems', 'readwrite');
    const req = tx.objectStore('memoryItems').put(item);
    req.onsuccess = () => { emitChange({ kind: 'memory', op: 'put', id: item.id, data: item }); resolve(); };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMemoryItem(id: string): Promise<void> {
  const db = await openStudyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('memoryItems', 'readwrite');
    const req = tx.objectStore('memoryItems').delete(id);
    req.onsuccess = () => { emitChange({ kind: 'memory', op: 'delete', id }); resolve(); };
    req.onerror = () => reject(req.error);
  });
}
