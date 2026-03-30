/**
 * Google Drive Sync — THE primary data storage layer.
 * All app data is stored as JSON files in the user's Google Drive appDataFolder.
 * Supabase is used ONLY for authentication; all CRUD operations go through Drive.
 *
 * Architecture:
 * - On app open → download latest data from Drive → merge into local
 * - On save (notes/tasks/etc.) → upload changed data to Drive
 * - Background auto-sync every 5 minutes
 * - Token auto-refresh before every operation
 */

import { backgroundTokenRefresh, getValidAccessToken, getStoredGoogleUser, refreshGoogleToken } from '@/utils/googleAuth';
import {
  ConflictCategory,
  storeHash,
  mergeArraysById,
} from '@/utils/driveSyncConflict';
import {
  loadDeletions,
  saveDeletions,
  mergeDeletions,
  applyDeletions,
  DeletionRecord,
} from '@/utils/deletionTracker';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// No more auto-sync interval — sync is action-based only
// (upload on create/update/delete, download on app open + manual trigger)

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

const emitStatus = (status: SyncStatus) => {
  window.dispatchEvent(new CustomEvent('syncStatusChanged', { detail: { status } }));
};

// ── Token-aware fetch wrapper ─────────────────────────────────────────────

/**
 * Fetch with automatic token refresh on 401/403.
 * Retries up to 3 times with fresh tokens and exponential backoff.
 * Never forces logout — mirrors Firebase Auth's invisible re-auth behavior.
 */
const driveFetch = async (
  url: string,
  options: RequestInit = {},
  retryCount = 3,
): Promise<Response> => {
  let token = await getValidAccessToken();
  if (!token) throw new Error('Not signed in — no valid access token');

  const headers = {
    ...((options.headers as Record<string, string>) || {}),
    Authorization: `Bearer ${token}`,
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    // Network error — retry after backoff if we have retries left
    if (retryCount > 0) {
      await new Promise(r => setTimeout(r, 1000 * (4 - retryCount)));
      return driveFetch(url, options, retryCount - 1);
    }
    throw networkErr;
  }

  // If 401/403, refresh token and retry
  if ((res.status === 401 || res.status === 403) && retryCount > 0) {
    try {
      const refreshed = await refreshGoogleToken();
      token = refreshed.accessToken;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
      token = await getValidAccessToken();
      if (!token) throw new Error('Token refresh failed — no valid token available');
    }

    const retryHeaders = {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `Bearer ${token}`,
    };

    const retryRes = await fetch(url, { ...options, headers: retryHeaders });
    
    if ((retryRes.status === 401 || retryRes.status === 403) && retryCount > 1) {
      await new Promise(r => setTimeout(r, 2000));
      return driveFetch(url, options, retryCount - 1);
    }
    
    return retryRes;
  }

  return res;
};

// ── Drive CRUD primitives ─────────────────────────────────────────────────

/** Find a file by name in appDataFolder. Returns file ID or null. */
const findFile = async (fileName: string): Promise<string | null> => {
  const q = encodeURIComponent(`name='${fileName}' and 'appDataFolder' in parents and trashed=false`);
  const res = await driveFetch(
    `${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`,
  );
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = await res.json();
  return data.files?.[0]?.id || null;
};

/** Read a JSON file from Drive by file ID */
const readFile = async <T>(fileId: string): Promise<T> => {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`);
  if (!res.ok) throw new Error(`Drive read failed: ${res.status}`);
  return res.json();
};

/** Create a new JSON file in appDataFolder */
const createFile = async (fileName: string, data: any): Promise<string> => {
  const boundary = '---flowist-boundary';
  const metadata = {
    name: fileName,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const body = JSON.stringify(data);

  const multipart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  const result = await res.json();
  return result.id;
};

/** Update an existing file on Drive */
const updateFile = async (fileId: string, fileName: string, data: any): Promise<string> => {
  const boundary = '---flowist-boundary';
  const body = JSON.stringify(data);

  const multipart = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: fileName }),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await driveFetch(`${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
  const result = await res.json();
  return result.id;
};

/** Delete a file from Drive */
const deleteFile = async (fileId: string): Promise<void> => {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Drive delete failed: ${res.status}`);
  }
};

// ── High-level CRUD operations ────────────────────────────────────────────

/** Create or update a JSON file in appDataFolder (upsert) */
export const upsertFile = async (fileName: string, data: any): Promise<string> => {
  const existingId = await findFile(fileName);
  if (existingId) {
    return updateFile(existingId, fileName, data);
  }
  return createFile(fileName, data);
};

/** Download a named JSON file, returning null if it doesn't exist */
export const downloadFile = async <T>(fileName: string): Promise<T | null> => {
  const fileId = await findFile(fileName);
  if (!fileId) return null;
  return readFile<T>(fileId);
};

/** Delete a named file from appDataFolder */
export const deleteNamedFile = async (fileName: string): Promise<void> => {
  const fileId = await findFile(fileName);
  if (fileId) {
    await deleteFile(fileId);
  }
};

/**
 * Delete ALL Flowist data files from Google Drive appDataFolder.
 * Used when user deletes account or clears all app data.
 */
export const deleteAllDriveData = async (): Promise<void> => {
  const token = await getValidAccessToken();
  if (!token) return; // Not signed in — nothing to delete

  const allFiles = [
    'flowist_notes.json',
    'flowist_tasks.json',
    'flowist_habits.json',
    'flowist_folders.json',
    'flowist_tags.json',
    'flowist_settings.json',
    'flowist_streaks.json',
    'flowist_gamification.json',
    'flowist_journey.json',
    'flowist_deletions.json',
  ];

  await Promise.allSettled(
    allFiles.map((f) => deleteNamedFile(f).catch((e) => console.warn(`Failed to delete ${f}:`, e))),
  );
};

// ── Data categories & their loaders ───────────────────────────────────────

interface SyncCategory {
  fileName: string;
  conflictKey: ConflictCategory;
  selectiveSyncKey: string; // matches key in SelectiveSyncSheet
  load: () => Promise<any>;
  save: (data: any) => Promise<void>;
}

/** Check if a category is enabled for sync via selective sync preferences */
const isCategoryEnabled = async (selectiveSyncKey: string): Promise<boolean> => {
  const { getSetting } = await import('@/utils/settingsStorage');
  return getSetting<boolean>(selectiveSyncKey, true);
};

type SettingsArrayItem = {
  id: string;
  updatedAt?: any;
  modifiedAt?: any;
  createdAt?: any;
};

// Lazy imports to avoid circular dependencies
const getCategories = async (): Promise<SyncCategory[]> => {
  const { loadNotesFromDB, saveNotesToDB } = await import('@/utils/noteStorage');
  const { loadTasksFromDB, saveTasksToDB } = await import('@/utils/taskStorage');
  const { loadHabits, saveHabit } = await import('@/utils/habitStorage');
  const { loadFolders, saveFolders } = await import('@/utils/folderStorage');
  const { getAllSettings, setSetting } = await import('@/utils/settingsStorage');
  const { loadStreakData, saveStreakData } = await import('@/utils/streakStorage');
  const { loadAchievementsData } = await import('@/utils/gamificationStorage');
  const { loadJourneyData, saveJourneyData } = await import('@/utils/virtualJourneyStorage');
  const { getAllTags, saveAllTags } = await import('@/utils/tagStorage');

  return [
    {
      fileName: 'flowist_notes.json',
      conflictKey: 'notes',
      selectiveSyncKey: 'sync_notes',
      load: loadNotesFromDB,
      save: async (data: any) => { await saveNotesToDB(data); },
    },
    {
      fileName: 'flowist_tasks.json',
      conflictKey: 'tasks',
      selectiveSyncKey: 'sync_tasks',
      load: loadTasksFromDB,
      save: async (data: any) => { await saveTasksToDB(data); },
    },
    {
      fileName: 'flowist_habits.json',
      conflictKey: 'habits',
      selectiveSyncKey: 'sync_habits',
      load: loadHabits,
      save: async (data: any[]) => {
        for (const h of data) await saveHabit(h);
      },
    },
    {
      fileName: 'flowist_folders.json',
      conflictKey: 'folders',
      selectiveSyncKey: 'sync_folders',
      load: loadFolders,
      save: saveFolders,
    },
    {
      fileName: 'flowist_tags.json',
      conflictKey: 'tags',
      selectiveSyncKey: 'sync_notes', // tags are part of notes ecosystem
      load: getAllTags,
      save: async (data: any[]) => { await saveAllTags(data); },
    },
    {
      fileName: 'flowist_settings.json',
      conflictKey: 'settings',
      selectiveSyncKey: 'sync_settings',
      load: getAllSettings,
      save: async (data: Record<string, any>) => {
        for (const [key, value] of Object.entries(data)) {
          if (key === 'googleUser' || key.startsWith('flowist_last_drive')) continue;
          await setSetting(key, value);
        }
      },
    },
    {
      fileName: 'flowist_streaks.json',
      conflictKey: 'streaks',
      selectiveSyncKey: 'sync_streaks',
      load: () => loadStreakData('flowist_task_streak'),
      save: (data: any) => saveStreakData('flowist_task_streak', data),
    },
    {
      fileName: 'flowist_gamification.json',
      conflictKey: 'gamification',
      selectiveSyncKey: 'sync_streaks', // gamification grouped with streaks
      load: loadAchievementsData,
      save: async (data: any) => {
        await setSetting('flowist_achievements', data);
      },
    },
    {
      fileName: 'flowist_journey.json',
      conflictKey: 'journey',
      selectiveSyncKey: 'sync_journey',
      load: async () => loadJourneyData(),
      save: async (data: any) => { saveJourneyData(data); },
    },
  ];
};

const SETTINGS_ARRAY_KEYS_TO_MERGE = ['folders', 'todoFolders', 'todoSections'] as const;

const isSettingsArrayWithIds = (value: unknown): value is SettingsArrayItem[] => {
  return (
    Array.isArray(value) &&
    value.every((item) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string')
  );
};

const mergeSettingsData = (
  localData: Record<string, any>,
  remoteData: Record<string, any>,
  deletions?: DeletionRecord[],
): Record<string, any> => {
  const merged = { ...localData, ...remoteData };

  for (const key of SETTINGS_ARRAY_KEYS_TO_MERGE) {
    const localValue = localData?.[key];
    const remoteValue = remoteData?.[key];

    if (isSettingsArrayWithIds(localValue) && isSettingsArrayWithIds(remoteValue)) {
      let mergedArray = mergeArraysById(localValue, remoteValue);
      // Apply deletion tracking for note folders and todo settings arrays
      if (deletions && (key === 'folders' || key === 'todoSections' || key === 'todoFolders')) {
        const delCat = key === 'folders' ? 'noteFolders' : key as DeletionRecord['category'];
        const deletedIds = new Set(
          deletions.filter((r) => r.category === delCat).map((r) => r.id),
        );
        mergedArray = mergedArray.filter((item: any) => !deletedIds.has(item.id));
      }
      merged[key] = mergedArray;
    }
  }

  return merged;
};

/**
 * Smart merge for Virtual Journey data — keeps the more progressed version
 * for each journey and preserves the active journey selection.
 */
const mergeJourneyData = (local: any, remote: any): any => {
  const l = local || {};
  const r = remote || {};
  const mergedProgress: Record<string, any> = { ...r.journeyProgress };
  if (l.journeyProgress && typeof l.journeyProgress === 'object') {
    for (const [key, localP] of Object.entries(l.journeyProgress)) {
      const remoteP = mergedProgress[key] as any;
      if (!remoteP) {
        mergedProgress[key] = localP;
      } else {
        const lTasks = Number((localP as any)?.tasksCompleted) || 0;
        const rTasks = Number(remoteP?.tasksCompleted) || 0;
        if (lTasks > rTasks) mergedProgress[key] = localP;
        const lReached = Array.isArray((localP as any)?.milestonesReached) ? (localP as any).milestonesReached : [];
        const rReached = Array.isArray(remoteP?.milestonesReached) ? remoteP.milestonesReached : [];
        const winner = mergedProgress[key] as any;
        winner.milestonesReached = [...new Set([...lReached, ...rReached])];
        winner.milestonesReachedAt = { ...(remoteP?.milestonesReachedAt || {}), ...((localP as any)?.milestonesReachedAt || {}), ...(winner.milestonesReachedAt || {}) };
      }
    }
  }
  const lCompleted = Array.isArray(l.completedJourneys) ? l.completedJourneys : [];
  const rCompleted = Array.isArray(r.completedJourneys) ? r.completedJourneys : [];
  const activeJourneyId = l.activeJourneyId || r.activeJourneyId || null;
  return {
    activeJourneyId,
    completedJourneys: [...new Set([...lCompleted, ...rCompleted])],
    journeyProgress: mergedProgress,
    totalTasksEver: Math.max(Number(l.totalTasksEver) || 0, Number(r.totalTasksEver) || 0),
  };
};

// ── Sync timestamps ───────────────────────────────────────────────────────

const LAST_SYNC_KEY = 'flowist_last_drive_sync';

const getLastSyncTime = async (): Promise<number> => {
  const { getSetting } = await import('@/utils/settingsStorage');
  return getSetting<number>(LAST_SYNC_KEY, 0);
};

const setLastSyncTime = async () => {
  const { setSetting } = await import('@/utils/settingsStorage');
  await setSetting(LAST_SYNC_KEY, Date.now());
};

// ── Upload (push local → Drive) ──────────────────────────────────────────

export const uploadToDrive = async (): Promise<void> => {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not signed in');

  const categories = await getCategories();

  // Upload all categories + deletions in parallel for speed
  await Promise.allSettled([
    ...categories.map(async (cat) => {
      try {
        // Check selective sync preference
        const enabled = await isCategoryEnabled(cat.selectiveSyncKey);
        if (!enabled) return;

        const data = await cat.load();
        if (data !== null && data !== undefined) {
          await upsertFile(cat.fileName, data);
          await storeHash(cat.conflictKey, data);
        }
      } catch (err) {
        console.warn(`Failed to upload ${cat.fileName}:`, err);
      }
    }),
    // Always upload deletion records
    upsertFile('flowist_deletions.json', loadDeletions()).catch((err) =>
      console.warn('Failed to upload deletions:', err),
    ),
  ]);

  await setLastSyncTime();
};

// ── Download (pull Drive → local) with conflict detection ────────────────

export const downloadFromDrive = async (): Promise<void> => {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Not signed in');

  // 1. Sync deletion records first
  const remoteDeletions = await downloadFile<DeletionRecord[]>('flowist_deletions.json');
  const localDeletions = loadDeletions();
  const mergedDeletions = mergeDeletions(localDeletions, remoteDeletions || []);
  saveDeletions(mergedDeletions);

  const categories = await getCategories();

  // 2. Auto-merge each category in parallel for speed
  const enabledCategories = await Promise.all(
    categories.map(async (cat) => ({
      cat,
      enabled: await isCategoryEnabled(cat.selectiveSyncKey),
    })),
  );

  await Promise.allSettled(
    enabledCategories
      .filter(({ enabled }) => enabled)
      .map(async ({ cat }) => {
        try {
          const [remoteData, localData] = await Promise.all([
            downloadFile<any>(cat.fileName),
            cat.load(),
          ]);
          if (remoteData === null || remoteData === undefined) return;

          let merged: any;

          if (Array.isArray(localData) && Array.isArray(remoteData)) {
            merged = mergeArraysById(localData, remoteData);
            const deletionCategory = cat.conflictKey as DeletionRecord['category'];
            if (['notes', 'tasks', 'habits', 'folders'].includes(deletionCategory)) {
              merged = applyDeletions(merged, mergedDeletions, deletionCategory);
            }
          } else if (remoteData && typeof remoteData === 'object' && !Array.isArray(remoteData)) {
            if (cat.conflictKey === 'settings') {
              merged = mergeSettingsData(localData || {}, remoteData || {}, mergedDeletions);
            } else if (cat.conflictKey === 'journey') {
              merged = mergeJourneyData(localData || {}, remoteData || {});
            } else {
              merged = { ...localData, ...remoteData };
            }
          } else {
            merged = remoteData;
          }

          await cat.save(merged);
          await storeHash(cat.conflictKey, merged);
        } catch (err) {
          console.warn(`Failed to download ${cat.fileName}:`, err);
        }
      }),
  );

  await setLastSyncTime();
};

// ── Upload a single category (for save-on-change) ────────────────────────

/**
 * Upload a single data category to Drive immediately.
 * Called when the user saves a note/task/etc. for real-time sync.
 * Emits sync status events so the header indicator updates.
 */
export const uploadCategory = async (
  fileName: string,
  data: any,
): Promise<void> => {
  const token = await getValidAccessToken();
  if (!token) return; // Not signed in — skip silently

  try {
    emitStatus('syncing');
    await upsertFile(fileName, data);
    emitStatus('synced');
    setTimeout(() => emitStatus('idle'), 3000);
  } catch (err) {
    console.warn(`Failed to upload category ${fileName}:`, err);
    emitStatus('error');
    setTimeout(() => emitStatus('idle'), 5000);
  }
};

// Convenience helpers for common save-on-change scenarios
export const syncNotesToDrive = async () => {
  const { loadNotesFromDB } = await import('@/utils/noteStorage');
  const data = await loadNotesFromDB();
  if (data) await uploadCategory('flowist_notes.json', data);
};

export const syncTasksToDrive = async () => {
  const { loadTasksFromDB } = await import('@/utils/taskStorage');
  const data = await loadTasksFromDB();
  if (data) await uploadCategory('flowist_tasks.json', data);
};

export const syncHabitsToDrive = async () => {
  const { loadHabits } = await import('@/utils/habitStorage');
  const data = await loadHabits();
  if (data) await uploadCategory('flowist_habits.json', data);
};

export const syncFoldersToDrive = async () => {
  const { loadFolders } = await import('@/utils/folderStorage');
  const data = await loadFolders();
  if (data) await uploadCategory('flowist_folders.json', data);
};

export const syncSettingsToDrive = async () => {
  const { getAllSettings } = await import('@/utils/settingsStorage');
  const data = await getAllSettings();
  if (data) await uploadCategory('flowist_settings.json', data);
};

export const syncTagsToDrive = async () => {
  const { getAllTags } = await import('@/utils/tagStorage');
  const data = await getAllTags();
  if (data) await uploadCategory('flowist_tags.json', data);
};

// ── Full sync (download → upload → mark synced) ─────────────────────────

export const syncWithDrive = async (): Promise<void> => {
  const user = await getStoredGoogleUser();
  if (!user) return;

  if (!navigator.onLine) {
    emitStatus('offline');
    return;
  }

  try {
    emitStatus('syncing');

    // First download remote data to merge
    await downloadFromDrive();

    // Then upload local data (which now includes merged remote data)
    await uploadToDrive();

    emitStatus('synced');

    // Auto-clear synced status after 5 seconds
    setTimeout(() => emitStatus('idle'), 5000);
  } catch (err) {
    console.error('Google Drive sync failed:', err);
    emitStatus('error');
    // Auto-clear error after 30s so next retry cycle shows proper state
    setTimeout(() => emitStatus('idle'), 30000);
  }
};

// ── Initial download on login (one-time, no recurring timer) ─────────────

let hasInitialSynced = false;
let autoSyncInterval: ReturnType<typeof setInterval> | null = null;
const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes — continuous background sync

/**
 * Start continuous background sync with Google Drive.
 * - Initial download on login
 * - Full sync every 5 minutes for 24/7 data freshness
 * - Offline queue processing on reconnect
 */
export const startAutoSync = () => {
  if (hasInitialSynced) return;
  hasInitialSynced = true;

  // Download latest from Drive once on login
  setTimeout(() => {
    downloadFromDrive().catch(() => {});
  }, 5000);

  // Recurring full sync every 5 minutes for 24/7 Drive sync
  autoSyncInterval = setInterval(() => {
    if (!navigator.onLine) return;
    backgroundTokenRefresh()
      .catch(() => {})
      .then(() => syncWithDrive().catch(() => {}));
  }, AUTO_SYNC_INTERVAL);

  // Wire up offline queue processing on reconnect
  window.addEventListener('processOfflineQueue', handleOfflineQueueProcessing);
};

const handleOfflineQueueProcessing = async () => {
  try {
    const { processOfflineQueue } = await import('@/utils/offlineSyncQueue');
    await processOfflineQueue({
      notes: syncNotesToDrive,
      tasks: syncTasksToDrive,
      folders: syncFoldersToDrive,
      tags: syncTagsToDrive,
      habits: syncHabitsToDrive,
      settings: syncSettingsToDrive,
      journey: async () => {
        const { loadJourneyData } = await import('@/utils/virtualJourneyStorage');
        const data = await loadJourneyData();
        if (data) await uploadCategory('flowist_journey.json', data);
      },
    });
  } catch (err) {
    console.warn('Failed to process offline queue:', err);
  }
};

export const stopAutoSync = () => {
  hasInitialSynced = false;
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  window.removeEventListener('processOfflineQueue', handleOfflineQueueProcessing);
};

// ── Manual sync trigger ──────────────────────────────────────────────────

let manualSyncListenerAttached = false;

const handleManualSync = () => {
  syncWithDrive().catch(() => {});
};

const teardownManualSyncListener = () => {
  if (!manualSyncListenerAttached) return;
  window.removeEventListener('triggerManualSync', handleManualSync);
  manualSyncListenerAttached = false;
};

export const setupManualSyncListener = (): (() => void) => {
  if (!manualSyncListenerAttached) {
    window.addEventListener('triggerManualSync', handleManualSync);
    manualSyncListenerAttached = true;
  }

  return teardownManualSyncListener;
};
