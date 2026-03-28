/**
 * Shared configuration for study method types.
 * Defines custom icons, color palettes, and decorative thumbnails
 * used consistently across the sidebar, deck cards, and story cards.
 */

import React from 'react';

// ─── Custom SVG icons (match the inspiration design) ──────────────────────────

export function FlashcardMethodIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <line x1="6" y1="14" x2="15" y2="14" />
    </svg>
  );
}

export function StoryMethodIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

export function QuizMethodIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 12l3 3 6-6" />
    </svg>
  );
}

export function MindMapMethodIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="5" x2="12" y2="9" />
      <line x1="12" y1="15" x2="12" y2="19" />
      <line x1="5" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function KnowledgeGraphMethodIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="8" x2="8" y2="14" />
      <line x1="12" y1="8" x2="16" y2="14" />
      <circle cx="12" cy="7.5" r="1.5" fill="currentColor" strokeWidth="0" />
      <circle cx="8" cy="14.5" r="1.5" fill="currentColor" strokeWidth="0" />
      <circle cx="16" cy="14.5" r="1.5" fill="currentColor" strokeWidth="0" />
    </svg>
  );
}

// ─── Method colour palette ────────────────────────────────────────────────────

export type StudyMethodType = 'flashcard' | 'story' | 'quiz' | 'mindmap' | 'knowledge-graph';

export interface MethodConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  textColor: string;       // text-* for icon + title
  bgSection: string;       // bg-* for the coloured middle section
  divider: string;         // bg-* for the thin 1px line between header and body
  thumbnailFrom: string;   // gradient from colour for thumbnail
  thumbnailTo: string;     // gradient to colour for thumbnail
  thumbnailAccent: string; // accent colour inside thumbnail (white/dark lines)
}

export const STUDY_METHOD_CONFIG: Record<StudyMethodType, MethodConfig> = {
  flashcard: {
    label: 'Flashcards',
    icon: FlashcardMethodIcon,
    textColor: 'text-pink-600 dark:text-pink-400',
    bgSection: 'bg-pink-50 dark:bg-slate-900/40',
    divider: 'bg-pink-100 dark:bg-slate-800',
    thumbnailFrom: 'from-pink-400',
    thumbnailTo: 'to-pink-500',
    thumbnailAccent: 'bg-white/50',
  },
  story: {
    label: 'Stories',
    icon: StoryMethodIcon,
    textColor: 'text-purple-600 dark:text-purple-400',
    bgSection: 'bg-purple-50 dark:bg-slate-900/40',
    divider: 'bg-purple-100 dark:bg-slate-800',
    thumbnailFrom: 'from-purple-400',
    thumbnailTo: 'to-purple-500',
    thumbnailAccent: 'bg-white/40',
  },
  quiz: {
    label: 'Quizzes',
    icon: QuizMethodIcon,
    textColor: 'text-blue-600 dark:text-blue-400',
    bgSection: 'bg-blue-50 dark:bg-slate-900/40',
    divider: 'bg-blue-100 dark:bg-slate-800',
    thumbnailFrom: 'from-blue-400',
    thumbnailTo: 'to-cyan-500',
    thumbnailAccent: 'bg-white/50',
  },
  mindmap: {
    label: 'Mind Maps',
    icon: MindMapMethodIcon,
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgSection: 'bg-emerald-50 dark:bg-slate-900/40',
    divider: 'bg-emerald-100 dark:bg-slate-800',
    thumbnailFrom: 'from-emerald-400',
    thumbnailTo: 'to-teal-500',
    thumbnailAccent: 'bg-white/50',
  },
  'knowledge-graph': {
    label: 'Knowledge Graphs',
    icon: KnowledgeGraphMethodIcon,
    textColor: 'text-orange-600 dark:text-orange-400',
    bgSection: 'bg-orange-50 dark:bg-slate-900/40',
    divider: 'bg-orange-100 dark:bg-slate-800',
    thumbnailFrom: 'from-orange-400',
    thumbnailTo: 'to-amber-500',
    thumbnailAccent: 'bg-white/50',
  },
};

// ─── Decorative thumbnails ────────────────────────────────────────────────────
// Each thumbnail renders a 56×56 visual within a 64×64 container.
// The container sits in a flex row with -mr-6, so the Card's own
// overflow-hidden clips ~12% at the right edge for a "cut-off" look.
//
// Usage in cards:
//   <div className="w-16 h-16 flex-shrink-0 relative -mr-6">
//     <div className="absolute right-0 top-0">
//       <MethodThumbnail type="flashcard" />
//     </div>
//   </div>

interface ThumbnailProps { config: MethodConfig }

function FlashcardThumbnail({ config }: ThumbnailProps) {
  return (
    <div className="relative w-14 h-14">
      {/* Stacked card effect: back cards with solid lighter tint + rotation */}
      <div className="absolute inset-x-0 top-0 h-full bg-pink-200 dark:bg-pink-800/40 rounded-lg transform rotate-6 opacity-40" />
      <div className="absolute inset-x-0 top-1 h-full bg-pink-300 dark:bg-pink-700/50 rounded-lg transform rotate-3 opacity-60" />
      {/* Front card */}
      <div className={`absolute inset-x-0 top-1.5 h-full bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm`}>
        <div className="p-1.5 h-full flex flex-col justify-between">
          <div className="space-y-0.5">
            <div className="h-0.5 bg-white/60 rounded w-1/4" />
            <div className="h-0.5 bg-white/40 rounded w-3/4" />
          </div>
          <div className="h-0.5 bg-white/30 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

function StoryThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm overflow-hidden`}>
      {/* Left page */}
      <div className={`absolute left-0 top-0 bottom-0 w-7 bg-gradient-to-r ${config.thumbnailFrom} ${config.thumbnailTo} rounded-l-lg shadow-sm`}>
        <div className="p-1 space-y-0.5">
          <div className="h-0.5 bg-white/40 rounded" />
          <div className="h-0.5 bg-white/40 rounded" />
          <div className="h-0.5 bg-white/30 rounded w-3/4" />
        </div>
      </div>
      {/* Right page — lighter */}
      <div className="absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-l from-purple-300 to-purple-400 dark:from-purple-600 dark:to-purple-500 rounded-r-lg shadow-sm">
        <div className="p-1 space-y-0.5">
          <div className="h-0.5 bg-white/40 rounded" />
          <div className="h-0.5 bg-white/40 rounded" />
          <div className="h-0.5 bg-white/30 rounded w-2/3" />
        </div>
      </div>
      {/* Fold line */}
      <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-purple-600 dark:bg-purple-300 opacity-20" />
    </div>
  );
}

function QuizThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm`}>
      <div className="p-1.5 space-y-1">
        <div className="h-0.5 bg-white/60 rounded w-1/2" />
        <div className="h-0.5 bg-white/40 rounded w-3/4 mt-1.5" />
        {/* Checked row */}
        <div className="flex items-center gap-0.5 mt-1.5">
          <div className="w-2 h-2 bg-white rounded flex items-center justify-center flex-shrink-0">
            <svg className="w-1.5 h-1.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="h-0.5 bg-white/40 rounded flex-1" />
        </div>
        {/* Unchecked rows */}
        <div className="flex items-center gap-0.5">
          <div className="w-2 h-2 bg-white/30 rounded flex-shrink-0" />
          <div className="h-0.5 bg-white/30 rounded flex-1" />
        </div>
      </div>
    </div>
  );
}

function MindMapThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 dark:from-emerald-500 dark:via-emerald-600 dark:to-teal-600 rounded-lg shadow-sm overflow-hidden`}>
      {/* Radiating lines from centre */}
      <svg className="absolute inset-0 w-full h-full">
        <line x1="50%" y1="50%" x2="85%" y2="20%" stroke="white" strokeWidth="1.5" className="opacity-30" />
        <line x1="50%" y1="50%" x2="90%" y2="50%" stroke="white" strokeWidth="1.5" className="opacity-30" />
        <line x1="50%" y1="50%" x2="75%" y2="85%" stroke="white" strokeWidth="1.5" className="opacity-30" />
        <line x1="50%" y1="50%" x2="25%" y2="80%" stroke="white" strokeWidth="1.5" className="opacity-30" />
        <line x1="50%" y1="50%" x2="15%" y2="25%" stroke="white" strokeWidth="1.5" className="opacity-30" />
      </svg>
      {/* Central node */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/70 shadow-sm" />
      {/* Branch nodes at line endpoints */}
      <div className="absolute top-[20%] right-[15%] w-2.5 h-2.5 rounded-full bg-white/50" />
      <div className="absolute top-1/2 right-[10%] w-2.5 h-2.5 rounded-full bg-white/50" />
      <div className="absolute bottom-[15%] right-1/4 w-2 h-2 rounded-full bg-white/40" />
      <div className="absolute bottom-[20%] left-1/4 w-2 h-2 rounded-full bg-white/40" />
      <div className="absolute top-1/4 left-[15%] w-2.5 h-2.5 rounded-full bg-white/50" />
    </div>
  );
}

function KnowledgeGraphThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 dark:from-orange-500 dark:via-amber-500 dark:to-yellow-500 rounded-lg shadow-sm`}>
      {/* Connection lines — tree hierarchy */}
      <svg className="absolute inset-0 w-full h-full">
        {/* Level 1→2 */}
        <line x1="50%" y1="20%" x2="30%" y2="45%" stroke="white" strokeWidth="1.5" className="opacity-30" />
        <line x1="50%" y1="20%" x2="70%" y2="45%" stroke="white" strokeWidth="1.5" className="opacity-30" />
        {/* Level 2→3 */}
        <line x1="30%" y1="45%" x2="20%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
        <line x1="30%" y1="45%" x2="40%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
        <line x1="70%" y1="45%" x2="60%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
        <line x1="70%" y1="45%" x2="80%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
      </svg>
      {/* Root node */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded bg-white/70 shadow-sm" />
      {/* Level 2 nodes */}
      <div className="absolute top-[45%] left-[30%] -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded bg-white/60" />
      <div className="absolute top-[45%] right-[30%] translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded bg-white/60" />
      {/* Level 3 nodes — smallest */}
      <div className="absolute bottom-[25%] left-[20%] -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
      <div className="absolute bottom-[25%] left-[40%] -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
      <div className="absolute bottom-[25%] right-[40%] translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
      <div className="absolute bottom-[25%] right-[20%] translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
    </div>
  );
}

const THUMBNAILS: Record<StudyMethodType, React.ComponentType<ThumbnailProps>> = {
  flashcard: FlashcardThumbnail,
  story: StoryThumbnail,
  quiz: QuizThumbnail,
  mindmap: MindMapThumbnail,
  'knowledge-graph': KnowledgeGraphThumbnail,
};

export function MethodThumbnail({ type }: { type: StudyMethodType }) {
  const config = STUDY_METHOD_CONFIG[type];
  const Thumb = THUMBNAILS[type];
  return <Thumb config={config} />;
}
