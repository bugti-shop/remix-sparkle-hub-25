import { useEffect, useState, lazy, Suspense, startTransition, useRef, useCallback } from "react";
import { LazyMotion, domAnimation } from "framer-motion";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";
import { NotesProvider } from "@/contexts/NotesContext";
import { GoogleAuthProvider } from "@/contexts/GoogleAuthContext";
const PremiumPaywall = lazy(() => import("@/components/PremiumPaywall").then(m => ({ default: m.PremiumPaywall })));
const OnboardingFlow = lazy(() => import("@/components/OnboardingFlow").then(m => ({ default: m.OnboardingFlow })));

import { NavigationLoader } from "@/components/NavigationLoader";

import { NavigationBackProvider } from "@/components/NavigationBackProvider";
import { getSetting, setSetting } from "@/utils/settingsStorage";
import { shouldAppBeLocked, updateLastUnlockTime } from "@/utils/appLockStorage";
import { useJourneyAdvancement } from "@/hooks/useJourneyAdvancement";

import { useAchievementToasts } from "@/hooks/useAchievementToasts";
import { useCertificateToasts } from "@/hooks/useCertificateToasts";
import { useSubscriptionExpiry } from "@/hooks/useSubscriptionExpiry";
const AppLockScreen = lazy(() => import("@/components/AppLockScreen").then(m => ({ default: m.AppLockScreen })));
import { useNotificationListener } from "@/hooks/useNotificationListener";

const StreakMilestoneCelebration = lazy(() => import("@/components/StreakMilestoneCelebration").then(m => ({ default: m.StreakMilestoneCelebration })));
const StreakTierCelebration = lazy(() => import("@/components/StreakTierCelebration").then(m => ({ default: m.StreakTierCelebration })));
const SmartReviewPrompt = lazy(() => import("@/components/SmartReviewPrompt").then(m => ({ default: m.SmartReviewPrompt })));
const SubscriptionExpiryBanner = lazy(() => import("@/components/SubscriptionExpiryBanner").then(m => ({ default: m.SubscriptionExpiryBanner })));

const ComboOverlay = lazy(() => import("@/components/ComboOverlay").then(m => ({ default: m.ComboOverlay })));
const UrgentReminderOverlay = lazy(() => import("@/components/UrgentReminderOverlay").then(m => ({ default: m.UrgentReminderOverlay })));
const SyncConflictSheet = lazy(() => import("@/components/SyncConflictSheet").then(m => ({ default: m.SyncConflictSheet })));
// Eager load only the two most critical pages for instant first render
import Today from "./pages/todo/Today";

const Index = lazy(() => import("./pages/Index"));

// Lazy load everything else - they load in background after first paint
const Notes = lazy(() => import("./pages/Notes"));
const NotesCalendar = lazy(() => import("./pages/NotesCalendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const Progress = lazy(() => import("./pages/todo/Progress"));
const JourneyHistory = lazy(() => import("./pages/todo/JourneyHistory"));
const JourneyBadges = lazy(() => import("./pages/todo/JourneyBadges"));
const TodoCalendar = lazy(() => import("./pages/todo/TodoCalendar"));
const TodoSettings = lazy(() => import("./pages/todo/TodoSettings"));
const WebClipper = lazy(() => import("./pages/WebClipper"));
const Reminders = lazy(() => import("./pages/Reminders"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient();

// IMPORTANT: Only decide the initial dashboard once per app session.
// This prevents slow async IndexedDB reads every time the user taps "Home".
let hasResolvedInitialDashboard = false;

// No loading screen - render nothing for instant feel
const EmptyFallback = () => null;

// Detect stale chunk errors and auto-reload once
const isChunkError = (error: any): boolean => {
  const msg = String(error?.message || error || '');
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk')
  );
};

const handleChunkError = () => {
  const key = 'chunk_reload_ts';
  const last = Number(sessionStorage.getItem(key) || 0);
  // Only auto-reload once per 30 seconds to avoid infinite loops
  if (Date.now() - last > 30_000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
    return true;
  }
  return false;
};

// Global error handler for unhandled errors (prevents white screen on mobile)
if (typeof window !== 'undefined') {
  // Show user-friendly toast for unhandled errors instead of silent crashes
  const showGlobalError = async (error: any) => {
    try {
      const { showErrorToast } = await import('@/lib/errorHandling');
      showErrorToast(error, { title: '⚠️ Error', log: false });
    } catch {
      // Fallback if errorHandling module fails
      console.error('Unhandled error:', error);
    }
  };

  window.onerror = (message, source, lineno, colno, error) => {
    if (isChunkError(error || message)) {
      if (handleChunkError()) return true;
    }
    console.error('Global error:', { message, source, lineno, colno, error });
    showGlobalError(error || message);
    return false;
  };
  
  window.onunhandledrejection = (event) => {
    // Auto-reload on stale chunk imports
    if (isChunkError(event?.reason)) {
      event.preventDefault();
      if (handleChunkError()) return;
    }
    // Suppress "not implemented" errors from Capacitor plugins (web + android + ios)
    const msg = String(event?.reason?.message || event?.reason || '');
    if (msg.includes('not implemented') || msg.includes('UNIMPLEMENTED') || msg.includes('not available')) {
      event.preventDefault();
      return;
    }
    console.error('Unhandled promise rejection:', event.reason);
    showGlobalError(event.reason);
  };
}

// Component to track and save last visited dashboard
const DashboardTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/todo') || path === '/') {
      setSetting('lastDashboard', 'todo');
    } else if (path === '/notesdashboard' || path === '/calendar' || path === '/settings') {
      setSetting('lastDashboard', 'notes');
    }
  }, [location.pathname]);
  
  return null;
};

// Listen for tour navigation events and navigate accordingly
const TourNavigationListener = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleTourNavigate = (e: CustomEvent<{ path: string }>) => {
      navigate(e.detail.path);
    };
    window.addEventListener('tourNavigate', handleTourNavigate as EventListener);
    return () => window.removeEventListener('tourNavigate', handleTourNavigate as EventListener);
  }, [navigate]);
  
  return null;
};

// Root redirect component that redirects to Todo dashboard by default
const RootRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // If we've already resolved once, skip
    if (hasResolvedInitialDashboard) return;
    hasResolvedInitialDashboard = true;
    
    const checkLastDashboard = async () => {
      try {
        const lastDashboard = await getSetting<string>('lastDashboard', 'todo');
        if (lastDashboard === 'notes') {
          startTransition(() => {
            navigate('/notesdashboard', { replace: true });
          });
        }
      } catch (e) {
        console.warn('Failed to check last dashboard:', e);
      }
    };
    
    checkLastDashboard();
  }, [navigate]);
  
  // Always render Today (Todo) immediately - no loading screen
  return <Today />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <NavigationBackProvider>
        <NavigationLoader />
        <DashboardTracker />
        <TourNavigationListener />
        <Suspense fallback={<EmptyFallback />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/notesdashboard" element={<Index />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/calendar" element={<NotesCalendar />} />
            <Route path="/clip" element={<WebClipper />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/todo/today" element={<Today />} />
            <Route path="/todo/calendar" element={<TodoCalendar />} />
            <Route path="/todo/settings" element={<TodoSettings />} />
            <Route path="/todo/progress" element={<Progress />} />
            <Route path="/todo/journey-history" element={<JourneyHistory />} />
            <Route path="/todo/journey-badges" element={<JourneyBadges />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </NavigationBackProvider>
    </BrowserRouter>
  );
};

const AppContent = () => {
  const [isAppLocked, setIsAppLocked] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  
  const { isPro, isLoading: subLoading, openPaywall } = useSubscription();

  // Check onboarding status
  useEffect(() => {
    const check = async () => {
      const completed = await getSetting<boolean>('onboarding_completed', false);
      setShowOnboarding(!completed);
    };
    check();
  }, []);

  // When subscription expires (isPro becomes false after onboarding), auto-show paywall
  useEffect(() => {
    if (subLoading || showOnboarding) return;
    if (!isPro) {
      openPaywall();
    }
  }, [isPro, subLoading, showOnboarding, openPaywall]);

  const handleOnboardingComplete = useCallback(() => {
    startTransition(() => {
      setShowOnboarding(false);
    });
  }, []);
  
  // Initialize keyboard height detection for mobile toolbar positioning
  useKeyboardHeight();
  
  // Global journey advancement - listens for task completions from any page
  useJourneyAdvancement();
  useAchievementToasts();
  useCertificateToasts();
  
  // Subscription expiry watcher — warnings + notifications
  useSubscriptionExpiry();
  
  // In-app notification listener — captures events from all sources
  useNotificationListener();
  

  // Defer non-critical sync hooks until after first paint
  const deferredInit = useRef(false);
  useEffect(() => {
    if (deferredInit.current) return;
    deferredInit.current = true;

    const init = async () => {
      const { widgetDataSync } = await import('@/utils/widgetDataSync');
      widgetDataSync.initialize().catch(console.error);
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => init(), { timeout: 2000 });
    } else {
      setTimeout(init, 200);
    }
  }, []);

  // App lock check
  useEffect(() => {
    const checkLock = async () => {
      const locked = await shouldAppBeLocked();
      setIsAppLocked(locked);
    };
    checkLock();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle unlock
  const handleUnlock = async () => {
    await updateLastUnlockTime();
    setIsAppLocked(false);
  };

  // Show lock screen if locked (but not while checking)
  if (isAppLocked === true) {
    return (
      <>
        <Toaster />
        <Sonner />
        <AppLockScreen onUnlock={handleUnlock} />
      </>
    );
  }

  // If subscription expired and onboarding completed, block app with paywall only
  const subscriptionExpired = !subLoading && !isPro && showOnboarding === false;

  return (
    <>
      <Toaster />
      <Sonner />
      
      {showOnboarding && (
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      )}

      
      <PremiumPaywall />
      
      {/* Only render app content if user has active subscription or is in onboarding */}
      {!subscriptionExpired && (
        <>
          <SubscriptionExpiryBanner />
          <StreakMilestoneCelebration />
          <StreakTierCelebration />
          <SmartReviewPrompt />
          
          <ComboOverlay />
          <UrgentReminderOverlay />
          <SyncConflictSheet />
          <DeferredSyncInit />
          <AppRoutes />
        </>
      )}
    </>
  );
};

// Deferred sync hooks - lazy loaded after first paint
const DeferredSyncInit = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = 'requestIdleCallback' in window
      ? requestIdleCallback(() => setReady(true), { timeout: 2000 })
      : setTimeout(() => setReady(true), 200);
    return () => {
      if ('requestIdleCallback' in window) cancelIdleCallback(id as number);
      else clearTimeout(id as ReturnType<typeof setTimeout>);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <DeferredSyncHooks />
    </Suspense>
  );
};

const DeferredSyncHooks = lazy(async () => {
  const calSync = await import('@/hooks/useSystemCalendarSync');
  const SyncComponent = () => {
    calSync.useSystemCalendarSync();
    return null;
  };
  return { default: SyncComponent };
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation}>
        <TooltipProvider>
          <GoogleAuthProvider>
            <NotesProvider>
              <SubscriptionProvider>
                <AppContent />
              </SubscriptionProvider>
            </NotesProvider>
          </GoogleAuthProvider>
        </TooltipProvider>
      </LazyMotion>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;