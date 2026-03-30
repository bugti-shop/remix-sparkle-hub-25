import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Loader2, Check, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline' | 'reauth';

const handleReauthTap = (signIn: (explicit?: boolean) => Promise<any>) => {
  if (Capacitor.isNativePlatform()) {
    toast.info('Go to Profile → Sign in with Google to reconnect sync');
  } else {
    signIn().catch(() => {});
  }
};

/** Compact dot indicator for headers — only shows when logged in */
export function SyncStatusDot({ className }: { className?: string }) {
  const { user, signIn } = useGoogleAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    const handler = (e: CustomEvent<{ status: SyncStatus }>) => setStatus(e.detail.status);
    window.addEventListener('syncStatusChanged', handler as EventListener);
    return () => window.removeEventListener('syncStatusChanged', handler as EventListener);
  }, []);

  if (!user || status === 'idle') return null;

  if (status === 'reauth') {
    return (
      <button
        onClick={() => handleReauthTap(signIn)}
        className={cn('relative', className)}
        title="Tap to reconnect sync"
      >
        <Cloud className="h-4 w-4 text-amber-500" />
        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-amber-500 animate-pulse" />
      </button>
    );
  }

  const dotColor = {
    syncing: 'bg-primary animate-pulse',
    synced: 'bg-emerald-500',
    error: 'bg-destructive',
    offline: 'bg-muted-foreground',
  }[status];

  const title = {
    syncing: 'Syncing...',
    synced: 'Synced',
    error: 'Sync error',
    offline: 'Offline',
  }[status];

  return (
    <div className={cn('relative', className)} title={title}>
      <Cloud className="h-4 w-4 text-muted-foreground" />
      <span className={cn('absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background', dotColor)} />
    </div>
  );
}

/** Full indicator with label — used on Profile page */
export function SyncStatusIndicator({ className }: { className?: string }) {
  const { signIn } = useGoogleAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    const handler = (e: CustomEvent<{ status: SyncStatus }>) => setStatus(e.detail.status);
    window.addEventListener('syncStatusChanged', handler as EventListener);
    return () => window.removeEventListener('syncStatusChanged', handler as EventListener);
  }, []);

  if (status === 'idle') return null;

  if (status === 'reauth') {
    return (
      <button
        onClick={() => handleReauthTap(signIn)}
        className={cn('flex items-center gap-1.5 text-xs text-amber-500', className)}
      >
        <LogIn className="h-3.5 w-3.5" />
        <span>Tap to reconnect sync</span>
      </button>
    );
  }

  const config = {
    syncing: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Syncing...', color: 'text-primary' },
    synced: { icon: <Check className="h-3.5 w-3.5" />, label: 'Synced', color: 'text-emerald-500' },
    error: { icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Sync error', color: 'text-destructive' },
    offline: { icon: <CloudOff className="h-3.5 w-3.5" />, label: 'Offline', color: 'text-muted-foreground' },
  }[status] || { icon: <Cloud className="h-3.5 w-3.5" />, label: '', color: '' };

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', config.color, className)}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}

/** Sync Now button for Profile */
export function SyncNowButton({ className }: { className?: string }) {
  const { user, signIn } = useGoogleAuth();
  const [status, setStatus] = useState<SyncStatus>('idle');

  useEffect(() => {
    const handler = (e: CustomEvent<{ status: SyncStatus }>) => setStatus(e.detail.status);
    window.addEventListener('syncStatusChanged', handler as EventListener);
    return () => window.removeEventListener('syncStatusChanged', handler as EventListener);
  }, []);

  if (!user) return null;

  const isSyncing = status === 'syncing';
  const needsReauth = status === 'reauth';

  return (
    <Button
      onClick={() => {
        if (needsReauth) {
          handleReauthTap(signIn);
        } else if (!isSyncing) {
          window.dispatchEvent(new Event('triggerManualSync'));
        }
      }}
      disabled={isSyncing}
      className={cn(
        'h-11 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-primary-foreground border-b-4 border-[hsl(var(--primary-darker))] shadow-[0_10px_22px_hsl(var(--primary)/0.22)] hover:bg-[hsl(var(--primary-dark))] active:border-b-0 active:translate-y-1',
        needsReauth && 'bg-amber-500 border-amber-700 shadow-[0_10px_22px_hsl(38,92%,50%,0.22)] hover:bg-amber-600',
        className
      )}
    >
      {needsReauth ? (
        <>
          <LogIn className="h-4 w-4" />
          Reconnect Sync
        </>
      ) : (
        <>
          <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </>
      )}
    </Button>
  );
}
