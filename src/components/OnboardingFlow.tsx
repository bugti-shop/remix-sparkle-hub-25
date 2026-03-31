import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { m as motion, AnimatePresence } from 'framer-motion';
import { ALL_JOURNEYS, startJourney } from '@/utils/virtualJourneyStorage';
import { ArrowLeft, Camera, User, Check, PenLine, CheckCircle2, CalendarDays, Target, Lightbulb, Bell, BarChart3, Star, Trophy, FlaskConical, Link, Monitor, Medal, Home, Rocket, Sprout, Heart, TrendingUp, Brain, Zap, Palette, Mic, LayoutDashboard, Shield, Plus, Pencil, Type, AlignLeft, Save, Trash2, ListTodo, ChevronRight, ListPlus, BookOpen, Briefcase, Activity, Sparkles } from 'lucide-react';
import { TaskDetailPage } from '@/components/TaskDetailPage';
import { TaskCompletionCircle } from '@/components/task/TaskCompletionCircle';
import { usePriorities } from '@/hooks/usePriorities';
import { MemoryRouter } from 'react-router-dom';
import { saveNoteToDBSingle } from '@/utils/noteStorage';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import type { Note, TodoItem, TaskSection, Folder } from '@/types/note';
import { NoteEditor } from '@/components/NoteEditor';
import { TaskInputSheet } from '@/components/TaskInputSheet';
import { ProfileImageCropper } from '@/components/ProfileImageCropper';
import { triggerSelectionHaptic } from '@/utils/haptics';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { setSetting, getSetting } from '@/utils/settingsStorage';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { saveUserProfile, loadUserProfile } from '@/hooks/useUserProfile';

import { StreakDay1Screen } from '@/components/StreakDay1Screen';
import { StreakConsistencyCertificate } from '@/components/StreakConsistencyCertificate';
import { getTextPreviewFromHtml } from '@/utils/contentPreview';

const ONBOARDING_COLOR = '#3c78f0';
const TOTAL_STEPS = 28;

// Feature showcase data
const FEATURE_SHOWCASE = [
  { icon: CheckCircle2, bg: '#ECFDF5', color: '#059669', title: 'Smart Task Management', description: 'Organize tasks with priorities, subtasks, and smart scheduling to stay on top of everything.' },
  { icon: PenLine, bg: '#EEF2FF', color: '#4F46E5', title: 'Rich Notes & Sketches', description: 'Capture ideas with rich text notes, voice recordings, and a full sketch editor.' },
  { icon: Target, bg: '#FEF2F2', color: '#DC2626', title: 'Habit & Streak Tracking', description: 'Build consistent habits with streaks, challenges, and achievement badges.' },
  { icon: Palette, bg: '#FAF5FF', color: '#9333EA', title: 'Themes & Customization', description: 'Personalize your workspace with custom themes, dark mode, and flexible layouts.' },
  { icon: BarChart3, bg: '#FFF7ED', color: '#EA580C', title: 'Analytics & Insights', description: 'Track your productivity score, view task analytics, and get weekly progress reports.' },
  { icon: Bell, bg: '#F0F9FF', color: '#0284C7', title: 'Smart Reminders', description: 'Never miss a deadline with push notifications, location-based, and calendar sync alerts.' },
];

// Description-style questions (Yazio-style with title + description per option)
const experienceOptions = [
  { label: 'Beginner', description: 'I\'m new to productivity apps and need guidance getting started.' },
  { label: 'Intermediate', description: 'I\'ve used some tools before but want a better, more organized system.' },
  { label: 'Advanced', description: 'I\'m experienced with productivity systems and want powerful features.' },
];

const workStyleOptions = [
  { label: 'Structured & Planned', description: 'I prefer a clear schedule with set times for everything.' },
  { label: 'Flexible & Adaptive', description: 'I like to adjust my plans as the day unfolds.' },
  { label: 'Focused Sprints', description: 'I work in intense bursts followed by breaks.' },
  { label: 'Multitasker', description: 'I juggle multiple tasks and projects simultaneously.' },
];

const energyOptions = [
  { label: 'Early Bird', description: 'I\'m most productive in the morning and wind down by evening.' },
  { label: 'Night Owl', description: 'I do my best work late at night when it\'s quiet.' },
  { label: 'Afternoon Peak', description: 'My energy and focus peak in the afternoon hours.' },
  { label: 'It Varies', description: 'My productive hours change depending on the day.' },
];

// Info screens shown between question pairs
const INFO_SCREENS: Record<number, { title: string; icons: { icon: any; bg: string; color: string }[]; points: { icon: any; bg: string; color: string; text: string }[]; button: string }> = {
  15: {
    title: 'Based on Your Answers, Here\'s What We\'ll Set Up for You',
    icons: [
      { icon: CheckCircle2, bg: '#ECFDF5', color: '#059669' },
      { icon: PenLine, bg: '#EEF2FF', color: '#4F46E5' },
      { icon: Target, bg: '#FEF2F2', color: '#DC2626' },
    ],
    points: [
      { icon: Lightbulb, bg: '#FFF7ED', color: '#EA580C', text: 'A personalized workspace tailored to your goals and work style.' },
      { icon: CalendarDays, bg: '#F0F9FF', color: '#0284C7', text: 'Smart scheduling and reminders based on your preferences.' },
      { icon: Trophy, bg: '#FEFCE8', color: '#CA8A04', text: 'Achievement tracking and streaks to keep you motivated every day.' },
    ],
    button: 'Sounds Great!',
  },
  5: {
    title: 'Welcome to the New Productive You!',
    icons: [],
    points: [
      { icon: FlaskConical, bg: '#F0F9FF', color: '#0284C7', text: 'We use proven productivity methods to help you reach your goals.' },
      { icon: Link, bg: '#EEF2FF', color: '#4F46E5', text: 'Flowist uses smart scheduling to help you see real results.' },
      { icon: Monitor, bg: '#FAF5FF', color: '#9333EA', text: 'Our system transforms your habits into tools that help you stay on track.' },
    ],
    button: 'Got It',
  },
  13: {
    title: 'You\'re Building Something Great!',
    icons: [],
    points: [
      { icon: TrendingUp, bg: '#ECFDF5', color: '#059669', text: 'Users who track daily see 3x more productivity gains.' },
      { icon: Brain, bg: '#FAF5FF', color: '#9333EA', text: 'Your brain works better with organized systems — Flowist does the heavy lifting.' },
      { icon: Zap, bg: '#FEFCE8', color: '#CA8A04', text: 'Small daily wins lead to massive life changes over time.' },
    ],
    button: 'Continue',
  },
  21: {
    title: 'With Your Personalized Plan, There\'s No Stopping You!',
    icons: [
      { icon: PenLine, bg: '#EEF2FF', color: '#4F46E5' },
      { icon: CheckCircle2, bg: '#ECFDF5', color: '#059669' },
      { icon: CalendarDays, bg: '#FFF7ED', color: '#EA580C' },
      { icon: Target, bg: '#FEF2F2', color: '#DC2626' },
      { icon: Star, bg: '#FFF1F2', color: '#E11D48' },
    ],
    points: [
      { icon: Rocket, bg: '#EEF2FF', color: '#4F46E5', text: 'Start seeing results within just 7 days.' },
      { icon: Star, bg: '#FFF1F2', color: '#E11D48', text: 'Build new, productive habits to reach and maintain your goals.' },
      { icon: Heart, bg: '#FEF2F2', color: '#DC2626', text: 'Improve your life and quality of work while doing what you love.' },
    ],
    button: 'Let\'s Go',
  },
};
interface OnboardingFlowProps {
  onComplete: () => void;
}

const goalOptions = [
  'Study & Learning',
  'Work & Career',
  'Personal & Daily Life',
  'Creative Projects',
  'Health & Fitness',
  'Something else',
];

const sourceOptions = [
  'Instagram',
  'Facebook',
  'TikTok',
  'YouTube',
  'Friends and family',
  'Creator or influencer',
  'AI Chat (e.g. ChatGPT)',
  'Other',
];

const previousAppOptions = [
  'Notion',
  'Evernote',
  'Todoist',
  'TickTick',
  'Any.do',
  'EasyNotes',
  'None',
];


  const challengeOptions = [
  'Managing too many priorities',
  'Forgetting important deadlines',
  'Staying motivated',
  'Organizing notes & ideas',
  'Building good habits',
  'Something else',
];

const productivityOptions = [
  'Morning routine',
  'Time blocking',
  'Pomodoro technique',
  'To-do lists',
  'Calendar scheduling',
  'None yet',
];

const focusOptions = [
  'Work & career',
  'School & studies',
  'Personal projects',
  'Health & fitness',
  'Creative pursuits',
  'Daily life management',
];

const scheduleOptions = [
  'I plan my day freely',
  'I follow a fixed routine',
  'I work in alternating shifts',
  'My schedule changes often',
  'Other',
];

const celebrateOptions = [
  'Share my progress with friends',
  'Reward myself with a treat',
  'Take a well-deserved break',
  'Start an even bigger goal',
  'Reflect and journal about it',
  'Something else',
];

const progressTrackOptions = [
  'Review completed tasks weekly',
  'Check my productivity score daily',
  'Use streaks to stay on track',
  'Look at my task analytics',
  'Compare weekly progress reports',
  'Something else',
];

const consistencyOptions = [
  'Add tasks first thing in the morning',
  'Plan everything the night before',
  'Add tasks as they come up',
  'Schedule a weekly planning session',
  'I don\'t know yet',
];

const streakOptions = [
  '50 days in a row (Unstoppable)',
  '30 days in a row (Incredible)',
  '14 days in a row (Great)',
  '7 days in a row (Good)',
];

const remindOptions = [
  'Push notifications',
  'Daily summary in the morning',
  'Evening review reminder',
  'Location-based reminders',
  'Calendar sync alerts',
  'Something else',
];

const featureInterestOptions = [
  'Habit tracking',
  'Sketch & drawing notes',
  'Voice notes & recordings',
  'Task analytics & reports',
  'Dark mode & themes',
  'Widgets on home screen',
];

const improveOptions = [
  'Reduce screen time',
  'Stop procrastinating',
  'Be more mindful',
  'Achieve work-life balance',
  'Learn new skills',
  'Sleep better',
];

const PLAN_STEPS = [
  'Analyzing your answers',
  'Building your productivity plan',
  'Setting up your workspace',
  'Adding finishing touches',
];

const PlanLoadingScreen = ({ onComplete, displayName }: { onComplete: () => void; displayName: string }) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);
  const tPlanSteps = useMemo(() => [
    t('onboarding.loadingAnalyzing'),
    t('onboarding.loadingBuilding'),
    t('onboarding.loadingSetup'),
    t('onboarding.loadingFinishing'),
  ], [t]);

  useEffect(() => {
    const duration = 4500;
    const interval = 50;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      const stepIdx = Math.min(PLAN_STEPS.length, Math.floor((elapsed / duration) * (PLAN_STEPS.length + 0.5)));
      setCompletedSteps(stepIdx);
      if (elapsed >= duration) {
        clearInterval(timer);
        triggerSelectionHaptic();
        setTimeout(onComplete, 600);
      }
    }, interval);
    return () => clearInterval(timer);
  }, [onComplete]);

  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-white items-center justify-center"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex flex-col items-center px-8">
        {/* Circular progress */}
        <div className="relative w-52 h-52 mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#e8e8e8" strokeWidth="12" />
            <circle
              cx="100" cy="100" r="90" fill="none"
              stroke={ONBOARDING_COLOR}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 0.1s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[42px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight">{progress}%</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-[28px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-center leading-tight mb-8">
          {t('onboarding.creatingPlan')}
        </h1>

        {/* Checklist */}
        <div className="flex flex-col gap-4 w-full max-w-[300px]">
          {tPlanSteps.map((label, i) => {
            const done = i < completedSteps;
            const active = i === completedSteps && progress < 100;
            return (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor: done ? ONBOARDING_COLOR : 'transparent',
                    border: `2px solid ${done ? ONBOARDING_COLOR : active ? '#aaa' : '#ddd'}`,
                  }}
                >
                  {done && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                </div>
                <span
                  className="text-[15px] font-medium font-['Nunito_Sans'] transition-all duration-300"
                  style={{
                    color: done ? '#1a1a1a' : active ? '#888' : '#ccc',
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const FOLDER_COLORS = ['#3c78f0', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

// Sub-component for folder creation in onboarding
const OnboardingFolderCreation = ({ type, folders, setFolders, progressPercent, stepLabel, handleBack, goNext }: {
  type: 'notes' | 'tasks';
  folders: { id: string; name: string; color: string }[];
  setFolders: (folders: { id: string; name: string; color: string }[]) => void;
  progressPercent: string;
  stepLabel: string;
  handleBack: () => void;
  goNext: () => void;
}) => {
  const { t } = useTranslation();
  const [folderName, setFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);

  const handleCreate = () => {
    if (!folderName.trim()) return;
    triggerSelectionHaptic();
    const newFolder = { id: crypto.randomUUID(), name: folderName.trim(), color: selectedColor };
    setFolders([...folders, newFolder]);
    setFolderName('');
    setSelectedColor(FOLDER_COLORS[(folders.length + 1) % FOLDER_COLORS.length]);
  };

  const handleRemove = (id: string) => {
    triggerSelectionHaptic();
    setFolders(folders.filter(f => f.id !== id));
  };

  const title = type === 'notes' ? t('onboarding.createNotesFolders') : t('onboarding.createTaskFolders');
  const subtitle = type === 'notes'
    ? t('onboarding.notesFolderSubtitle')
    : t('onboarding.tasksFolderSubtitle');
  const icon = type === 'notes' ? '📝' : '✅';

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <div className="flex items-end gap-3 px-4 pt-3 pb-2">
        <motion.button
          className="w-[17px] h-[17px] flex items-center justify-center cursor-pointer"
          onClick={handleBack}
          aria-label="Back"
          whileTap={{ scale: 0.85 }}
        >
          <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
        </motion.button>
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-[#999] text-right">{stepLabel}</span>
          <div className="h-[17px] rounded-[6px] bg-[#e5e5e5] overflow-hidden">
            <motion.div className="h-full" style={{ backgroundColor: ONBOARDING_COLOR }} initial={{ width: '0%' }} animate={{ width: progressPercent }} transition={{ duration: 0.5, ease: 'easeOut' }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-4 overflow-y-auto pb-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-1">
          <span className="text-3xl mb-2 block">{icon}</span>
          <h1 className="text-[24px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight leading-tight">{title}</h1>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[13px] text-[#767b7e] font-['Nunito_Sans'] mb-5">
          {subtitle}
        </motion.p>

        {/* Create folder form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4 mb-4"
        >
          <p className="text-[14px] font-semibold text-[#1a1a1a] font-['Nunito_Sans'] mb-3">{t('onboarding.newFolder')}</p>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder={t('onboarding.folderName')}
            className="w-full px-4 py-3 rounded-xl border border-[#e0e0e0] bg-white text-[15px] text-[#1a1a1a] placeholder-[#aaa] outline-none focus:border-[#3c78f0] transition-colors mb-3"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />

          {/* Color picker */}
          <p className="text-[13px] font-medium text-[#767b7e] mb-2">{t('onboarding.color')}</p>
          <div className="flex gap-2.5 mb-3">
            {FOLDER_COLORS.map(color => (
              <button
                key={color}
                onClick={() => { triggerSelectionHaptic(); setSelectedColor(color); }}
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                style={{
                  backgroundColor: color,
                  border: selectedColor === color ? '3px solid #1a1a1a' : '3px solid transparent',
                  transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {selectedColor === color && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>

          {/* Create button */}
          <motion.button
            onClick={handleCreate}
            disabled={!folderName.trim()}
            className="w-full py-3 rounded-xl text-[15px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: ONBOARDING_COLOR, color: '#ffffff' }}
            whileTap={{ scale: 0.97 }}
          >
            {t('onboarding.createFolder')}
          </motion.button>
        </motion.div>

        {/* Created folders list */}
        {folders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] overflow-hidden divide-y divide-[#e8e8e8]"
          >
            {folders.map((folder, i) => (
              <motion.div
                key={folder.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 py-3.5 px-4"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: folder.color + '20' }}>
                  <div className="w-4 h-4 rounded" style={{ backgroundColor: folder.color }} />
                </div>
                <span className="flex-1 text-[15px] font-medium text-[#1a1a1a]">{folder.name}</span>
                <button
                  onClick={() => handleRemove(folder.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer active:bg-[#f0f0f0]"
                >
                  <Trash2 className="h-4 w-4 text-[#999]" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="px-6 pb-6 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
        <motion.button
          onClick={() => { triggerSelectionHaptic(); goNext(); }}
          className="w-full py-3 rounded-2xl text-[17px] font-bold"
          style={{ backgroundColor: '#333333', color: '#ffffff', boxShadow: '0 8px 0 0 #000000' }}
          whileTap={{ scale: 0.97 }}
        >
          {folders.length > 0 ? `${t('onboarding.continue')} · ${t('onboarding.foldersCreated', { count: folders.length })}` : t('onboarding.skip')}
        </motion.button>
      </div>
    </div>
  );
};

// Sub-component for step 15: embeds the real Today page with all features
const OnboardingTaskViewStep = ({ createdTasks, setCreatedTasks, progressPercent, stepLabel, handleBack, goNext, onOpenBatch }: {
  createdTasks: TodoItem[];
  setCreatedTasks: (tasks: TodoItem[]) => void;
  progressPercent: string;
  stepLabel: string;
  handleBack: () => void;
  goNext: () => void;
  onOpenBatch: () => void;
}) => {
  const { t } = useTranslation();
  const TodayPage = useMemo(() => lazy(() => import('@/pages/todo/Today')), []);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Onboarding progress header */}
      <div className="flex items-center gap-3 px-4 pt-1 pb-1 relative z-50 bg-white">
        <button className="w-[17px] h-[17px] flex items-center justify-center" onClick={handleBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
        </button>
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-[#999] text-right">{stepLabel}</span>
          <div className="h-[17px] rounded-[6px] bg-[#e5e5e5] overflow-hidden">
            <motion.div className="h-full" style={{ backgroundColor: ONBOARDING_COLOR }} initial={{ width: '0%' }} animate={{ width: progressPercent }} transition={{ duration: 0.5, ease: 'easeOut' }} />
          </div>
        </div>
      </div>

      {/* Real Today page embedded */}
      <div className="flex-1 overflow-hidden relative onboarding-embedded">
        <Suspense fallback={null}>
          <MemoryRouter initialEntries={['/todo/today']}>
            <TodayPage />
          </MemoryRouter>
        </Suspense>
      </div>

      {/* Bottom buttons */}
      <div className="px-4 pb-2 pt-1 flex flex-col gap-1.5 relative z-50 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
        <motion.button onClick={goNext} className="w-full py-3 rounded-2xl text-[17px] font-bold" style={{ backgroundColor: '#333333', color: '#ffffff', boxShadow: '0 8px 0 0 #000000' }} whileTap={{ scale: 0.97 }}>
          {t('onboarding.continue')}
        </motion.button>
      </div>
    </div>
  );
};

// Inline batch task form for onboarding full-screen
const OnboardingBatchTaskForm = ({ sections, folders, onAddTasks, onCancel }: {
  sections: TaskSection[];
  folders: Folder[];
  onAddTasks: (tasks: string[], sectionId?: string, folderId?: string, priority?: string, dueDate?: Date) => void;
  onCancel: () => void;
}) => {
  const [text, setText] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<string>('none');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const taskCount = text.split('\n').filter(line => line.trim().length > 0).length;

  const handleAdd = () => {
    const tasks = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (tasks.length > 0) {
      onAddTasks(tasks, selectedSection || undefined, selectedFolder || undefined, selectedPriority !== 'none' ? selectedPriority : undefined, selectedDate);
    }
  };

  const priorityOptions = [
    { value: 'high', label: 'High', color: '#DC2626' },
    { value: 'medium', label: 'Medium', color: '#F59E0B' },
    { value: 'low', label: 'Low', color: '#22C55E' },
    { value: 'none', label: 'None', color: '#9CA3AF' },
  ];

  return (
    <div className="flex flex-col gap-4 flex-1">
      <textarea
        placeholder="Buy groceries&#10;Call dentist&#10;Finish report&#10;..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full min-h-[180px] resize-none rounded-2xl p-4 text-[15px] outline-none"
        style={{ backgroundColor: '#f9fafb', border: '2px solid #e5e7eb', color: '#1a1a1a' }}
        autoFocus
      />

      {/* Section selector */}
      {sections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[#767b7e]">Section</span>
          <div className="flex flex-wrap gap-2">
            {sections.map(s => (
              <motion.button
                key={s.id}
                onClick={() => { triggerSelectionHaptic(); setSelectedSection(selectedSection === s.id ? '' : s.id); }}
                className="px-3 py-1.5 rounded-xl text-[13px] font-medium cursor-pointer"
                style={{
                  backgroundColor: selectedSection === s.id ? `${s.color}20` : '#f3f4f6',
                  border: `1.5px solid ${selectedSection === s.id ? s.color : '#e5e7eb'}`,
                  color: selectedSection === s.id ? s.color : '#6b7280',
                }}
                whileTap={{ scale: 0.95 }}
              >
                {s.name}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Folder selector */}
      {folders.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[#767b7e]">Folder</span>
          <div className="flex flex-wrap gap-2">
            {folders.map(f => (
              <motion.button
                key={f.id}
                onClick={() => { triggerSelectionHaptic(); setSelectedFolder(selectedFolder === f.id ? '' : f.id); }}
                className="px-3 py-1.5 rounded-xl text-[13px] font-medium cursor-pointer"
                style={{
                  backgroundColor: selectedFolder === f.id ? '#3c78f010' : '#f3f4f6',
                  border: `1.5px solid ${selectedFolder === f.id ? '#3c78f0' : '#e5e7eb'}`,
                  color: selectedFolder === f.id ? '#3c78f0' : '#6b7280',
                }}
                whileTap={{ scale: 0.95 }}
              >
                {f.name}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Priority selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-[#767b7e]">Priority</span>
        <div className="flex gap-2">
          {priorityOptions.map(p => (
            <motion.button
              key={p.value}
              onClick={() => { triggerSelectionHaptic(); setSelectedPriority(p.value); }}
              className="flex-1 py-2 rounded-xl text-[13px] font-medium cursor-pointer"
              style={{
                backgroundColor: selectedPriority === p.value ? `${p.color}15` : '#f3f4f6',
                border: `1.5px solid ${selectedPriority === p.value ? p.color : '#e5e7eb'}`,
                color: selectedPriority === p.value ? p.color : '#6b7280',
              }}
              whileTap={{ scale: 0.95 }}
            >
              {p.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Due date picker */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium text-[#767b7e]">Due Date</span>
        <motion.button
          onClick={() => { triggerSelectionHaptic(); }}
          className="relative w-full cursor-pointer"
          whileTap={{ scale: 0.98 }}
        >
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-full py-2.5 px-3 rounded-xl text-[13px] font-medium text-left flex items-center gap-2 cursor-pointer"
                style={{
                  backgroundColor: selectedDate ? '#3c78f010' : '#f3f4f6',
                  border: `1.5px solid ${selectedDate ? '#3c78f0' : '#e5e7eb'}`,
                  color: selectedDate ? '#3c78f0' : '#6b7280',
                }}
              >
                <CalendarDays className="h-4 w-4" />
                {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'No due date'}
                {selectedDate && (
                  <span
                    className="ml-auto text-[11px] underline"
                    onClick={(e) => { e.stopPropagation(); setSelectedDate(undefined); triggerSelectionHaptic(); }}
                  >
                    Clear
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[600]" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </motion.button>
      </div>

      <div className="flex-1" />

      {/* Task count + Add button */}
      <div className="flex flex-col gap-2 pb-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}>
        {taskCount > 0 && (
          <p className="text-[13px] text-[#767b7e] font-['Nunito_Sans'] text-center">{taskCount} task{taskCount > 1 ? 's' : ''} ready to add</p>
        )}
        <motion.button
          onClick={handleAdd}
          disabled={taskCount === 0}
          className="w-full py-3 rounded-2xl text-[16px] font-bold cursor-pointer"
          style={{
            backgroundColor: taskCount > 0 ? '#333333' : '#e5e7eb',
            color: taskCount > 0 ? '#ffffff' : '#9ca3af',
            boxShadow: taskCount > 0 ? '0 8px 0 0 #000000' : 'none',
          }}
          whileTap={taskCount > 0 ? { scale: 0.97 } : undefined}
        >
          {taskCount > 0 ? `Add ${taskCount} Task${taskCount > 1 ? 's' : ''}` : 'Add Tasks'}
        </motion.button>
      </div>
    </div>
  );
};

const TodayPage = lazy(() => import('@/pages/todo/Today'));

export const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(-3); // -3 = language selection
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedChallenges, setSelectedChallenges] = useState<Set<string>>(new Set());
  const [selectedProductivity, setSelectedProductivity] = useState<Set<string>>(new Set());
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [selectedCelebrate, setSelectedCelebrate] = useState<Set<string>>(new Set());
  const [selectedProgressTrack, setSelectedProgressTrack] = useState<Set<string>>(new Set());
  const [selectedConsistency, setSelectedConsistency] = useState<string | null>(null);
  const [selectedStreak, setSelectedStreak] = useState<string | null>(null);
  const [selectedRemind, setSelectedRemind] = useState<Set<string>>(new Set());
  const [selectedFeatureInterest, setSelectedFeatureInterest] = useState<Set<string>>(new Set());
  const [selectedImprove, setSelectedImprove] = useState<Set<string>>(new Set());
  const [selectedPreviousApp, setSelectedPreviousApp] = useState<string | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<string | null>(null);
  const [selectedWorkStyle, setSelectedWorkStyle] = useState<string | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState(i18n?.language?.split('-')[0] || 'en');
  // Interactive creation states
  const [onboardingNoteTitle, setOnboardingNoteTitle] = useState('');
  const [onboardingNoteContent, setOnboardingNoteContent] = useState('');
  const [onboardingNoteSaved, setOnboardingNoteSaved] = useState(false);
  const [sketchCanvasRef, setSketchCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [sketchSaved, setSketchSaved] = useState(false);
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [sketchColor, setSketchColor] = useState('#1a1a1a');
  const [sketchBrushSize, setSketchBrushSize] = useState(3);
  const [onboardingTaskText, setOnboardingTaskText] = useState('');
  const [onboardingTaskDesc, setOnboardingTaskDesc] = useState('');
  const [createdTasks, setCreatedTasks] = useState<TodoItem[]>([]);
  const [createdTask, setCreatedTask] = useState<TodoItem | null>(null); // for step 15 detail view
  const [isTaskInputSheetOpen, setIsTaskInputSheetOpen] = useState(true);
  const [isBatchSheetOpen, setIsBatchSheetOpen] = useState(false);
  const [showNotesFolderCreation, setShowNotesFolderCreation] = useState(false);
  const [showTasksFolderCreation, setShowTasksFolderCreation] = useState(false);
  const [notesFolders, setNotesFolders] = useState<{ id: string; name: string; color: string }[]>([]);
  const [tasksFolders, setTasksFolders] = useState<{ id: string; name: string; color: string }[]>([]);
  const [editingTask, setEditingTask] = useState(false);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [editTaskText, setEditTaskText] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [firstStepShown, setFirstStepShown] = useState(false);
  const [showStreakDay1, setShowStreakDay1] = useState(false);
  const [showOnboardingCertificate, setShowOnboardingCertificate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { openPaywall } = useSubscription();
  const { getPriorityColor } = usePriorities();

  // ===== ONBOARDING STATE PERSISTENCE =====
  // Load saved onboarding state on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await getSetting<any>('onboarding_progress_state', null);
        if (!saved || typeof saved !== 'object') return;
        if (typeof saved.step === 'number' && saved.step >= -2 && saved.step <= 27) setStep(saved.step);
        if (saved.userName) setUserName(saved.userName);
        if (saved.avatarPreview) setAvatarPreview(saved.avatarPreview);
        if (saved.selectedGoal) setSelectedGoal(saved.selectedGoal);
        if (saved.selectedSource) setSelectedSource(saved.selectedSource);
        if (saved.selectedPreviousApp) setSelectedPreviousApp(saved.selectedPreviousApp);
        if (saved.selectedExperience) setSelectedExperience(saved.selectedExperience);
        if (saved.selectedWorkStyle) setSelectedWorkStyle(saved.selectedWorkStyle);
        if (saved.selectedEnergy) setSelectedEnergy(saved.selectedEnergy);
        if (saved.selectedTheme) setSelectedTheme(saved.selectedTheme);
        if (saved.selectedChallenges?.length) setSelectedChallenges(new Set(saved.selectedChallenges));
        if (saved.selectedProductivity?.length) setSelectedProductivity(new Set(saved.selectedProductivity));
        if (saved.selectedFocus) setSelectedFocus(saved.selectedFocus);
        if (saved.selectedSchedule) setSelectedSchedule(saved.selectedSchedule);
        if (saved.selectedCelebrate?.length) setSelectedCelebrate(new Set(saved.selectedCelebrate));
        if (saved.selectedProgressTrack?.length) setSelectedProgressTrack(new Set(saved.selectedProgressTrack));
        if (saved.selectedConsistency) setSelectedConsistency(saved.selectedConsistency);
        if (saved.selectedStreak) setSelectedStreak(saved.selectedStreak);
        if (saved.selectedRemind?.length) setSelectedRemind(new Set(saved.selectedRemind));
        if (saved.selectedFeatureInterest?.length) setSelectedFeatureInterest(new Set(saved.selectedFeatureInterest));
        if (saved.selectedImprove?.length) setSelectedImprove(new Set(saved.selectedImprove));
        if (saved.onboardingNoteSaved) setOnboardingNoteSaved(true);
        if (saved.sketchSaved) setSketchSaved(true);
        if (saved.selectedJourneyId) setSelectedJourneyId(saved.selectedJourneyId);
        if (saved.selectedLang) setSelectedLang(saved.selectedLang);
        if (saved.firstStepShown) setFirstStepShown(true);
        if (saved.createdTaskIds?.length) {
          const tasks = await loadTodoItems();
          setCreatedTasks(tasks.filter(t => saved.createdTaskIds.includes(t.id)));
        }
        if (saved.notesFolders?.length) setNotesFolders(saved.notesFolders);
        if (saved.tasksFolders?.length) setTasksFolders(saved.tasksFolders);
      } catch (e) {
        console.warn('Failed to restore onboarding state:', e);
      }
    })();
  }, []);

  // Save onboarding state on every meaningful change
  useEffect(() => {
    if (step < -2) return; // Don't save language/splash screens
    const state = {
      step,
      userName,
      avatarPreview,
      selectedGoal,
      selectedSource,
      selectedPreviousApp,
      selectedExperience,
      selectedWorkStyle,
      selectedEnergy,
      selectedTheme,
      selectedChallenges: Array.from(selectedChallenges),
      selectedProductivity: Array.from(selectedProductivity),
      selectedFocus,
      selectedSchedule,
      selectedCelebrate: Array.from(selectedCelebrate),
      selectedProgressTrack: Array.from(selectedProgressTrack),
      selectedConsistency,
      selectedStreak,
      selectedRemind: Array.from(selectedRemind),
      selectedFeatureInterest: Array.from(selectedFeatureInterest),
      selectedImprove: Array.from(selectedImprove),
      onboardingNoteSaved,
      sketchSaved,
      createdTaskIds: createdTasks.map(t => t.id),
      selectedJourneyId,
      notesFolders,
      tasksFolders,
      selectedLang,
      firstStepShown,
    };
    setSetting('onboarding_progress_state', state);
  }, [step, userName, avatarPreview, selectedGoal, selectedSource, selectedPreviousApp, selectedExperience, selectedWorkStyle, selectedEnergy, selectedTheme, selectedChallenges, selectedProductivity, selectedFocus, selectedSchedule, selectedCelebrate, selectedProgressTrack, selectedConsistency, selectedStreak, selectedRemind, selectedFeatureInterest, selectedImprove, onboardingNoteSaved, sketchSaved, createdTasks, selectedJourneyId, notesFolders, tasksFolders, selectedLang, firstStepShown]);

  // ===== FIRST STEP CELEBRATION — triggered after welcome screen =====
  // (No longer auto-triggers at step 15; instead triggered when user taps "Let's Go" on welcome screen)

  // Translated option arrays (must be inside component to access t())
  const tGoalOptions = useMemo(() => [
    t('onboarding.goalStudy'),
    t('onboarding.goalWork'),
    t('onboarding.goalPersonal'),
    t('onboarding.goalCreative'),
    t('onboarding.goalHealth'),
    t('onboarding.goalOther'),
  ], [t]);

  const tSourceOptions = useMemo(() => [
    t('onboarding.sourceInstagram'),
    t('onboarding.sourceFacebook'),
    t('onboarding.sourceTikTok'),
    t('onboarding.sourceYouTube'),
    t('onboarding.sourceFriends'),
    t('onboarding.sourceCreator'),
    t('onboarding.sourceAI'),
    t('onboarding.sourceOther'),
  ], [t]);

  const tPreviousAppOptions = useMemo(() => [
    t('onboarding.prevAppNotion'),
    t('onboarding.prevAppEvernote'),
    t('onboarding.prevAppTodoist'),
    t('onboarding.prevAppTickTick'),
    t('onboarding.prevAppAnyDo'),
    t('onboarding.prevAppEasyNotes'),
    t('onboarding.prevAppNone'),
  ], [t]);

  const tChallengeOptions = useMemo(() => [
    t('onboarding.challengeConsistent'),
    t('onboarding.challengePriorities'),
    t('onboarding.challengeDeadlines'),
    t('onboarding.challengeMotivated'),
    t('onboarding.challengeOrganizing'),
    t('onboarding.challengeHabits'),
    t('onboarding.challengeOther'),
  ], [t]);

  const tProductivityOptions = useMemo(() => [
    t('onboarding.prodMorning'),
    t('onboarding.prodTimeBlock'),
    t('onboarding.prodPomodoro'),
    t('onboarding.prodTodoLists'),
    t('onboarding.prodCalendar'),
    t('onboarding.prodNone'),
  ], [t]);

  const tFocusOptions = useMemo(() => [
    t('onboarding.focusWork'),
    t('onboarding.focusSchool'),
    t('onboarding.focusPersonal'),
    t('onboarding.focusHealth'),
    t('onboarding.focusCreative'),
    t('onboarding.focusDaily'),
  ], [t]);

  const tScheduleOptions = useMemo(() => [
    t('onboarding.schedFreely'),
    t('onboarding.schedFixed'),
    t('onboarding.schedShifts'),
    t('onboarding.schedChanges'),
    t('onboarding.schedOther'),
  ], [t]);

  const tCelebrateOptions = useMemo(() => [
    t('onboarding.celebShare'),
    t('onboarding.celebReward'),
    t('onboarding.celebBreak'),
    t('onboarding.celebBiggerGoal'),
    t('onboarding.celebJournal'),
    t('onboarding.celebOther'),
  ], [t]);

  const tProgressTrackOptions = useMemo(() => [
    t('onboarding.progReview'),
    t('onboarding.progScore'),
    t('onboarding.progStreaks'),
    t('onboarding.progAnalytics'),
    t('onboarding.progCompare'),
    t('onboarding.progOther'),
  ], [t]);

  const tConsistencyOptions = useMemo(() => [
    t('onboarding.consMorning'),
    t('onboarding.consNight'),
    t('onboarding.consAsNeeded'),
    t('onboarding.consWeekly'),
    t('onboarding.consDontKnow'),
  ], [t]);

  const tStreakOptions = useMemo(() => [
    t('onboarding.streak50'),
    t('onboarding.streak30'),
    t('onboarding.streak14'),
    t('onboarding.streak7'),
  ], [t]);

  const tRemindOptions = useMemo(() => [
    t('onboarding.remindPush'),
    t('onboarding.remindMorning'),
    t('onboarding.remindEvening'),
    t('onboarding.remindLocation'),
    t('onboarding.remindCalendar'),
    t('onboarding.remindOther'),
  ], [t]);

  const tFeatureInterestOptions = useMemo(() => [
    t('onboarding.featHabits'),
    t('onboarding.featSketch'),
    t('onboarding.featVoice'),
    t('onboarding.featAnalytics'),
    t('onboarding.featDarkMode'),
    t('onboarding.featWidgets'),
  ], [t]);

  const tImproveOptions = useMemo(() => [
    t('onboarding.impScreenTime'),
    t('onboarding.impProcrastinating'),
    t('onboarding.impMindful'),
    t('onboarding.impBalance'),
    t('onboarding.impSkills'),
    t('onboarding.impSleep'),
  ], [t]);

  const tExperienceOptions = useMemo(() => [
    { label: t('onboarding.expBeginner'), description: t('onboarding.expBeginnerDesc') },
    { label: t('onboarding.expIntermediate'), description: t('onboarding.expIntermediateDesc') },
    { label: t('onboarding.expAdvanced'), description: t('onboarding.expAdvancedDesc') },
  ], [t]);

  const tWorkStyleOptions = useMemo(() => [
    { label: t('onboarding.wsStructured'), description: t('onboarding.wsStructuredDesc') },
    { label: t('onboarding.wsFlexible'), description: t('onboarding.wsFlexibleDesc') },
    { label: t('onboarding.wsSprints'), description: t('onboarding.wsSprintsDesc') },
    { label: t('onboarding.wsMultitask'), description: t('onboarding.wsMultitaskDesc') },
  ], [t]);

  const tEnergyOptions = useMemo(() => [
    { label: t('onboarding.energyBird'), description: t('onboarding.energyBirdDesc') },
    { label: t('onboarding.energyOwl'), description: t('onboarding.energyOwlDesc') },
    { label: t('onboarding.energyAfternoon'), description: t('onboarding.energyAfternoonDesc') },
    { label: t('onboarding.energyVaries'), description: t('onboarding.energyVariesDesc') },
  ], [t]);

  const displayName = (userName.trim().split(/\s+/)[0]) || 'Friend';

  // Dynamic points based on selected goal
  const goalPointMap: Record<string, { icon: any; bg: string; color: string; key: string }> = useMemo(() => ({
    [t('onboarding.goalStudy')]: { icon: BookOpen, bg: '#EEF2FF', color: '#4F46E5', key: 'infoGoalStudy' },
    [t('onboarding.goalWork')]: { icon: Briefcase, bg: '#F0F9FF', color: '#0284C7', key: 'infoGoalWork' },
    [t('onboarding.goalPersonal')]: { icon: Heart, bg: '#FEF2F2', color: '#DC2626', key: 'infoGoalPersonal' },
    [t('onboarding.goalCreative')]: { icon: Palette, bg: '#FDF4FF', color: '#A855F7', key: 'infoGoalCreative' },
    [t('onboarding.goalHealth')]: { icon: Activity, bg: '#ECFDF5', color: '#059669', key: 'infoGoalHealth' },
    [t('onboarding.goalOther')]: { icon: Lightbulb, bg: '#FFF7ED', color: '#EA580C', key: 'infoGoalOther' },
  }), [t]);

  const expPointMap: Record<string, { icon: any; bg: string; color: string; key: string }> = useMemo(() => ({
    [t('onboarding.expBeginner')]: { icon: Sparkles, bg: '#FEFCE8', color: '#CA8A04', key: 'infoExpBeginner' },
    [t('onboarding.expIntermediate')]: { icon: Zap, bg: '#FFF7ED', color: '#EA580C', key: 'infoExpIntermediate' },
    [t('onboarding.expAdvanced')]: { icon: Rocket, bg: '#F0F9FF', color: '#0284C7', key: 'infoExpAdvanced' },
  }), [t]);

  const dynamicPoints = useMemo(() => {
    const points: { icon: any; bg: string; color: string; text: string }[] = [];
    const goalEntry = selectedGoal ? goalPointMap[selectedGoal] : null;
    if (goalEntry) points.push({ icon: goalEntry.icon, bg: goalEntry.bg, color: goalEntry.color, text: t(`onboarding.${goalEntry.key}`) });
    const expEntry = selectedExperience ? expPointMap[selectedExperience] : null;
    if (expEntry) points.push({ icon: expEntry.icon, bg: expEntry.bg, color: expEntry.color, text: t(`onboarding.${expEntry.key}`) });
    points.push({ icon: Trophy, bg: '#FEFCE8', color: '#CA8A04', text: t('onboarding.infoPersonalizedPoint3') });
    return points;
  }, [selectedGoal, selectedExperience, goalPointMap, expPointMap, t]);

  const tInfoScreens = useMemo(() => ({
    15: {
      title: t('onboarding.infoPersonalizedTitle', { name: displayName }),
      icons: [
        { icon: CheckCircle2, bg: '#ECFDF5', color: '#059669' },
        { icon: PenLine, bg: '#EEF2FF', color: '#4F46E5' },
        { icon: Target, bg: '#FEF2F2', color: '#DC2626' },
      ],
      points: dynamicPoints,
      button: t('onboarding.soundsGreat'),
    },
    5: {
      title: t('onboarding.info1Title'),
      icons: [] as { icon: any; bg: string; color: string }[],
      points: [
        { icon: FlaskConical, bg: '#F0F9FF', color: '#0284C7', text: t('onboarding.info1Point1') },
        { icon: Link, bg: '#EEF2FF', color: '#4F46E5', text: t('onboarding.info1Point2') },
        { icon: Monitor, bg: '#FAF5FF', color: '#9333EA', text: t('onboarding.info1Point3') },
      ],
      button: t('onboarding.gotIt'),
    },
    13: {
      title: t('onboarding.info2Title'),
      icons: [] as { icon: any; bg: string; color: string }[],
      points: [
        { icon: TrendingUp, bg: '#ECFDF5', color: '#059669', text: t('onboarding.info2Point1') },
        { icon: Brain, bg: '#FAF5FF', color: '#9333EA', text: t('onboarding.info2Point2') },
        { icon: Zap, bg: '#FEFCE8', color: '#CA8A04', text: t('onboarding.info2Point3') },
      ],
      button: t('onboarding.continue'),
    },
    21: {
      title: t('onboarding.info3Title'),
      icons: [
        { icon: PenLine, bg: '#EEF2FF', color: '#4F46E5' },
        { icon: CheckCircle2, bg: '#ECFDF5', color: '#059669' },
        { icon: CalendarDays, bg: '#FFF7ED', color: '#EA580C' },
        { icon: Target, bg: '#FEF2F2', color: '#DC2626' },
        { icon: Star, bg: '#FFF1F2', color: '#E11D48' },
      ],
      points: [
        { icon: Rocket, bg: '#EEF2FF', color: '#4F46E5', text: t('onboarding.info3Point1') },
        { icon: Star, bg: '#FFF1F2', color: '#E11D48', text: t('onboarding.info3Point2') },
        { icon: Heart, bg: '#FEF2F2', color: '#DC2626', text: t('onboarding.info3Point3') },
      ],
      button: t('onboarding.letsGo'),
    },
  }), [t]);

  const tFeatureShowcase = useMemo(() => [
    { icon: CheckCircle2, bg: '#ECFDF5', color: '#059669', title: t('onboarding.showcaseSmartTask'), description: t('onboarding.showcaseSmartTaskDesc') },
    { icon: PenLine, bg: '#EEF2FF', color: '#4F46E5', title: t('onboarding.showcaseRichNotes'), description: t('onboarding.showcaseRichNotesDesc') },
    { icon: Target, bg: '#FEF2F2', color: '#DC2626', title: t('onboarding.showcaseHabits'), description: t('onboarding.showcaseHabitsDesc') },
    { icon: Palette, bg: '#FAF5FF', color: '#9333EA', title: t('onboarding.showcaseThemes'), description: t('onboarding.showcaseThemesDesc') },
    { icon: BarChart3, bg: '#FFF7ED', color: '#EA580C', title: t('onboarding.showcaseAnalytics'), description: t('onboarding.showcaseAnalyticsDesc') },
    { icon: Bell, bg: '#F0F9FF', color: '#0284C7', title: t('onboarding.showcaseReminders'), description: t('onboarding.showcaseRemindersDesc') },
  ], [t]);

  const tPlanSteps = useMemo(() => [
    t('onboarding.loadingAnalyzing'),
    t('onboarding.loadingBuilding'),
    t('onboarding.loadingSettingUp'),
    t('onboarding.loadingFinishing'),
  ], [t]);
  const [onboardingSections, setOnboardingSections] = useState<TaskSection[]>([]);
  const [onboardingFolders, setOnboardingFolders] = useState<Folder[]>([]);

  useEffect(() => {
    (async () => {
      const savedSections = await getSetting<TaskSection[]>('todoSections', []);
      if (savedSections.length > 0) setOnboardingSections(savedSections);
      else setOnboardingSections([{ id: 'default', name: 'Tasks', color: '#3b82f6', isCollapsed: false, order: 0 }]);
      const savedFolders = await getSetting<Folder[] | null>('todoFolders', null);
      if (savedFolders) setOnboardingFolders(savedFolders.map((f: any) => ({ ...f, createdAt: new Date(f.createdAt) })));
    })();
  }, []);

  const handleSelectGoal = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedGoal(option);
  }, []);

  const handleToggleProductivity = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedProductivity(prev => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }, []);

  const handleSelectFocus = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedFocus(option);
  }, []);

  const handleSelectSchedule = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedSchedule(option);
  }, []);

  const handleToggleCelebrate = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedCelebrate(prev => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }, []);

  const handleToggleProgressTrack = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedProgressTrack(prev => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }, []);

  const handleSelectConsistency = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedConsistency(option);
  }, []);

  const handleSelectStreak = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedStreak(option);
  }, []);

  const handleToggleRemind = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedRemind(prev => { const n = new Set(prev); n.has(option) ? n.delete(option) : n.add(option); return n; });
  }, []);

  const handleToggleFeatureInterest = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedFeatureInterest(prev => { const n = new Set(prev); n.has(option) ? n.delete(option) : n.add(option); return n; });
  }, []);

  const handleToggleImprove = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedImprove(prev => { const n = new Set(prev); n.has(option) ? n.delete(option) : n.add(option); return n; });
  }, []);

  const handleSelectSource = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedSource(option);
  }, []);

  const handleToggleChallenge = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedChallenges(prev => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }, []);

  const handleSelectPreviousApp = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedPreviousApp(option);
  }, []);

  const handleSelectExperience = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedExperience(option);
  }, []);

  const handleSelectWorkStyle = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedWorkStyle(option);
  }, []);

  const handleSelectEnergy = useCallback(async (option: string) => {
    triggerSelectionHaptic();
    setSelectedEnergy(option);
  }, []);

  // Save note to DB
  const saveOnboardingNote = useCallback(async () => {
    if (!onboardingNoteTitle.trim() && !onboardingNoteContent.trim()) return;
    const note: Note = {
      id: crypto.randomUUID(),
      type: 'regular',
      title: onboardingNoteTitle.trim() || 'My First Note',
      content: onboardingNoteContent.trim(),
      voiceRecordings: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await saveNoteToDBSingle(note);
    setOnboardingNoteSaved(true);
    await triggerSelectionHaptic();
  }, [onboardingNoteTitle, onboardingNoteContent]);

  // Save sketch to DB
  const saveOnboardingSketch = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSketchDataUrl(dataUrl);
    const note: Note = {
      id: crypto.randomUUID(),
      type: 'sketch',
      title: 'My First Sketch',
      content: dataUrl,
      voiceRecordings: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await saveNoteToDBSingle(note);
    setSketchSaved(true);
    await triggerSelectionHaptic();
  }, []);

  // Save task
  const saveOnboardingTask = useCallback(async () => {
    if (!onboardingTaskText.trim()) return;
    const now = new Date();
    const task: TodoItem = {
      id: crypto.randomUUID(),
      text: onboardingTaskText.trim(),
      completed: false,
      description: onboardingTaskDesc.trim() || undefined,
      createdAt: now,
      modifiedAt: now,
    };
    const existing = await loadTodoItems();
    await saveTodoItems([task, ...existing]);
    setCreatedTask(task);
    setEditTaskText(task.text);
    setEditTaskDesc(task.description || '');
    await triggerSelectionHaptic();
  }, [onboardingTaskText, onboardingTaskDesc]);

  // Update task
  const updateOnboardingTask = useCallback(async () => {
    if (!createdTask || !editTaskText.trim()) return;
    const updated = { ...createdTask, text: editTaskText.trim(), description: editTaskDesc.trim() || undefined };
    const existing = await loadTodoItems();
    const newItems = existing.map(t => t.id === updated.id ? updated : t);
    await saveTodoItems(newItems);
    setCreatedTask(updated);
    setEditingTask(false);
    await triggerSelectionHaptic();
  }, [createdTask, editTaskText, editTaskDesc]);

  // Canvas drawing handlers
  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.strokeStyle = sketchColor;
    ctx.lineWidth = sketchBrushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [sketchColor, sketchBrushSize]);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo((clientX - rect.left) * scaleX, (clientY - rect.top) * scaleY);
    ctx.stroke();
  }, [isDrawing]);

  const stopDraw = useCallback(() => { setIsDrawing(false); }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // New step flow:
  // 0:goal 1:source 2:experience 3:profile 4:challenges
  // 5:INFO 6:CREATE_NOTE 7:productivity 8:focus
  // 9:workstyle 10:CREATE_SKETCH 11:schedule 12:celebrate
  // 13:INFO 14:CREATE_TASK 15:VIEW_EDIT_TASK 16:progress 17:consistency
  // 18:energy 19:streak 20:remind
  // 21:INFO 22:features 23:improve
  // 24:JOURNEY_SELECT 25:showcase 26:loading 27:welcome

  const goNext = useCallback(async () => {
    triggerSelectionHaptic();

    if (step === 0) {
      if (!selectedGoal) return;
      await setSetting('onboarding_goal', selectedGoal);
      setStep(1);
    } else if (step === 1) {
      if (!selectedSource) return;
      await setSetting('onboarding_source', selectedSource);
      setStep(2);
    } else if (step === 2) {
      if (!selectedExperience) return;
      await setSetting('onboarding_experience', selectedExperience);
      setStep(28); // → previous app
    } else if (step === 28) {
      if (!selectedPreviousApp) return;
      await setSetting('onboarding_previous_app', selectedPreviousApp);
      setStep(3); // → profile setup
    } else if (step === 3) {
      if (!userName.trim()) return;
      const existing = await loadUserProfile();
      await saveUserProfile({ ...existing, name: userName.trim(), avatarUrl: avatarPreview || existing.avatarUrl });
      setStep(15); // → personalized plan info screen (now with name)
    } else if (step === 15) {
      setStep(4);
    } else if (step === 4) {
      if (selectedChallenges.size === 0) return;
      await setSetting('onboarding_challenges', Array.from(selectedChallenges));
      setStep(24); // → journey selection (right after challenges)
    } else if (step === 5 && !showNotesFolderCreation && !showTasksFolderCreation) {
      setShowNotesFolderCreation(true); // INFO → Notes folder creation
    } else if (step === 5 && showNotesFolderCreation) {
      // Save notes folders to settings (same key as Notes page: 'folders')
      if (notesFolders.length > 0) {
        const existingFolders = await getSetting<Folder[]>('folders', []);
        const newFolders: Folder[] = notesFolders.map(f => ({
          id: f.id,
          name: f.name,
          color: f.color,
          isDefault: false,
          createdAt: new Date(),
        }));
        await setSetting('folders', [...existingFolders, ...newFolders]);
        window.dispatchEvent(new Event('foldersUpdated'));
      }
      setShowNotesFolderCreation(false);
      setShowTasksFolderCreation(true); // → Tasks folder creation
    } else if (step === 5 && showTasksFolderCreation) {
      // Save tasks folders to settings (same key as Tasks page: 'todoFolders')
      if (tasksFolders.length > 0) {
        const existingFolders = await getSetting<Folder[]>('todoFolders', []);
        const newFolders: Folder[] = tasksFolders.map(f => ({
          id: f.id,
          name: f.name,
          color: f.color,
          isDefault: false,
          createdAt: new Date(),
        }));
        await setSetting('todoFolders', [...existingFolders, ...newFolders]);
        window.dispatchEvent(new Event('foldersUpdated'));
      }
      setShowTasksFolderCreation(false);
      setStep(6); // → create note
    } else if (step === 6) {
      // Save note if not saved yet
      if (!onboardingNoteSaved && (onboardingNoteTitle.trim() || onboardingNoteContent.trim())) {
        await saveOnboardingNote();
      }
      setStep(7); // → productivity (skip journey, already done earlier)
    } else if (step === 24) {
      // Save journey selection, then continue to info screen
      if (selectedJourneyId) {
        startJourney(selectedJourneyId);
      }
      setStep(5); // → info screen + folders
    } else if (step === 7) {
      if (selectedProductivity.size === 0) return;
      await setSetting('onboarding_productivity', Array.from(selectedProductivity));
      setStep(8);
    } else if (step === 8) {
      if (!selectedFocus) return;
      await setSetting('onboarding_focus', selectedFocus);
      setStep(9);
    } else if (step === 9) {
      if (!selectedWorkStyle) return;
      await setSetting('onboarding_workstyle', selectedWorkStyle);
      setStep(10); // workstyle+energy → create sketch
    } else if (step === 10) {
      // Save sketch if not saved
      if (!sketchSaved) {
        await saveOnboardingSketch();
      }
      setStep(11);
    } else if (step === 11) {
      if (!selectedSchedule) return;
      await setSetting('onboarding_schedule', selectedSchedule);
      setStep(12);
    } else if (step === 12) {
      if (selectedCelebrate.size === 0) return;
      await setSetting('onboarding_celebrate', Array.from(selectedCelebrate));
      setStep(13);
    } else if (step === 13) {
      setStep(14); // INFO → create task
    } else if (step === 14) {
      // Tasks saved via Today page, skip old step 15, go directly to 16
      setStep(16);
    } else if (step === 15) {
    } else if (step === 16) {
      if (selectedProgressTrack.size === 0) return;
      await setSetting('onboarding_progress_track', Array.from(selectedProgressTrack));
      setStep(17);
    } else if (step === 17) {
      if (!selectedConsistency) return;
      await setSetting('onboarding_consistency', selectedConsistency);
      setStep(19); // Skip theme step, go directly to streak
    } else if (step === 19) {
      if (!selectedStreak) return;
      await setSetting('onboarding_streak_goal', selectedStreak);
      setStep(20);
    } else if (step === 20) {
      if (selectedRemind.size === 0) return;
      await setSetting('onboarding_remind', Array.from(selectedRemind));
      setStep(21);
    } else if (step === 21) {
      setStep(22); // INFO → features
    } else if (step === 22) {
      if (selectedFeatureInterest.size === 0) return;
      await setSetting('onboarding_feature_interest', Array.from(selectedFeatureInterest));
      setStep(23);
    } else if (step === 23) {
      if (selectedImprove.size === 0) return;
      await setSetting('onboarding_improve', Array.from(selectedImprove));
      setStep(25); // skip journey (already done), go to showcase
    } else if (step === 25) {
      setStep(26); // loading screen
    }
  }, [step, selectedGoal, selectedSource, userName, avatarPreview, selectedChallenges, selectedProductivity, selectedFocus, selectedSchedule, selectedCelebrate, selectedProgressTrack, selectedConsistency, selectedStreak, selectedRemind, selectedFeatureInterest, selectedImprove, selectedExperience, selectedWorkStyle, selectedEnergy, selectedTheme, onboardingNoteSaved, onboardingNoteTitle, onboardingNoteContent, saveOnboardingNote, sketchSaved, saveOnboardingSketch, createdTask, onboardingTaskText, saveOnboardingTask, editingTask, updateOnboardingTask, showNotesFolderCreation, showTasksFolderCreation, notesFolders, tasksFolders, selectedJourneyId]);

  const handleFinishWelcome = useCallback(async () => {
    triggerSelectionHaptic();
    // If user earned the first step badge, show celebration before paywall
    const earned = onboardingNoteSaved && sketchSaved && createdTasks.length > 0;
    if (earned && !firstStepShown) {
      setFirstStepShown(true);
      await setSetting('flowist_first_step_earned', {
        userName: userName.trim(),
        earnedAt: new Date().toISOString(),
      });
      setShowStreakDay1(true);
    } else {
      // No celebration needed, show streak day 1
      setShowStreakDay1(true);
    }
  }, [onComplete, openPaywall, onboardingNoteSaved, sketchSaved, createdTasks.length, firstStepShown, userName]);

  const handleBack = useCallback(async () => {
    await triggerSelectionHaptic();
    // On interactive steps, back saves and goes FORWARD (next question)
    if (step === 6) {
      // Note editor handles its own saving via onSave
      setOnboardingNoteSaved(true);
      setStep(7);
      return;
    }
    if (step === 10) {
      setSketchSaved(true);
      setStep(11);
      return;
    }
    if (step === 14) {
      setStep(16);
      return;
    }
    if (step === 16) {
      setStep(14);
      return;
    }
    if (step === 0) setStep(-3);
    else if (step === 28) setStep(2); // back from previous app → experience
    else if (step === 3) setStep(28); // back from profile → previous app
    else if (step === 15) setStep(3); // back from personalized info → profile
    else if (step === 7) setStep(6); // back from productivity → create note
    else if (step === 5) setStep(24); // back from info → journey
    else if (step === 24) setStep(4); // back from journey → challenges
    else if (step === 25) setStep(23); // back from showcase → improve
    else if (step > 0 && step < 25) setStep(step - 1);
  }, [step, createdTask, onboardingTaskText, saveOnboardingTask, editingTask, updateOnboardingTask]);

  const handleImagePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropImageSrc(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  useEffect(() => {
    if (step === 14) {
      setIsTaskInputSheetOpen(true);
    }
  }, [step]);

  const INFO_STEPS = new Set([5, 13, 15, 21]);
  const INTERACTIVE_STEPS = new Set([6, 10, 14]);

  // Sequential flow order mapping: internal step → display position (exclude pre-steps -3,-2,-1)
  // Step 5 has 3 sub-screens (info, notes folders, tasks folders) — use 5.1/5.2 as virtual entries
  const FLOW_ORDER: number[] = [0, 1, 2, 28, 3, 15, 4, 24, 5, 5.1, 5.2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 21, 22, 23, 25, 26, 27];
  const stepCount = FLOW_ORDER.length;
  // For step 5, determine sub-step based on folder creation state
  const getDisplayStep = () => {
    if (step === 5) {
      if (showTasksFolderCreation) return FLOW_ORDER.indexOf(5.2) + 1;
      if (showNotesFolderCreation) return FLOW_ORDER.indexOf(5.1) + 1;
      return FLOW_ORDER.indexOf(5) + 1;
    }
    const flowIndex = FLOW_ORDER.indexOf(step);
    return flowIndex >= 0 ? flowIndex + 1 : step < 0 ? 0 : Math.min(step + 1, stepCount);
  };
  const displayStep = getDisplayStep();
  const stepLabel = step < 0 ? '' : `${displayStep} / ${stepCount}`;
  const progressPercent = step < 0 ? '0%' : `${Math.min(100, Math.round(((displayStep - 1 + (currentStepDone() ? 1 : 0.4)) / stepCount) * 100))}%`;

  function currentStepDone() {
    if (INFO_STEPS.has(step)) return true;
    if (INTERACTIVE_STEPS.has(step)) return true;
    if (step === 2) return !!selectedExperience;
    if (step === 28) return !!selectedPreviousApp;
    if (step === 9) return !!selectedWorkStyle;
    if (step === 18) return true; // theme step skipped
    if (step === 0) return !!selectedGoal;
    if (step === 1) return !!selectedSource;
    if (step === 3) return !!userName.trim();
    if (step === 4) return selectedChallenges.size > 0;
    if (step === 7) return selectedProductivity.size > 0;
    if (step === 8) return !!selectedFocus;
    if (step === 11) return !!selectedSchedule;
    if (step === 12) return selectedCelebrate.size > 0;
    if (step === 16) return selectedProgressTrack.size > 0;
    if (step === 17) return !!selectedConsistency;
    if (step === 19) return !!selectedStreak;
    if (step === 20) return selectedRemind.size > 0;
    if (step === 22) return selectedFeatureInterest.size > 0;
    if (step === 23) return selectedImprove.size > 0;
    return true;
  }

  const currentValid = currentStepDone();

  // displayName already defined above

  // Add/remove body class for z-index overrides on Radix portals
  useEffect(() => {
    if ([6, 10, 14, 15].includes(step)) {
      document.body.classList.add('onboarding-active');
    } else {
      document.body.classList.remove('onboarding-active');
    }
    return () => { document.body.classList.remove('onboarding-active'); };
  }, [step]);

  // Welcome splash (step -1) removed

  // Language selection screen (step -3)
  if (step === -3) {
    const languages = [
      { code: 'en', name: 'English', native: 'English' },
      { code: 'es', name: 'Spanish', native: 'Español' },
      { code: 'fr', name: 'French', native: 'Français' },
      { code: 'de', name: 'German', native: 'Deutsch' },
      { code: 'pt', name: 'Portuguese', native: 'Português' },
      { code: 'it', name: 'Italian', native: 'Italiano' },
      { code: 'tr', name: 'Turkish', native: 'Türkçe' },
      { code: 'ar', name: 'Arabic', native: 'العربية' },
      { code: 'he', name: 'Hebrew', native: 'עברית' },
      { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
      { code: 'ur', name: 'Urdu', native: 'اردو' },
      { code: 'ko', name: 'Korean', native: '한국어' },
      { code: 'zh', name: 'Chinese', native: '中文' },
      { code: 'ja', name: 'Japanese', native: '日本語' },
      { code: 'bn', name: 'Bengali', native: 'বাংলা' },
      { code: 'ru', name: 'Russian', native: 'Русский' },
      { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
      { code: 'mr', name: 'Marathi', native: 'मराठी' },
      { code: 'te', name: 'Telugu', native: 'తెలుగు' },
      { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    ];
    const currentLang = selectedLang;

    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center pt-10 pb-4"
        >
          <div className="flex items-center gap-2.5">
            <motion.img
              src="/favicon.webp"
              alt="Flowist"
              className="w-9 h-9 rounded-xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.4, delay: 0.1 }}
            />
            <span style={{ fontFamily: "'Nunito', 'Quicksand', sans-serif", fontWeight: 900, fontSize: 28, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
              Flowist
            </span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-center text-[22px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight mb-1 px-6"
        >
          {t('onboarding.selectLanguage')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center text-[13px] text-[#767b7e] font-['Nunito_Sans'] mb-4 px-6"
        >
          {t('onboarding.chooseLanguage')}
        </motion.p>

        {/* Language list */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <div className="space-y-2">
            {languages.map((lang, i) => (
              <motion.button
                key={lang.code}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.1 + i * 0.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  await triggerSelectionHaptic();
                  setSelectedLang(lang.code);
                  i18n.changeLanguage(lang.code);
                  localStorage.setItem('flowist_language', lang.code);
                  const rtl = ['ar', 'he', 'ur'].includes(lang.code);
                  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
                  document.documentElement.lang = lang.code;
                }}
                className="w-full text-left px-4 py-3.5 rounded-xl transition-all cursor-pointer flex items-center justify-between"
                style={{
                  backgroundColor: currentLang === lang.code ? `${ONBOARDING_COLOR}20` : '#ffffff',
                  border: `2px solid ${currentLang === lang.code ? ONBOARDING_COLOR : '#eee'}`,
                  boxShadow: currentLang === lang.code ? `0 3px 0 0 ${ONBOARDING_COLOR}` : '0 3px 0 0 #e8e8e8',
                }}
              >
                <div>
                  <span className="font-bold text-[15px] text-[#1a1a1a]">{lang.native}</span>
                  <span className="text-[12px] text-[#999] ml-2">{lang.name}</span>
                </div>
                {currentLang === lang.code && (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Continue button */}
        <div className="px-6 pb-6 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={async () => { await triggerSelectionHaptic(); setStep(0); }}
            className="w-full max-w-[340px] mx-auto py-3 rounded-2xl text-[16px] font-bold block"
            style={{ backgroundColor: '#333333', color: '#ffffff', boxShadow: '0 8px 0 0 #000000' }}
            whileTap={{ scale: 0.97 }}
          >
            {t('onboarding.continue')}
          </motion.button>
        </div>
      </div>
    );
  }

  // Trust screen removed

  // Folder creation screens (shown during step 5)
  if (step === 5 && showNotesFolderCreation) {
    return <OnboardingFolderCreation
      type="notes"
      folders={notesFolders}
      setFolders={setNotesFolders}
      progressPercent={progressPercent}
      stepLabel={stepLabel}
      handleBack={() => { setShowNotesFolderCreation(false); }}
      goNext={goNext}
    />;
  }
  if (step === 5 && showTasksFolderCreation) {
    return <OnboardingFolderCreation
      type="tasks"
      folders={tasksFolders}
      setFolders={setTasksFolders}
      progressPercent={progressPercent}
      stepLabel={stepLabel}
      handleBack={() => { setShowTasksFolderCreation(false); setShowNotesFolderCreation(true); }}
      goNext={goNext}
    />;
  }

  // Info screens
  const infoData = tInfoScreens[step as keyof typeof tInfoScreens];
  if (infoData) {
    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Top bar */}
        <div className="flex items-end gap-3 px-4 pt-3 pb-2">
          <button
            className="w-[17px] h-[17px] flex items-center justify-center"
            onClick={handleBack}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
          </button>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[#999] text-right">{stepLabel}</span>
            <div className="h-[17px] rounded-[6px] bg-[#e5e5e5] overflow-hidden">
              <motion.div
                className="h-full"
                style={{ backgroundColor: ONBOARDING_COLOR }}
                initial={{ width: '0%' }}
                animate={{ width: progressPercent }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Icon banner */}
        {infoData.icons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center gap-3 py-6 px-4"
          >
            {infoData.icons.map((item, i) => {
              const IconComp = item.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 * i, type: 'spring', stiffness: 200 }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: item.bg }}
                >
                  <IconComp size={18} color={item.color} strokeWidth={2} />
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <div className="flex-1 flex flex-col justify-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-[30px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-center leading-tight mb-10"
          >
            {infoData.title}
          </motion.h1>

          <div className="flex flex-col gap-6 px-2">
            {infoData.points.map((point, i) => {
              const PointIcon = point.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.15 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: point.bg }}>
                    <PointIcon size={18} color={point.color} strokeWidth={2} />
                  </div>
                  <p className="text-[15px] text-[#4a4f54] leading-relaxed pt-2 font-['Nunito_Sans']">{point.text}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom button */}
        <div className="px-6 pb-6 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={goNext}
            className="w-full py-3 rounded-2xl text-[17px] font-bold"
            style={{
              backgroundColor: '#333333',
              color: '#ffffff',
              boxShadow: '0 8px 0 0 #000000',
            }}
            whileTap={{ scale: 0.97 }}
          >
            {infoData.button}
          </motion.button>
        </div>
      </div>
    );
  }

  // ============ CREATE NOTE SCREEN (step 6) — Real NoteEditor ============
  if (step === 6) {
    return (
      <div className="fixed inset-0 z-[300]">
        <MemoryRouter>
          <NoteEditor
            note={null}
            isOpen={true}
            onClose={() => {
              setOnboardingNoteSaved(true);
              setStep(7);
            }}
            onSave={(note) => {
              setOnboardingNoteSaved(true);
            }}
            defaultType="regular"
          />
        </MemoryRouter>
      </div>
    );
  }

  // ============ CREATE SKETCH SCREEN (step 10) — Real NoteEditor in sketch mode ============
  if (step === 10) {
    return (
      <div className="fixed inset-0 z-[300]">
        <MemoryRouter>
          <NoteEditor
            note={null}
            isOpen={true}
            onClose={() => {
              setSketchSaved(true);
              setStep(11);
            }}
            onSave={(note) => {
              // Just mark as saved, do NOT advance — only back button (onClose) advances
              setSketchSaved(true);
            }}
            defaultType="sketch"
          />
        </MemoryRouter>
      </div>
    );
  }

  // ============ CREATE TASK SCREEN (step 14) — Real Today page with TaskInputSheet auto-open ============
  if (step === 14) {
    const MAX_ONBOARDING_TASKS = 3;
    const canAddMore = createdTasks.length < MAX_ONBOARDING_TASKS;

    return (
      <div className="fixed inset-0 z-[300] flex flex-col bg-white" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {/* Onboarding progress header */}
        <div className="flex items-center gap-3 px-4 pt-1 pb-1 relative z-50 bg-white">
          <button className="w-[17px] h-[17px] flex items-center justify-center" onClick={handleBack} aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
          </button>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[#999] text-right">{stepLabel}</span>
            <div className="h-[17px] rounded-[6px] bg-[#e5e5e5] overflow-hidden">
              <motion.div className="h-full" style={{ backgroundColor: ONBOARDING_COLOR }} initial={{ width: '0%' }} animate={{ width: progressPercent }} transition={{ duration: 0.5, ease: 'easeOut' }} />
            </div>
          </div>
        </div>

        {/* Real Today page embedded */}
        <div className="flex-1 overflow-hidden relative">
          <Suspense fallback={null}>
            <MemoryRouter initialEntries={['/todo/today']}>
              <TodayPage />
            </MemoryRouter>
          </Suspense>
        </div>

        {/* Bottom buttons - hide when task input sheet is open */}
        {!isTaskInputSheetOpen && (
          <div className="px-4 pb-2 pt-1 flex flex-col gap-1.5 relative z-50 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
            <motion.button onClick={goNext} className="w-full py-3 rounded-2xl text-[17px] font-bold" style={{ backgroundColor: '#333333', color: '#ffffff', boxShadow: '0 8px 0 0 #000000' }} whileTap={{ scale: 0.97 }}>
              {createdTasks.length > 0 ? `${t('onboarding.continue')} · ${createdTasks.length} task${createdTasks.length > 1 ? 's' : ''}` : t('onboarding.continue')}
            </motion.button>
          </div>
        )}

        {/* TaskInputSheet auto-opens */}
        {canAddMore && (
          <TaskInputSheet
            isOpen={isTaskInputSheetOpen}
            onClose={() => {
              setIsTaskInputSheetOpen(false);
            }}
            onAddTask={async (taskData) => {
              const now = new Date();
              const task: TodoItem = {
                id: crypto.randomUUID(),
                completed: false,
                createdAt: now,
                modifiedAt: now,
                ...taskData,
              };
              const existing = await loadTodoItems();
              await saveTodoItems([task, ...existing]);
              // Notify embedded TodayPage to reload tasks from IndexedDB
              window.dispatchEvent(new Event('tasksRestored'));
              setCreatedTasks(prev => {
                const updated = [...prev, task];
                // Auto-close sheet if max reached
                if (updated.length >= MAX_ONBOARDING_TASKS) {
                  setIsTaskInputSheetOpen(false);
                }
                return updated;
              });
              setCreatedTask(task);
              await triggerSelectionHaptic();
            }}
            folders={onboardingFolders}
            onCreateFolder={(name) => {
              const newFolder: Folder = { id: crypto.randomUUID(), name, isDefault: false, createdAt: new Date() };
              setOnboardingFolders(prev => [...prev, newFolder]);
              setSetting('todoFolders', [...onboardingFolders, newFolder]);
            }}
            sections={onboardingSections}
          />
        )}
      </div>
    );
  }


  // ============ STREAK DAY 1 SCREEN ============
  if (showStreakDay1) {
    return (
      <StreakDay1Screen
        userName={userName}
        onContinue={async () => {
          setShowStreakDay1(false);
          setShowOnboardingCertificate(true);
        }}
      />
    );
  }

  // ============ ONBOARDING CERTIFICATE OVERLAY ============
  if (showOnboardingCertificate) {
    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-4">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[28px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-center mb-1"
          >
            Your Streak Certificate 🔥
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[13px] text-[#767b7e] font-['Nunito_Sans'] text-center mb-5"
          >
            Share your consistency with the world!
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <StreakConsistencyCertificate
              currentStreak={1}
              totalCompletions={1}
              longestStreak={1}
            />
          </motion.div>
        </div>
        <div className="px-6 pb-6 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
          <motion.button
            onClick={async () => {
              setShowOnboardingCertificate(false);
              await setSetting('onboarding_completed', true);
              await setSetting('onboarding_progress_state', null);
              onComplete();
              setTimeout(() => openPaywall(), 300);
            }}
            className="w-full py-3 rounded-2xl text-[17px] font-bold"
            style={{ backgroundColor: '#333333', color: '#ffffff', boxShadow: '0 8px 0 0 #000000' }}
            whileTap={{ scale: 0.97 }}
          >
            Continue
          </motion.button>
        </div>
      </div>
    );
  }


  // Journey selection screen (step 24)
  if (step === 24) {
    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-end gap-3 px-4 pt-3 pb-2">
          <motion.button
            className="w-[17px] h-[17px] flex items-center justify-center cursor-pointer"
            onClick={handleBack}
            aria-label="Back"
            whileTap={{ scale: 0.85 }}
          >
            <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
          </motion.button>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[#999] text-right">{stepLabel}</span>
            <div className="h-[17px] rounded-[6px] bg-[#e5e5e5] overflow-hidden">
              <motion.div className="h-full" style={{ backgroundColor: ONBOARDING_COLOR }} initial={{ width: '0%' }} animate={{ width: progressPercent }} transition={{ duration: 0.5, ease: 'easeOut' }} />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col px-6 pt-4 overflow-y-auto pb-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-3xl mb-2 block">🧭</span>
            <h1 className="text-[24px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight leading-tight">Choose Your Adventure</h1>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[13px] text-[#767b7e] font-['Nunito_Sans'] mb-5">
            Complete tasks to travel the world! Pick a journey to start.
          </motion.p>

          <div className="space-y-3">
            {ALL_JOURNEYS.map((journey, i) => (
              <motion.button
                key={journey.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.06 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { triggerSelectionHaptic(); setSelectedJourneyId(selectedJourneyId === journey.id ? null : journey.id); }}
                className="w-full text-left p-4 rounded-2xl transition-all cursor-pointer"
                style={{
                  backgroundColor: selectedJourneyId === journey.id ? `${ONBOARDING_COLOR}20` : '#ffffff',
                  border: `2px solid ${selectedJourneyId === journey.id ? ONBOARDING_COLOR : '#e8e8e8'}`,
                  boxShadow: selectedJourneyId === journey.id ? `0 4px 0 0 ${ONBOARDING_COLOR}` : '0 4px 0 0 #e4e8ea',
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{journey.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-[15px] text-[#1a1a1a]">{journey.name}</h4>
                    </div>
                    <p className="text-[12px] text-[#767b7e] mt-0.5 leading-relaxed">{journey.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[#767b7e] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
                        {journey.totalTasks} tasks
                      </span>
                      <span className="text-[10px] text-[#767b7e] bg-[#f3f4f6] px-2 py-0.5 rounded-full">
                        {t('onboarding.milestonesCount', { count: journey.milestones.length })}
                      </span>
                    </div>
                  </div>
                  {selectedJourneyId === journey.id && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
          <motion.button
            onClick={goNext}
            className="w-full py-3 rounded-2xl text-[17px] font-bold cursor-pointer"
            style={{
              backgroundColor: selectedJourneyId ? '#333333' : '#ebeff2',
              color: selectedJourneyId ? '#ffffff' : '#767b7e',
              boxShadow: selectedJourneyId ? '0 8px 0 0 #000000' : 'none',
            }}
            whileTap={selectedJourneyId ? { scale: 0.97 } : {}}
          >
            {selectedJourneyId ? t('onboarding.startJourney') : t('onboarding.skip')}
          </motion.button>
        </div>
      </div>
    );
  }

  // Feature showcase screen (step 25)
  if (step === 25) {
    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-end gap-3 px-4 pt-3 pb-2">
          <button className="w-[17px] h-[17px] flex items-center justify-center" onClick={handleBack} aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
          </button>
          <div className="flex-1 flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-[#999] text-right">{stepLabel}</span>
            <div className="h-[17px] rounded-[6px] bg-[#e5e5e5] overflow-hidden">
              <motion.div className="h-full" style={{ backgroundColor: ONBOARDING_COLOR }} initial={{ width: '0%' }} animate={{ width: progressPercent }} transition={{ duration: 0.5, ease: 'easeOut' }} />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col px-6 pt-4 overflow-y-auto pb-4">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-[28px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-2">
            {t('onboarding.showcaseTitle')}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[14px] text-[#767b7e] mb-6">
            {t('onboarding.showcaseSubtitle')}
          </motion.p>

          <div className="flex flex-col gap-4">
            {tFeatureShowcase.map((feature, i) => {
              const FeatureIcon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                  className="flex items-start gap-4 rounded-2xl p-4"
                  style={{ border: '1.5px solid #e8e8e8', backgroundColor: '#fafafa' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: feature.bg }}>
                    <FeatureIcon size={20} color={feature.color} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-1">{feature.title}</h3>
                    <p className="text-[13px] text-[#767b7e] font-['Nunito_Sans'] leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="flex items-center gap-1 justify-center mt-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={22} fill="#FBBF24" color="#FBBF24" />
            ))}
            <span className="text-[13px] text-[#767b7e] font-['Nunito_Sans'] ml-2">{t('onboarding.builtForSuccess')}</span>
          </motion.div>
        </div>

        <div className="px-6 pb-6 pt-2" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            onClick={goNext}
            className="w-full py-3 rounded-2xl text-[17px] font-bold"
            style={{ backgroundColor: '#333333', color: '#ffffff', boxShadow: '0 8px 0 0 #000000' }}
            whileTap={{ scale: 0.97 }}
          >
            {t('onboarding.loveIt')}
          </motion.button>
        </div>
      </div>
    );
  }

  // Loading screen
  if (step === 26) {
    return <PlanLoadingScreen onComplete={() => setStep(27)} displayName={displayName} />;
  }

  // Welcome screen — ownership showcase
  if (step === 27) {
    const noteTitle = onboardingNoteTitle.trim() || 'My First Note';
    const notePreview = getTextPreviewFromHtml(onboardingNoteContent, 60);
    const journeyObj = selectedJourneyId ? ALL_JOURNEYS.find(j => j.id === selectedJourneyId) : null;

    return (
      <div
        className="fixed inset-0 z-[300] flex flex-col bg-white"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex-1 min-h-0 px-6 pb-28 flex flex-col items-center justify-center">
          {/* Avatar + Greeting */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="flex flex-col items-center mb-6"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
              className="w-20 h-20 rounded-full overflow-hidden mb-4"
              style={{ border: `3px solid ${ONBOARDING_COLOR}`, boxShadow: `0 4px 0 0 ${ONBOARDING_COLOR}` }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#f5f6f8] flex items-center justify-center">
                  <span className="text-2xl font-bold" style={{ color: ONBOARDING_COLOR }}>
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-[28px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-center leading-tight"
            >
              Welcome, {displayName}! 🎉
            </motion.h1>
             <motion.p
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 0.35 }}
               className="text-[13px] text-[#767b7e] font-['Nunito_Sans'] text-center mt-1"
             >
               You're all set! Flowist is ready to help you stay organized and productive.
             </motion.p>
           </motion.div>

           {/* Summary stats */}
           <div className="flex flex-col gap-3 mt-4 w-full">
             {onboardingNoteSaved && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                  <p className="text-[15px] font-semibold text-[#1a1a1a]">1 Note created</p>
                </motion.div>
              )}

              {sketchSaved && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                  <p className="text-[15px] font-semibold text-[#1a1a1a]">1 Sketch created</p>
                </motion.div>
              )}

              {createdTasks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                  <p className="text-[15px] font-semibold text-[#1a1a1a]">{createdTasks.length} {createdTasks.length === 1 ? 'Task' : 'Tasks'} created</p>
                </motion.div>
              )}

              {(notesFolders.length > 0 || tasksFolders.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.65 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                  <p className="text-[15px] font-semibold text-[#1a1a1a]">{notesFolders.length + tasksFolders.length} {notesFolders.length + tasksFolders.length === 1 ? 'Folder' : 'Folders'} organized</p>
                </motion.div>
              )}

              {selectedJourneyId && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                  <p className="text-[15px] font-semibold text-[#1a1a1a]">Journey started</p>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 }}
                className="flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
                <p className="text-[15px] font-semibold text-[#1a1a1a]">Streak activated</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
                <p className="text-[15px] font-semibold text-[#1a1a1a]">Certificates unlocked</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.85 }}
                className="flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ONBOARDING_COLOR }}>
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                </div>
                <p className="text-[15px] font-semibold text-[#1a1a1a]">Ready to go!</p>
              </motion.div>
            </div>
        </div>

        {/* Bottom button */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-3 bg-gradient-to-t from-white via-white to-transparent" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            onClick={handleFinishWelcome}
            className="w-full py-3 rounded-2xl text-[17px] font-bold cursor-pointer active:brightness-95"
            style={{
              backgroundColor: '#333333',
              color: '#ffffff',
              boxShadow: '0 8px 0 0 #000000',
              WebkitTapHighlightColor: 'transparent',
            }}
            whileTap={{ scale: 0.99, y: 1 }}
          >
            {t('onboarding.letsGo')}
          </motion.button>
        </div>
      </div>
    );
  }

  const renderSingleSelect = (
    options: string[],
    selected: string | null,
    onSelect: (o: string) => void,
  ) => (
    <div className="flex flex-col gap-3.5">
      {options.map((option, index) => {
        const isSelected = selected === option;
        return (
          <motion.button
            key={option}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 + index * 0.03 }}
            onClick={() => onSelect(option)}
            className="relative w-full text-left rounded-2xl px-5 py-4 text-[15px] font-medium font-['Nunito_Sans'] transition-all duration-150 cursor-pointer active:brightness-95"
            style={{
              backgroundColor: isSelected ? `${ONBOARDING_COLOR}40` : '#ffffff',
              border: `2px solid ${isSelected ? ONBOARDING_COLOR : '#e8e8e8'}`,
              color: '#1a1a1a',
              boxShadow: isSelected ? `0 4px 0 0 ${ONBOARDING_COLOR}` : '0 4px 0 0 #e4e8ea',
              WebkitTapHighlightColor: 'transparent',
            }}
            whileTap={{ scale: 0.99, y: 1 }}
          >
            <span>{option}</span>
          </motion.button>
        );
      })}
    </div>
  );

  const renderMultiSelect = (
    options: string[],
    selected: Set<string>,
    onToggle: (o: string) => void,
  ) => (
    <div className="flex flex-col gap-3.5">
      {options.map((option, index) => {
        const isSelected = selected.has(option);
        return (
          <motion.button
            key={option}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 + index * 0.03 }}
            onClick={() => onToggle(option)}
            className="relative w-full text-left rounded-2xl px-5 py-4 text-[15px] font-medium font-['Nunito_Sans'] transition-all duration-150 flex items-center justify-between cursor-pointer active:brightness-95"
            style={{
              backgroundColor: isSelected ? `${ONBOARDING_COLOR}40` : '#ffffff',
              border: `2px solid ${isSelected ? ONBOARDING_COLOR : '#e8e8e8'}`,
              color: '#1a1a1a',
              boxShadow: isSelected ? `0 4px 0 0 ${ONBOARDING_COLOR}` : '0 4px 0 0 #e4e8ea',
              WebkitTapHighlightColor: 'transparent',
            }}
            whileTap={{ scale: 0.99, y: 1 }}
          >
            <span>{option}</span>
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-150"
              style={{
                backgroundColor: isSelected ? ONBOARDING_COLOR : 'transparent',
                border: `2px solid ${isSelected ? ONBOARDING_COLOR : '#d0d5d9'}`,
              }}
            >
              {isSelected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
            </div>
          </motion.button>
        );
      })}
    </div>
  );

  const renderDescriptionSelect = (
    options: { label: string; description: string }[],
    selected: string | null,
    onSelect: (o: string) => void,
  ) => (
    <div className="flex flex-col gap-4">
      {options.map((option, index) => {
        const isSelected = selected === option.label;
        return (
          <motion.button
            key={option.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 + index * 0.03 }}
            onClick={() => onSelect(option.label)}
            className="relative w-full text-left rounded-2xl px-5 py-5 transition-all duration-150 cursor-pointer active:brightness-95"
            style={{
              backgroundColor: isSelected ? `${ONBOARDING_COLOR}40` : '#ffffff',
              border: `2px solid ${isSelected ? ONBOARDING_COLOR : '#e8e8e8'}`,
              boxShadow: isSelected ? `0 4px 0 0 ${ONBOARDING_COLOR}` : '0 4px 0 0 #e4e8ea',
              WebkitTapHighlightColor: 'transparent',
            }}
            whileTap={{ scale: 0.99, y: 1 }}
          >
            <span className="block text-[16px] font-bold text-[#1a1a1a] font-['Nunito_Sans']">{option.label}</span>
            <span className="block text-[13px] text-[#767b7e] font-['Nunito_Sans'] mt-1 leading-relaxed">{option.description}</span>
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-white"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Top bar */}
      <div className="flex items-end gap-3 px-4 pt-3 pb-2">
        <motion.button
          className="w-[17px] h-[17px] flex items-center justify-center cursor-pointer"
          onClick={handleBack}
          aria-label="Back"
          style={{ opacity: step < 0 ? 0.3 : 1, WebkitTapHighlightColor: 'transparent' }}
          disabled={step < 0}
          whileTap={{ scale: 0.85 }}
          transition={{ duration: 0.1 }}
        >
          <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
        </motion.button>
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[11px] font-semibold text-[#999] text-right">{stepLabel}</span>
          <div className="h-[17px] rounded-[6px] bg-[#e5e5e5] overflow-hidden">
            <motion.div
              className="h-full"
              style={{ backgroundColor: ONBOARDING_COLOR }}
              initial={{ width: '0%' }}
              animate={{ width: progressPercent }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-2">
              {t('onboarding.whyUseFlowist')}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[14px] text-[#767b7e] mb-6">
              {t('onboarding.personalizeExperience')}
            </motion.p>
            {renderSingleSelect(tGoalOptions, selectedGoal, handleSelectGoal)}
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.howFoundUs')}
            </motion.h1>
            {renderSingleSelect(tSourceOptions, selectedSource, handleSelectSource)}
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-2">
              {t('onboarding.experienceTitle')}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[14px] text-[#767b7e] mb-6">
              {t('onboarding.experienceSubtitle')}
            </motion.p>
            {renderDescriptionSelect(tExperienceOptions, selectedExperience, handleSelectExperience)}
          </motion.div>
        )}

        {step === 28 && (
          <motion.div key="step28" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-2">
              {t('onboarding.previousAppTitle')}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[14px] text-[#767b7e] mb-6">
              {t('onboarding.previousAppSubtitle')}
            </motion.p>
            {renderSingleSelect(tPreviousAppOptions, selectedPreviousApp, handleSelectPreviousApp)}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-2">
              {t('onboarding.setupProfile')}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[15px] text-[#767b7e] mb-8">
              {t('onboarding.profileSubtitle')}
            </motion.p>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="flex justify-center mb-8">
              <button onClick={() => fileInputRef.current?.click()} className="relative w-28 h-28 rounded-full" style={{ border: `3px solid ${avatarPreview ? ONBOARDING_COLOR : '#e4e8ea'}`, boxShadow: avatarPreview ? `0 4px 0 0 ${ONBOARDING_COLOR}` : '0 4px 0 0 #e4e8ea' }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full bg-[#f5f6f8] flex items-center justify-center rounded-full">
                    <User className="h-10 w-10 text-[#b0b5b9]" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white" style={{ backgroundColor: ONBOARDING_COLOR }}>
                  <Camera className="h-3.5 w-3.5 text-white" />
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.3 }}>
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={t('onboarding.yourName')} autoCapitalize="words" autoCorrect="off" autoComplete="name"
                className="w-full text-left rounded-2xl px-5 py-4 text-[15px] font-medium font-['Nunito_Sans'] transition-all duration-200 outline-none"
                style={{ backgroundColor: '#ffffff', border: `2px solid ${userName.trim() ? ONBOARDING_COLOR : '#e8e8e8'}`, color: '#1a1a1a', boxShadow: userName.trim() ? `0 4px 0 0 ${ONBOARDING_COLOR}` : '0 4px 0 0 #e4e8ea' }}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Image Cropper overlay for profile setup */}
        {cropImageSrc && (
          <div className="fixed inset-0 z-[400]">
            <ProfileImageCropper
              imageSrc={cropImageSrc}
              onCropComplete={(croppedDataUrl) => {
                setAvatarPreview(croppedDataUrl);
                setCropImageSrc(null);
                triggerSelectionHaptic();
              }}
              onCancel={() => setCropImageSrc(null)}
              cropShape="round"
            />
          </div>
        )}

        {step === 4 && (
          <motion.div key="step4" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.challengesTitle', { name: displayName })}
            </motion.h1>
            {renderMultiSelect(tChallengeOptions, selectedChallenges, handleToggleChallenge)}
          </motion.div>
        )}

        {step === 7 && (
          <motion.div key="step7" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.productivityTitle', { name: displayName })}
            </motion.h1>
            {renderMultiSelect(tProductivityOptions, selectedProductivity, handleToggleProductivity)}
          </motion.div>
        )}

        {step === 8 && (
          <motion.div key="step8" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.focusTitle', { name: displayName })}
            </motion.h1>
            {renderSingleSelect(tFocusOptions, selectedFocus, handleSelectFocus)}
          </motion.div>
        )}

        {step === 9 && (
          <motion.div key="step9" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-10 overflow-y-auto pb-4">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-2">
              {t('onboarding.workstyleTitle')}
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[14px] text-[#767b7e] font-['Nunito_Sans'] mb-8">
              {t('onboarding.workstyleSubtitle')}
            </motion.p>
            {renderDescriptionSelect(tWorkStyleOptions, selectedWorkStyle, handleSelectWorkStyle)}
          </motion.div>
        )}

        {step === 11 && (
          <motion.div key="step11" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.scheduleTitle', { name: displayName })}
            </motion.h1>
            {renderSingleSelect(tScheduleOptions, selectedSchedule, handleSelectSchedule)}
          </motion.div>
        )}

        {step === 12 && (
          <motion.div key="step12" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.celebrateTitle', { name: displayName })}
            </motion.h1>
            {renderMultiSelect(tCelebrateOptions, selectedCelebrate, handleToggleCelebrate)}
          </motion.div>
        )}

        {step === 16 && (
          <motion.div key="step16" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.progressTitle', { name: displayName })}
            </motion.h1>
            {renderMultiSelect(tProgressTrackOptions, selectedProgressTrack, handleToggleProgressTrack)}
          </motion.div>
        )}

        {step === 17 && (
          <motion.div key="step17" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.consistencyTitle', { name: displayName })}
            </motion.h1>
            {renderSingleSelect(tConsistencyOptions, selectedConsistency, handleSelectConsistency)}
          </motion.div>
        )}



        {step === 19 && (
          <motion.div key="step19" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.streakTitle', { name: displayName })}
            </motion.h1>
            {renderSingleSelect(tStreakOptions, selectedStreak, handleSelectStreak)}
          </motion.div>
        )}

        {step === 20 && (
          <motion.div key="step20" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.remindTitle', { name: displayName })}
            </motion.h1>
            {renderMultiSelect(tRemindOptions, selectedRemind, handleToggleRemind)}
          </motion.div>
        )}

        {step === 22 && (
          <motion.div key="step22" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.featuresTitle', { name: displayName })}
            </motion.h1>
            {renderMultiSelect(tFeatureInterestOptions, selectedFeatureInterest, handleToggleFeatureInterest)}
          </motion.div>
        )}

        {step === 23 && (
          <motion.div key="step23" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.15 }} className="flex-1 flex flex-col px-6 pt-6 overflow-y-auto">
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.05 }} className="text-[32px] font-black text-[#1a1a1a] font-['Nunito'] tracking-tight text-left leading-tight mb-6">
              {t('onboarding.improveTitle', { name: displayName })}
            </motion.h1>
            {renderMultiSelect(tImproveOptions, selectedImprove, handleToggleImprove)}
          </motion.div>
        )}

      </AnimatePresence>

      {/* Bottom Next button */}
      <div className="px-6 pb-6 pt-2 flex flex-col items-center">
        <motion.button
          onClick={goNext}
          disabled={!currentValid}
          className="w-full py-3 rounded-2xl text-[17px] font-bold transition-all duration-150 cursor-pointer active:brightness-95"
          style={{
            backgroundColor: currentValid ? '#333333' : '#ebeff2',
            color: currentValid ? '#ffffff' : '#767b7e',
            boxShadow: currentValid ? '0 8px 0 0 #000000' : 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
          whileTap={currentValid ? { scale: 0.98, y: 2 } : {}}
        >
          {t('onboarding.next')}
        </motion.button>
      </div>
    </div>
  );
};
