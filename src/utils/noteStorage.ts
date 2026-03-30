import { Note } from '@/types/note';
import { getSetting, setSetting } from '@/utils/settingsStorage';

const DB_NAME = 'nota-notes-db';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

let db: IDBDatabase | null = null;

const toValidDate = (value: unknown, fallback = new Date()): Date => {
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isFinite(date.getTime()) ? date : fallback;
};

const toOptionalDate = (value: unknown): Date | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isFinite(date.getTime()) ? date : undefined;
};

const toOptionalIso = (value: unknown): string | undefined => {
  const date = toOptionalDate(value);
  return date?.toISOString();
};

const hydrateVoiceRecordings = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((recording: any) => ({
    ...recording,
    timestamp: toValidDate(recording?.timestamp),
  }));
};

const hydrateNote = (note: any): Note => ({
  ...note,
  createdAt: toValidDate(note?.createdAt),
  updatedAt: toValidDate(note?.updatedAt),
  archivedAt: toOptionalDate(note?.archivedAt),
  deletedAt: toOptionalDate(note?.deletedAt),
  reminderTime: toOptionalDate(note?.reminderTime),
  voiceRecordings: hydrateVoiceRecordings(note?.voiceRecordings),
});

const serializeNote = (note: Note) => ({
  ...note,
  createdAt: toValidDate(note.createdAt).toISOString(),
  updatedAt: toValidDate(note.updatedAt).toISOString(),
  archivedAt: toOptionalIso(note.archivedAt),
  deletedAt: toOptionalIso(note.deletedAt),
  reminderTime: toOptionalIso(note.reminderTime),
  voiceRecordings: hydrateVoiceRecordings(note.voiceRecordings).map(r => ({
    ...r,
    timestamp: toValidDate(r.timestamp).toISOString(),
  })),
});

const isDbHealthy = (database: IDBDatabase): boolean => {
  try {
    if (!database.objectStoreNames.contains(STORE_NAME)) return false;
    const tx = database.transaction([STORE_NAME], 'readonly');
    tx.abort();
    return true;
  } catch {
    return false;
  }
};

const resetDb = () => {
  if (db) {
    try { db.close(); } catch {}
  }
  db = null;
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db && isDbHealthy(db)) {
      resolve(db);
      return;
    }
    resetDb();

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Timeout: if IndexedDB doesn't open in 5s, reject
    const timeout = setTimeout(() => {
      reject(new Error('Notes IndexedDB open timed out'));
    }, 5000);

    request.onerror = () => {
      clearTimeout(timeout);
      console.error('Failed to open notes database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      clearTimeout(timeout);
      db = request.result;
      db.onclose = () => { db = null; };
      db.onversionchange = () => { resetDb(); };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('folderId', 'folderId', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
};

const withRetry = async <T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> => {
  try {
    const database = await openDB();
    return await operation(database);
  } catch (error) {
    console.warn('IndexedDB operation failed, retrying with fresh connection...', error);
    resetDb();
    const database = await openDB();
    return await operation(database);
  }
};

export const loadNotesFromDB = async (): Promise<Note[]> => {
  try {
    return await withRetry((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result.map(hydrateNote);
        resolve(notes);
      };

      request.onerror = () => {
        console.error('Failed to load notes:', request.error);
        reject(request.error);
      };
    }));
  } catch (error) {
    console.error('Error loading notes from IndexedDB:', error);
    return [];
  }
};

export const saveNotesToDB = async (notes: Note[], skipSyncEvent = false): Promise<void> => {
  try {
    await withRetry((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const noteIds = new Set(notes.map(n => n.id));
      
      const getAllRequest = store.getAllKeys();
      getAllRequest.onsuccess = () => {
        const existingKeys = getAllRequest.result as string[];
        existingKeys.forEach(key => {
          if (!noteIds.has(key)) {
            store.delete(key);
          }
        });
        
        notes.forEach(note => {
          store.put(serializeNote(hydrateNote(note)));
        });
      };

      transaction.oncomplete = () => {
        if (!skipSyncEvent) window.dispatchEvent(new Event('notesUpdated'));
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch (error) {
    console.error('Error saving notes to IndexedDB:', error);
  }
};

export const saveNoteToDBSingle = async (note: Note): Promise<void> => {
  try {
    await withRetry((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      store.put(serializeNote(hydrateNote(note)));

      transaction.oncomplete = () => {
        window.dispatchEvent(new Event('notesUpdated'));
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch (error) {
    console.error('Error saving single note to IndexedDB:', error);
  }
};

export const deleteNoteFromDB = async (noteId: string): Promise<void> => {
  try {
    await withRetry((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(noteId);

      transaction.oncomplete = () => {
        window.dispatchEvent(new Event('notesUpdated'));
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    }));

    // Track deletion for cross-device sync and upload immediately
    import('@/utils/deletionTracker').then(({ trackDeletion, loadDeletions }) => {
      trackDeletion(noteId, 'notes');
      import('@/utils/googleDriveSync').then(({ uploadCategory }) => {
        uploadCategory('flowist_deletions.json', loadDeletions()).catch(() => {});
      });
    });
  } catch (error) {
    console.error('Error deleting note from IndexedDB:', error);
  }
};

// Migration from localStorage to IndexedDB (one-time)
export const migrateNotesToIndexedDB = async (): Promise<boolean> => {
  
  try {
    const migrated = await getSetting('notes_migrated_to_indexeddb', false);
    if (migrated) return false;

    // Check if there are notes in old localStorage (for backward compatibility during migration)
    let oldNotes: Note[] = [];
    try {
      const saved = localStorage.getItem('notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        oldNotes = parsed.map((n: Note) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
          voiceRecordings: n.voiceRecordings?.map((r: any) => ({
            ...r,
            timestamp: new Date(r.timestamp),
          })) || [],
        }));
      }
    } catch {}

    if (oldNotes.length > 0) {
      await saveNotesToDB(oldNotes);
      await setSetting('notes_migrated_to_indexeddb', true);
      // Clear localStorage
      try { localStorage.removeItem('notes'); } catch {}
      console.log(`Migrated ${oldNotes.length} notes to IndexedDB`);
      return true;
    }
    
    await setSetting('notes_migrated_to_indexeddb', true);
    return false;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
};

// Debounced save function to prevent excessive writes
let saveTimeout: NodeJS.Timeout | null = null;
export const debouncedSaveNotes = (notes: Note[], delay: number = 500): void => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveNotesToDB(notes);
  }, delay);
};

// Content compression for large notes
export const compressContent = (content: string): string => {
  // Simple compression: remove excessive whitespace
  return content
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
};

// Split large content into chunks for storage
export const splitLargeContent = (content: string, maxChunkSize: number = 500000): string[] => {
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    chunks.push(content.slice(start, start + maxChunkSize));
    start += maxChunkSize;
  }
  return chunks;
};

// Get storage usage estimate
export const getStorageUsage = async (): Promise<{ used: number; quota: number }> => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  }
  return { used: 0, quota: 0 };
};
