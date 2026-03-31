import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { m as motion } from 'framer-motion';
import { Share2, Edit3, Check, Copy, Flame } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { triggerHaptic } from '@/utils/haptics';
import { lazyHtml2canvas } from '@/utils/lazyHtml2canvas';
import { shareImageBlob } from '@/utils/shareImage';

const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })));

interface StreakConsistencyCertificateProps {
  currentStreak: number;
  totalCompletions: number;
  longestStreak: number;
}

const getShareText = (streak: number, totalTasks: number, userName: string) => {
  return `🔥 I'm on a ${streak} day productivity streak!\n\nI've completed ${totalTasks} tasks with consistency on Flowist! Every day counts. 💪\n\n${userName ? `— ${userName}` : ''}\n#Productivity #Streak #Flowist #Consistency`;
};

const getStreakColor = (streak: number) => {
  if (streak >= 100) return { bg: 'linear-gradient(135deg, hsl(280, 85%, 55%), hsl(320, 90%, 50%))', accent: '#e040fb', glow: 'hsl(300, 80%, 60%)' };
  if (streak >= 60) return { bg: 'linear-gradient(135deg, hsl(35, 95%, 50%), hsl(15, 90%, 55%))', accent: '#ff6d00', glow: 'hsl(30, 90%, 55%)' };
  if (streak >= 30) return { bg: 'linear-gradient(135deg, hsl(25, 95%, 55%), hsl(40, 95%, 50%))', accent: '#ffa726', glow: 'hsl(35, 90%, 55%)' };
  if (streak >= 7) return { bg: 'linear-gradient(135deg, hsl(200, 85%, 50%), hsl(220, 90%, 55%))', accent: '#42a5f5', glow: 'hsl(210, 80%, 55%)' };
  return { bg: 'linear-gradient(135deg, hsl(140, 70%, 45%), hsl(160, 75%, 50%))', accent: '#66bb6a', glow: 'hsl(150, 70%, 50%)' };
};

export const StreakConsistencyCertificate = ({ currentStreak, totalCompletions, longestStreak }: StreakConsistencyCertificateProps) => {
  const { profile } = useUserProfile();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [cardName, setCardName] = useState(profile.name || '');
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!cardName && profile.name) setCardName(profile.name);
  }, [profile.name]);

  const colors = getStreakColor(currentStreak);
  const displayName = cardName.trim();

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setIsSharing(true);
    triggerHaptic('medium').catch(() => {});

    try {
      const element = cardRef.current;
      const canvas = await lazyHtml2canvas(element, {
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scale: Math.max(2, Math.min(window.devicePixelRatio || 2, 4)),
        width: element.offsetWidth,
        height: element.offsetHeight,
        scrollX: 0,
        scrollY: 0,
      });

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) { setIsSharing(false); return; }

      await shareImageBlob({
        blob,
        fileName: `flowist-streak-${currentStreak}.png`,
        title: `${currentStreak} Day Streak!`,
        text: getShareText(currentStreak, totalCompletions, displayName),
        dialogTitle: 'Share Streak',
      });
    } catch (e) {
      console.error('[StreakCert] Share failed:', e);
    } finally {
      setIsSharing(false);
    }
  }, [currentStreak, totalCompletions, displayName]);

  const handleCopyText = useCallback(async () => {
    const text = getShareText(currentStreak, totalCompletions, displayName);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedText(true);
    triggerHaptic('light').catch(() => {});
    setTimeout(() => setCopiedText(false), 2000);
  }, [currentStreak, totalCompletions, displayName]);

  return (
    <div className="space-y-3">
      {/* The shareable card */}
      <div
        ref={cardRef}
        style={{
          background: colors.bg,
          borderRadius: 20,
          padding: '32px 24px 24px',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 280,
        }}
      >
        {/* Decorative glow circles */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.glow}30, transparent 70%)`,
        }} />
        <div style={{
          position: 'absolute', bottom: -30, left: -30,
          width: 120, height: 120, borderRadius: '50%',
          background: `radial-gradient(circle, ${colors.glow}20, transparent 70%)`,
        }} />

        {/* "I'm on a" text */}
        <p style={{
          color: '#000000cc',
          fontSize: 22,
          fontWeight: 700,
          margin: 0,
          lineHeight: 1.3,
          position: 'relative',
          zIndex: 1,
        }}>
          I'm on a
        </p>

        {/* Big streak number */}
        <p style={{
          color: '#000000',
          fontSize: 48,
          fontWeight: 900,
          margin: '12px 0 4px',
          lineHeight: 1,
          position: 'relative',
          zIndex: 1,
          textShadow: `0 4px 20px ${colors.glow}60`,
          textAlign: 'left',
        }}>
          {currentStreak}
        </p>

        {/* "day productivity streak!" */}
        <p style={{
          color: '#000000cc',
          fontSize: 22,
          fontWeight: 700,
          margin: 0,
          lineHeight: 1.3,
          position: 'relative',
          zIndex: 1,
        }}>
          day productivity<br />streak!
        </p>

        {/* User name */}
        {displayName && (
          <p style={{
            color: '#00000090',
            fontSize: 13,
            fontWeight: 600,
            marginTop: 12,
            position: 'relative',
            zIndex: 1,
          }}>
            — {displayName}
          </p>
        )}

        {/* Stats row at bottom */}
        <div style={{
          display: 'flex',
          gap: 20,
          marginTop: 20,
          position: 'relative',
          zIndex: 1,
        }}>
          <div>
            <p style={{ color: '#000000', fontSize: 18, fontWeight: 800, margin: 0 }}>{totalCompletions}</p>
            <p style={{ color: '#00000080', fontSize: 9, margin: 0, fontWeight: 500 }}>Tasks Done</p>
          </div>
          <div>
            <p style={{ color: '#000000', fontSize: 18, fontWeight: 800, margin: 0 }}>{longestStreak}</p>
            <p style={{ color: '#00000080', fontSize: 9, margin: 0, fontWeight: 500 }}>Best Streak</p>
          </div>
        </div>

        {/* Branding at bottom-right */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 1,
        }}>
          <Suspense fallback={null}>
            <div style={{
              background: '#ffffff',
              borderRadius: 6,
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <QRCodeSVG
                value="https://play.google.com/store/apps/details?id=nota.npd.com"
                size={40}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          </Suspense>
          <div>
            <p style={{ color: '#000000cc', fontSize: 11, fontWeight: 700, margin: 0 }}>Flowist</p>
            <p style={{ color: '#00000060', fontSize: 7, margin: 0 }}>Notepad & To Do List</p>
          </div>
        </div>

        {/* Flame icon decorative */}
        <div style={{
          position: 'absolute',
          top: '50%',
          right: 16,
          transform: 'translateY(-60%)',
          opacity: 0.15,
          zIndex: 0,
        }}>
          <svg width="120" height="160" viewBox="0 0 24 24" fill="white">
            <path d="M12 23c-3.866 0-7-3.134-7-7 0-3.866 4-9 7-13 3 4 7 9.134 7 13 0 3.866-3.134 7-7 7z" />
          </svg>
        </div>
      </div>

      {/* Name input */}
      <div className="bg-card border rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Your Name</span>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs text-primary flex items-center gap-1"
          >
            <Edit3 className="h-3 w-3" />
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
        {isEditing ? (
          <input
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="Enter your name"
            maxLength={40}
            autoFocus
            className="w-full text-sm bg-muted rounded-lg px-3 py-2 border border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        ) : (
          <p className="text-sm font-medium truncate">{displayName || 'Tap Edit to add your name'}</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleShare}
          disabled={isSharing}
          className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSharing ? (
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          {isSharing ? 'Exporting...' : 'Share'}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleCopyText}
          className="bg-card border rounded-xl px-4 py-3 text-sm flex items-center gap-2"
        >
          {copiedText ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          {copiedText ? 'Copied!' : 'Copy'}
        </motion.button>
      </div>
    </div>
  );
};
