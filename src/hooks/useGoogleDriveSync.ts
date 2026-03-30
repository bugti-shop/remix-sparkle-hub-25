/**
 * useGoogleDriveSync — hook that manages auto-sync and manual sync with Google Drive.
 */
import { useEffect, useState, useCallback } from 'react';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { syncWithDrive, startAutoSync, stopAutoSync, setupManualSyncListener } from '@/utils/googleDriveSync';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'reauth';

export function useGoogleDriveSync() {
  const { user } = useGoogleAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    const handler = (e: CustomEvent<{ status: SyncStatus }>) => setStatus(e.detail.status);
    window.addEventListener('syncStatusChanged', handler as EventListener);
    return () => window.removeEventListener('syncStatusChanged', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!user) {
      stopAutoSync();
      return;
    }
    const cleanupManualSync = setupManualSyncListener();
    startAutoSync();
    return () => {
      cleanupManualSync();
      stopAutoSync();
    };
  }, [user?.email]);

  const triggerSync = useCallback(() => {
    if (status !== 'syncing') {
      syncWithDrive().catch(() => {});
    }
  }, [status]);

  return { status, triggerSync, isSyncing: status === 'syncing' };
}
