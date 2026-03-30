/**
 * Route prefetching — preloads lazy route chunks on hover/touch/idle.
 * Maps route paths to their dynamic import() so the chunk loads before navigation.
 */

const prefetchedRoutes = new Set<string>();

const ROUTE_IMPORTS: Record<string, () => Promise<any>> = {
  '/notes': () => import('@/pages/Notes'),
  '/calendar': () => import('@/pages/NotesCalendar'),
  '/profile': () => import('@/pages/Profile'),
  '/settings': () => import('@/pages/Settings'),
  '/todo/today': () => Promise.resolve(), // eagerly loaded
  '/todo/progress': () => import('@/pages/todo/Progress'),
  '/todo/calendar': () => import('@/pages/todo/TodoCalendar'),
  '/todo/settings': () => import('@/pages/todo/TodoSettings'),
  '/': () => Promise.resolve(), // eagerly loaded
};

/** Prefetch a single route chunk (idempotent, no-op if already loaded) */
export function prefetchRoute(path: string): void {
  if (prefetchedRoutes.has(path)) return;
  const loader = ROUTE_IMPORTS[path];
  if (!loader) return;
  prefetchedRoutes.add(path);
  loader().catch(() => {
    // Allow retry on failure
    prefetchedRoutes.delete(path);
  });
}

/** Prefetch all lazy routes during idle time */
export function prefetchAllOnIdle(): void {
  const prefetchAll = () => {
    Object.keys(ROUTE_IMPORTS).forEach(prefetchRoute);
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetchAll, { timeout: 5000 });
  } else {
    setTimeout(prefetchAll, 3000);
  }
}

/** onPointerEnter / onTouchStart handler factory for nav items */
export function createPrefetchHandler(path: string) {
  return () => prefetchRoute(path);
}
