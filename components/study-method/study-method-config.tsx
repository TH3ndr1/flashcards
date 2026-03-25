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
    bgSection: 'bg-pink-50 dark:bg-pink-950/30',
    divider: 'bg-pink-100 dark:bg-pink-900/40',
    thumbnailFrom: 'from-pink-400',
    thumbnailTo: 'to-pink-500',
    thumbnailAccent: 'bg-white/50',
  },
  story: {
    label: 'Stories',
    icon: StoryMethodIcon,
    textColor: 'text-purple-600 dark:text-purple-400',
    bgSection: 'bg-purple-50 dark:bg-purple-950/30',
    divider: 'bg-purple-100 dark:bg-purple-900/40',
    thumbnailFrom: 'from-purple-400',
    thumbnailTo: 'to-purple-500',
    thumbnailAccent: 'bg-white/40',
  },
  quiz: {
    label: 'Quizzes',
    icon: QuizMethodIcon,
    textColor: 'text-blue-600 dark:text-blue-400',
    bgSection: 'bg-blue-50 dark:bg-blue-950/30',
    divider: 'bg-blue-100 dark:bg-blue-900/40',
    thumbnailFrom: 'from-blue-400',
    thumbnailTo: 'to-cyan-500',
    thumbnailAccent: 'bg-white/50',
  },
  mindmap: {
    label: 'Mind Maps',
    icon: MindMapMethodIcon,
    textColor: 'text-emerald-600 dark:text-emerald-400',
    bgSection: 'bg-emerald-50 dark:bg-emerald-950/30',
    divider: 'bg-emerald-100 dark:bg-emerald-900/40',
    thumbnailFrom: 'from-emerald-400',
    thumbnailTo: 'to-teal-500',
    thumbnailAccent: 'bg-white/50',
  },
  'knowledge-graph': {
    label: 'Knowledge Graphs',
    icon: KnowledgeGraphMethodIcon,
    textColor: 'text-orange-600 dark:text-orange-400',
    bgSection: 'bg-orange-50 dark:bg-orange-950/30',
    divider: 'bg-orange-100 dark:bg-orange-900/40',
    thumbnailFrom: 'from-orange-400',
    thumbnailTo: 'to-amber-500',
    thumbnailAccent: 'bg-white/50',
  },
};

// ─── Decorative thumbnails ────────────────────────────────────────────────────
// A 56×56 px illustration that sits in the right-side of the coloured section,
// partially clipped by the card's overflow-hidden.

interface ThumbnailProps { config: MethodConfig }

function FlashcardThumbnail({ config }: ThumbnailProps) {
  return (
    <div className="relative w-14 h-14">
      {/* Back cards */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg opacity-30 rotate-6`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg opacity-50 rotate-3`} />
      {/* Front card */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm`}>
        <div className="p-2 h-full flex flex-col justify-between">
          <div className="space-y-0.5">
            <div className={`h-0.5 ${config.thumbnailAccent} rounded w-1/4`} />
            <div className={`h-0.5 ${config.thumbnailAccent} rounded w-3/4`} />
          </div>
          <div className={`h-0.5 ${config.thumbnailAccent} rounded w-1/2`} />
        </div>
      </div>
    </div>
  );
}

function StoryThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm overflow-hidden`}>
      {/* Left page */}
      <div className={`absolute left-0 top-0 bottom-0 w-[47%] bg-gradient-to-r ${config.thumbnailFrom} ${config.thumbnailTo}`}>
        <div className="p-1.5 space-y-0.5 pt-2">
          <div className={`h-0.5 ${config.thumbnailAccent} rounded`} />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded`} />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded w-3/4`} />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded`} />
        </div>
      </div>
      {/* Right page — slightly lighter */}
      <div className="absolute right-0 top-0 bottom-0 w-[47%] bg-white/10">
        <div className="p-1.5 space-y-0.5 pt-2">
          <div className={`h-0.5 ${config.thumbnailAccent} rounded`} />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded w-2/3`} />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded`} />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded w-3/4`} />
        </div>
      </div>
      {/* Spine */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-black/10" />
    </div>
  );
}

function QuizThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm`}>
      <div className="p-2 space-y-1.5">
        <div className={`h-0.5 ${config.thumbnailAccent} rounded w-1/2`} />
        <div className={`h-0.5 ${config.thumbnailAccent} rounded w-3/4`} />
        {/* Check row */}
        <div className="flex items-center gap-1 mt-1">
          <div className="w-2.5 h-2.5 bg-white/70 rounded-sm flex items-center justify-center flex-shrink-0">
            <svg className="w-1.5 h-1.5" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600" />
            </svg>
          </div>
          <div className={`h-0.5 ${config.thumbnailAccent} rounded flex-1`} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-white/30 rounded-sm flex-shrink-0" />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded flex-1`} />
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 bg-white/30 rounded-sm flex-shrink-0" />
          <div className={`h-0.5 ${config.thumbnailAccent} rounded w-2/3`} />
        </div>
      </div>
    </div>
  );
}

function MindMapThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm overflow-hidden`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56">
        {/* Branches from center */}
        <line x1="28" y1="28" x2="46" y2="12" stroke="white" strokeWidth="1.5" opacity="0.3" />
        <line x1="28" y1="28" x2="50" y2="28" stroke="white" strokeWidth="1.5" opacity="0.3" />
        <line x1="28" y1="28" x2="42" y2="46" stroke="white" strokeWidth="1.5" opacity="0.3" />
        <line x1="28" y1="28" x2="14" y2="46" stroke="white" strokeWidth="1.5" opacity="0.3" />
        <line x1="28" y1="28" x2="10" y2="14" stroke="white" strokeWidth="1.5" opacity="0.3" />
      </svg>
      {/* Center node */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/70 shadow-sm" />
      {/* Branch nodes */}
      <div className="absolute top-[21%] right-[18%] w-2.5 h-2.5 rounded-full bg-white/50" />
      <div className="absolute top-[50%] right-[8%] -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white/50" />
      <div className="absolute bottom-[16%] right-[24%] w-2 h-2 rounded-full bg-white/40" />
      <div className="absolute bottom-[16%] left-[24%] w-2 h-2 rounded-full bg-white/40" />
      <div className="absolute top-[25%] left-[18%] w-2.5 h-2.5 rounded-full bg-white/50" />
    </div>
  );
}

function KnowledgeGraphThumbnail({ config }: ThumbnailProps) {
  return (
    <div className={`relative w-14 h-14 bg-gradient-to-br ${config.thumbnailFrom} ${config.thumbnailTo} rounded-lg shadow-sm overflow-hidden`}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 56 56">
        {/* Level 1 → 2 */}
        <line x1="28" y1="12" x2="16" y2="28" stroke="white" strokeWidth="1.5" opacity="0.3" />
        <line x1="28" y1="12" x2="40" y2="28" stroke="white" strokeWidth="1.5" opacity="0.3" />
        {/* Level 2 → 3 */}
        <line x1="16" y1="28" x2="10" y2="44" stroke="white" strokeWidth="1" opacity="0.25" />
        <line x1="16" y1="28" x2="22" y2="44" stroke="white" strokeWidth="1" opacity="0.25" />
        <line x1="40" y1="28" x2="34" y2="44" stroke="white" strokeWidth="1" opacity="0.25" />
        <line x1="40" y1="28" x2="46" y2="44" stroke="white" strokeWidth="1" opacity="0.25" />
      </svg>
      {/* Root node */}
      <div className="absolute top-[21%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded bg-white/70 shadow-sm" />
      {/* Level 2 nodes */}
      <div className="absolute top-[50%] left-[28%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded bg-white/60" />
      <div className="absolute top-[50%] right-[28%] translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded bg-white/60" />
      {/* Level 3 nodes */}
      <div className="absolute bottom-[16%] left-[18%] -translate-x-1/2 w-2 h-2 rounded bg-white/50" />
      <div className="absolute bottom-[16%] left-[39%] -translate-x-1/2 w-2 h-2 rounded bg-white/50" />
      <div className="absolute bottom-[16%] right-[39%] translate-x-1/2 w-2 h-2 rounded bg-white/50" />
      <div className="absolute bottom-[16%] right-[18%] translate-x-1/2 w-2 h-2 rounded bg-white/50" />
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
