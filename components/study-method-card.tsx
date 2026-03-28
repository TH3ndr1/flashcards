"use client"
/**
 * Universal Study Method Card Component
 * A flexible card design that adapts to different study methods while maintaining consistency
 */

import React from 'react';
import {
  BookOpen,
  BookText,
  Brain,
  Layers,
  Network,
  Globe,
  Tag,
  FileText,
  MessageSquare,
  Lightbulb,
} from 'lucide-react';
import { StudyMethodMetadata, StudyMethodType, StoryMetadata, QuizMetadata, MindMapMetadata, KnowledgeGraphMetadata } from '@/types/study-method';
import { useTheme } from 'next-themes';

// Custom icons that match the visual designs
function FlashcardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <line x1="6" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function StoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function QuizIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 12l3 3 6-6" />
    </svg>
  );
}

function MindMapIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

function KnowledgeGraphIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="12" y1="9" x2="8" y2="15" />
      <line x1="12" y1="9" x2="16" y2="15" />
    </svg>
  );
}

interface StudyMethodCardProps {
  metadata: StudyMethodMetadata;
  onClick?: () => void;
  hideWatermark?: boolean;
}

// Method configuration with icons and colors
const METHOD_CONFIG = {
  flashcard: {
    icon: FlashcardIcon,
    label: 'Flashcards',
    colorClass: 'text-pink-600',
    colorClassDark: 'text-pink-400',
    bgColorClass: 'bg-pink-50',
    borderColorClass: 'border-pink-200',
    progressColorClass: 'bg-gradient-to-r from-pink-500 via-pink-600 to-pink-700',
    hoverGlow: 'hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]',
  },
  story: {
    icon: StoryIcon,
    label: 'Story',
    colorClass: 'text-purple-600',
    colorClassDark: 'text-purple-400',
    bgColorClass: 'bg-purple-50',
    borderColorClass: 'border-purple-200',
    progressColorClass: 'bg-gradient-to-r from-purple-500 via-purple-600 to-blue-500',
    hoverGlow: 'hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]',
  },
  quiz: {
    icon: QuizIcon,
    label: 'Quiz',
    colorClass: 'text-blue-600',
    colorClassDark: 'text-blue-400',
    bgColorClass: 'bg-blue-50',
    borderColorClass: 'border-blue-200',
    progressColorClass: 'bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500',
    hoverGlow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]',
  },
  mindmap: {
    icon: MindMapIcon,
    label: 'Mind Map',
    colorClass: 'text-green-600',
    colorClassDark: 'text-green-400',
    bgColorClass: 'bg-green-50',
    borderColorClass: 'border-green-200',
    progressColorClass: 'bg-gradient-to-r from-green-500 via-emerald-600 to-teal-500',
    hoverGlow: 'hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]',
  },
  'knowledge-graph': {
    icon: KnowledgeGraphIcon,
    label: 'Knowledge Graph',
    colorClass: 'text-orange-600',
    colorClassDark: 'text-orange-400',
    bgColorClass: 'bg-orange-50',
    borderColorClass: 'border-orange-200',
    progressColorClass: 'bg-gradient-to-r from-orange-500 via-amber-600 to-yellow-500',
    hoverGlow: 'hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]',
  },
} as const;

export function StudyMethodCard({ metadata, onClick, hideWatermark }: StudyMethodCardProps) {
  const config = METHOD_CONFIG[metadata.methodType];
  const Icon = config.icon;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg border overflow-hidden transition-all duration-200 cursor-pointer ${
        isDark
          ? 'bg-slate-800 border-slate-700 hover:shadow-[0_8px_16px_rgba(255,255,255,0.08)] hover:border-slate-600'
          : 'bg-white border-gray-200 hover:shadow-lg hover:border-gray-300'
      }`}
    >
      {/* Render watermark only if not hidden */}
      {!hideWatermark && <SubjectWatermark metadata={metadata} methodType={metadata.methodType} />}

      {/* Header: Icon + Title */}
      <div className={`relative ${isDark ? 'px-4 py-3 bg-slate-800' : 'px-4 py-3 bg-white'}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isDark ? config.colorClassDark : config.colorClass} flex-shrink-0`} />
          <h3 className={`text-sm font-semibold ${isDark ? config.colorClassDark : config.colorClass} truncate`}>
            {metadata.title}
          </h3>
        </div>
      </div>

      {/* Thin dividing line */}
      <div className={`h-px ${isDark ? 'bg-slate-800' : config.bgColorClass}`} />

      {/* Content area: Image + Stats */}
      <div className={`p-4 flex gap-4 relative overflow-hidden ${isDark ? 'bg-slate-900/40' : config.bgColorClass}`}>
        {/* Stats and Tags */}
        <div className="flex-1 min-w-0 flex flex-col justify-between relative z-10">
          <div className="space-y-2">
            {/* Language indicators */}
            {metadata.sourceLanguage && (
              <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                <Globe className="w-3.5 h-3.5" />
                <span className="text-xs">
                  {metadata.sourceLanguage}
                  {metadata.targetLanguage && ` / ${metadata.targetLanguage}`}
                </span>
              </div>
            )}

            {/* Tags */}
            {metadata.tags && metadata.tags.length > 0 && (
              <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                <Tag className="w-3.5 h-3.5" />
                <span className="text-xs">{metadata.tags.join(', ')}</span>
              </div>
            )}

            {/* Flashcard-specific: Cards due */}
            {metadata.methodType === 'flashcard' && (
              <div className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                {metadata.dueItems} of {metadata.totalItems} due
              </div>
            )}
          </div>
        </div>

        {/* Content Visual - positioned on the right, partially overflowing */}
        <div className="w-16 h-16 flex-shrink-0 relative -mr-6 z-10">
          <div className="absolute inset-0 rounded">
            <MethodVisual methodType={metadata.methodType} config={config} />
          </div>
        </div>
      </div>

      {/* Bottom metadata row with white background */}
      <div className={`px-4 pb-4 pt-3 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <BottomMetadata metadata={metadata} config={config} isDark={isDark} />
      </div>
    </div>
  );
}

// Method visual component
function MethodVisual({ methodType, config }: {
  methodType: StudyMethodType;
  config: typeof METHOD_CONFIG[keyof typeof METHOD_CONFIG];
}) {
  switch (methodType) {
    case 'flashcard':
      return (
        <div className="absolute inset-0">
          <div className="absolute right-0 top-0">
            <div className="relative w-14 h-14">
              <div className="absolute inset-x-0 top-0 h-full bg-pink-200 rounded-lg transform rotate-6 opacity-40" />
              <div className="absolute inset-x-0 top-1 h-full bg-pink-300 rounded-lg transform rotate-3 opacity-60" />
              <div className="absolute inset-x-0 top-1.5 h-full bg-gradient-to-br from-pink-400 to-pink-500 rounded-lg shadow-sm">
                <div className="p-1.5 h-full flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <div className="h-0.5 bg-white/60 rounded w-1/4" />
                    <div className="h-0.5 bg-white/40 rounded w-3/4" />
                  </div>
                  <div className="h-0.5 bg-white/30 rounded w-1/2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      );

    case 'story':
      return (
        <div className="absolute inset-0">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-500 rounded-lg shadow-sm">
            <div className="absolute left-0 top-0 bottom-0 w-7 bg-gradient-to-r from-purple-400 to-purple-500 rounded-l-lg shadow-sm">
              <div className="p-1 space-y-0.5">
                <div className="h-0.5 bg-white/40 rounded" />
                <div className="h-0.5 bg-white/40 rounded" />
                <div className="h-0.5 bg-white/30 rounded w-3/4" />
              </div>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-l from-purple-300 to-purple-400 rounded-r-lg shadow-sm">
              <div className="p-1 space-y-0.5">
                <div className="h-0.5 bg-white/40 rounded" />
                <div className="h-0.5 bg-white/40 rounded" />
                <div className="h-0.5 bg-white/30 rounded w-2/3" />
              </div>
            </div>
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-purple-600 opacity-20" />
          </div>
        </div>
      );

    case 'quiz':
      return (
        <div className="absolute inset-0">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg shadow-sm">
            <div className="p-1.5 space-y-1">
              <div className="h-0.5 bg-white/60 rounded w-1/2" />
              <div className="h-0.5 bg-white/40 rounded w-3/4 mt-1.5" />
              <div className="flex items-center gap-0.5 mt-1.5">
                <div className="w-2 h-2 bg-white rounded flex items-center justify-center">
                  <svg className="w-1.5 h-1.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="h-0.5 bg-white/40 rounded flex-1" />
              </div>
              <div className="flex items-center gap-0.5">
                <div className="w-2 h-2 bg-white/30 rounded" />
                <div className="h-0.5 bg-white/30 rounded flex-1" />
              </div>
            </div>
          </div>
        </div>
      );

    case 'mindmap':
      return (
        <div className="absolute inset-0">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 rounded-lg shadow-sm overflow-hidden">
            <svg className="absolute inset-0 w-full h-full">
              <line x1="50%" y1="50%" x2="85%" y2="20%" stroke="white" strokeWidth="1.5" className="opacity-30" />
              <line x1="50%" y1="50%" x2="90%" y2="50%" stroke="white" strokeWidth="1.5" className="opacity-30" />
              <line x1="50%" y1="50%" x2="75%" y2="85%" stroke="white" strokeWidth="1.5" className="opacity-30" />
              <line x1="50%" y1="50%" x2="25%" y2="80%" stroke="white" strokeWidth="1.5" className="opacity-30" />
              <line x1="50%" y1="50%" x2="15%" y2="25%" stroke="white" strokeWidth="1.5" className="opacity-30" />
            </svg>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/70 shadow-sm" />
            <div className="absolute top-[20%] right-[15%] w-2.5 h-2.5 rounded-full bg-white/50" />
            <div className="absolute top-1/2 right-[10%] w-2.5 h-2.5 rounded-full bg-white/50" />
            <div className="absolute bottom-[15%] right-1/4 w-2 h-2 rounded-full bg-white/40" />
            <div className="absolute bottom-[20%] left-1/4 w-2 h-2 rounded-full bg-white/40" />
            <div className="absolute top-1/4 left-[15%] w-2.5 h-2.5 rounded-full bg-white/50" />
          </div>
        </div>
      );

    case 'knowledge-graph':
      return (
        <div className="absolute inset-0">
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-lg shadow-sm">
            <svg className="absolute inset-0 w-full h-full">
              <line x1="50%" y1="20%" x2="30%" y2="45%" stroke="white" strokeWidth="1.5" className="opacity-30" />
              <line x1="50%" y1="20%" x2="70%" y2="45%" stroke="white" strokeWidth="1.5" className="opacity-30" />
              <line x1="30%" y1="45%" x2="20%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
              <line x1="30%" y1="45%" x2="40%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
              <line x1="70%" y1="45%" x2="60%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
              <line x1="70%" y1="45%" x2="80%" y2="75%" stroke="white" strokeWidth="1" className="opacity-25" />
            </svg>
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded bg-white/70 shadow-sm" />
            <div className="absolute top-[45%] left-[30%] -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded bg-white/60" />
            <div className="absolute top-[45%] right-[30%] translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded bg-white/60" />
            <div className="absolute bottom-[25%] left-[20%] -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
            <div className="absolute bottom-[25%] left-[40%] -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
            <div className="absolute bottom-[25%] right-[40%] translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
            <div className="absolute bottom-[25%] right-[20%] translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded bg-white/50" />
          </div>
        </div>
      );

    default:
      return null;
  }
}

// Simple progress bar
function SimpleProgressBar({ percentage, colorClass }: {
  percentage: number;
  colorClass: string;
}) {
  return (
    <div className="h-2 rounded-full overflow-hidden bg-gray-100">
      <div
        className={`h-full ${colorClass} transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}

// Multi-segment progress bar
function MultiSegmentProgressBar({ segments }: {
  segments: { completed: number; learning: number; new: number }
}) {
  return (
    <div className="h-2 rounded-full overflow-hidden bg-gray-100 flex">
      {segments.completed > 0 && (
        <div
          className="bg-gradient-to-r from-pink-500 to-pink-600"
          style={{ width: `${segments.completed}%` }}
        />
      )}
      {segments.learning > 0 && (
        <div
          className="bg-gradient-to-r from-blue-400 to-blue-500"
          style={{ width: `${segments.learning}%` }}
        />
      )}
      {segments.new > 0 && (
        <div
          className="bg-gradient-to-r from-cyan-400 to-cyan-500"
          style={{ width: `${segments.new}%` }}
        />
      )}
    </div>
  );
}

// Bottom metadata row component
function BottomMetadata({ metadata, config, isDark }: {
  metadata: StudyMethodMetadata;
  config: typeof METHOD_CONFIG[keyof typeof METHOD_CONFIG];
  isDark: boolean;
}) {
  const progressPercentage = metadata.totalItems > 0
    ? (metadata.completedItems / metadata.totalItems) * 100
    : 0;

  switch (metadata.methodType) {
    case 'flashcard':
      return (
        <div className="w-full">
          {metadata.progressSegments ? (
            <MultiSegmentProgressBar segments={metadata.progressSegments} />
          ) : (
            <SimpleProgressBar
              percentage={progressPercentage}
              colorClass={config.progressColorClass}
            />
          )}
        </div>
      );

    case 'story':
      const storyMeta = metadata.methodSpecific as StoryMetadata;
      const formatIcons = {
        story: BookText,
        overview: FileText,
        dialogue: MessageSquare,
        analogies: Lightbulb,
      };
      const formatLabels = {
        story: 'Story',
        overview: 'Overview',
        dialogue: 'Dialogue',
        analogies: 'Analogies',
      };

      if (storyMeta?.format) {
        const FormatIcon = formatIcons[storyMeta.format];
        return (
          <div className="flex items-center gap-1.5">
            <FormatIcon className={`w-3.5 h-3.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <span className={`text-xs font-medium ${isDark ? 'text-purple-400' : 'text-purple-700'}`}>
              {formatLabels[storyMeta.format]}
            </span>
          </div>
        );
      }
      return null;

    case 'quiz':
      const quizMeta = metadata.methodSpecific as QuizMetadata;
      return (
        <div className="w-full">
          <SimpleProgressBar
            percentage={quizMeta?.lastScore || quizMeta?.accuracy || 0}
            colorClass={config.progressColorClass}
          />
        </div>
      );

    case 'mindmap':
      const mindmapMeta = metadata.methodSpecific as MindMapMetadata;
      return (
        <div className="w-full">
          <SimpleProgressBar
            percentage={mindmapMeta?.coverage || 0}
            colorClass={config.progressColorClass}
          />
        </div>
      );

    case 'knowledge-graph':
      const kgMeta = metadata.methodSpecific as KnowledgeGraphMetadata;
      return (
        <div className="w-full">
          <SimpleProgressBar
            percentage={kgMeta?.masteryLevel || 0}
            colorClass={config.progressColorClass}
          />
        </div>
      );

    default:
      return null;
  }
}

// Reusable Subject Watermark Logic
export const getSubjectCategory = (metadata: { title: string, tags?: string[] }) => {
  const tags = metadata.tags?.join(' ').toLowerCase() || '';
  const title = metadata.title.toLowerCase();
  const combined = `${tags} ${title}`;

  if (combined.match(/math|algebra|geometry|calculus|arithmetic|equation/)) return 'math';
  if (combined.match(/\bit\b|information technology|computer|programming|software|hardware|chip|processor|machine learning|artificial intelligence|\bai\b|\bml\b/)) return 'it';
  if (combined.match(/chemistry|chemical|reaction|molecule/)) return 'chemistry';
  if (combined.match(/science|physics|biology|quantum|rocket|startup|anatomy|medical|medicine/)) return 'science';
  if (combined.match(/art|painting|drawing|design|gallery|renaissance/)) return 'art';
  if (combined.match(/history|war|timeline|event|civilization/)) return 'history';
  if (combined.match(/literature|book|novel|poetry|writing/)) return 'literature';
  if (combined.match(/language|english|spanish|french|japanese|kanji|grammar|vocabulary/)) return 'language';
  if (combined.match(/music|song|melody|instrument|guitar/)) return 'music';
  if (combined.match(/astronomy|space|stars|planet/)) return 'astronomy';
  if (combined.match(/sport|basketball|football|soccer|tennis|athletics|fitness|exercise/)) return 'sport';
  if (combined.match(/movie|film|cinema|video/)) return 'movies';
  if (combined.match(/media|entertainment|disc|album|cd|dvd/)) return 'media';
  if (combined.match(/geography|map|continent|country|location/)) return 'geography';
  if (combined.match(/philosophy|philosophical|logic|ethics|metaphysics/)) return 'philosophy';
  if (combined.match(/economy|economics|finance|business|trade|market/)) return 'economy';
  if (combined.match(/technical|engineering|technology|mechanical|electrical/)) return 'technical';
  if (combined.match(/legal|law|court|justice|attorney/)) return 'legal';
  if (combined.match(/religion|religious|theology|spiritual|faith/)) return 'religion';

  return 'general';
};

// SVG Paths and Transforms for all 20 subjects
export const SUBJECT_WATERMARK_DATA: Record<string, { transform: string, content: (color: string) => React.ReactNode }> = {
  language: {
    transform: "translate(105, 55) scale(5)",
    content: (color) => (
      <>
        <g>
          <polygon points="7.1,23 8.9,23 8,21.2" fill={color} />
          <path d="M13,16H3c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h10c1.1,0,2-0.9,2-2V18C15,16.9,14.1,16,13,16z M12.4,27.9 C12.3,28,12.2,28,12,28c-0.4,0-0.7-0.2-0.9-0.6L9.9,25H6.1l-1.2,2.4c-0.2,0.5-0.8,0.7-1.3,0.4c-0.5-0.2-0.7-0.8-0.4-1.3l4-8 c0.3-0.7,1.5-0.7,1.8,0l4,8C13.1,27,12.9,27.6,12.4,27.9z" fill={color} />
        </g>
        <path d="M17,1H7C5.9,1,5,1.9,5,3v10c0,1.1,0.9,2,2,2h10c1.1,0,2-0.9,2-2V3C19,1.9,18.1,1,17,1z M12,11c0.9,0,1.7-0.4,2.2-1 c0.4-0.4,1-0.5,1.4-0.1c0.4,0.4,0.5,1,0.1,1.4c-1,1.1-2.3,1.7-3.8,1.7c-2.8,0-5-2.2-5-5s2.2-5,5-5c1.4,0,2.8,0.6,3.8,1.7 c0.4,0.4,0.3,1-0.1,1.4c-0.4,0.4-1,0.3-1.4-0.1c-0.6-0.7-1.4-1-2.2-1c-1.7,0-3,1.3-3,3S10.3,11,12,11z" fill={color} />
        <g>
          <path d="M24,24h-3v2h3c0.6,0,1-0.4,1-1S24.6,24,24,24z" fill={color} />
          <path d="M25,21c0-0.6-0.4-1-1-1h-3v2h3C24.6,22,25,21.6,25,21z" fill={color} />
          <path d="M28,16H18c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h10c1.1,0,2-0.9,2-2V18C30,16.9,29.1,16,28,16z M27,25c0,1.7-1.3,3-3,3h-4 c-0.6,0-1-0.4-1-1v-4v-4c0-0.6,0.4-1,1-1h4c1.7,0,3,1.3,3,3c0,0.8-0.3,1.5-0.8,2C26.7,23.5,27,24.2,27,25z" fill={color} />
        </g>
      </>
    )
  },
  science: {
    transform: "translate(110, 45) scale(5)",
    content: (color) => (
      <>
        <path d="M26,20.1c-1.8,0-3.3,1.2-3.8,2.8c-0.4-0.2-0.8-0.2-1.2-0.2c-1.7,0-3,1.3-3,2.9V26c0,1.1-0.9,2-2,2s-2-0.9-2-2v-0.4 c0-1.6-1.3-2.9-3-2.9c-0.4,0-0.8,0.1-1.2,0.2c-0.5-1.6-2-2.8-3.8-2.8c-2.2,0-4,1.8-4,4.1V30c0,0.6,0.4,1,1,1s1-0.4,1-1v-5.8 c0-1.1,0.9-2.1,2-2.1s2,0.9,2,2.1V26c0,0.6,0.4,1,1,1s1-0.4,1-1v-0.4c0-0.5,0.5-0.9,1-0.9s1,0.4,1,0.9V26c0,2.2,1.8,4,4,4 s4-1.8,4-4v-0.4c0-0.5,0.5-0.9,1-0.9s1,0.4,1,0.9V26c0,0.6,0.4,1,1,1s1-0.4,1-1v-1.8c0-1.1,0.9-2.1,2-2.1s2,0.9,2,2.1V30 c0,0.6,0.4,1,1,1s1-0.4,1-1v-5.8C30,21.9,28.2,20.1,26,20.1z" fill={color} />
        <path d="M11,19h10c0.4,0,0.7-0.2,0.9-0.5c0.2-0.3,0.2-0.7,0-1L19,12.7V6c0-0.2-0.1-0.4-0.2-0.6l-2-3c-0.4-0.6-1.3-0.6-1.7,0l-2,3 C13.1,5.6,13,5.8,13,6v6.7l-2.9,4.8c-0.2,0.3-0.2,0.7,0,1C10.3,18.8,10.6,19,11,19z" fill={color} />
        <path d="M15,21v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3c0-0.6-0.4-1-1-1S15,20.4,15,21z" fill={color} />
      </>
    )
  },
  astronomy: {
    transform: "translate(110, 65) scale(5.5)",
    content: (color) => (
      <>
        <path d="M29.8,7.2c-1.1-1.8-4-2-8.2-0.6C20,5.6,18.1,5,16,5C9.9,5,5,9.9,5,16c0,0.4,0,0.8,0.1,1.2c-2.8,3.1-3.8,5.7-2.7,7.4 c0.7,1.1,1.9,1.5,3.5,1.5c3.5,0,8.8-2.2,13.4-5.2c3.5-2.2,6.6-4.8,8.5-7.3C30.7,10.3,30.5,8.3,29.8,7.2z M4.1,23.6 c-0.4-0.6,0-2,1.6-3.9c0.6,1.6,1.5,3,2.7,4.2C6.1,24.4,4.5,24.3,4.1,23.6z M26.4,12.4c-0.6-1.7-1.5-3.2-2.8-4.4 c2.6-0.6,4.1-0.4,4.5,0.2C28.5,8.8,28.2,10.2,26.4,12.4z" fill={color} />
        <path d="M11.8,26.2c1.3,0.5,2.7,0.8,4.2,0.8c5.8,0,10.5-4.5,11-10.2c-1.9,1.8-4.2,3.6-6.6,5.2C17.4,23.8,14.5,25.3,11.8,26.2z" fill={color} />
      </>
    )
  },
  general: {
    transform: "translate(105, 60) scale(5)",
    content: (color) => (
      <>
        <g><path d="M31,25H10.5C8,25,6,23,6,20.5S8,16,10.5,16H31c0.6,0,1,0.4,1,1s-0.4,1-1,1H10.5C9.1,18,8,19.1,8,20.5S9.1,23,10.5,23H31 c0.6,0,1,0.4,1,1S31.6,25,31,25z" fill={color} /></g>
        <g><path d="M30,25c-0.3,0-0.7-0.2-0.9-0.5c-1.4-2.5-1.4-5.5,0-8c0.3-0.5,0.9-0.6,1.4-0.4c0.5,0.3,0.6,0.9,0.4,1.4 c-1.1,1.9-1.1,4.1,0,6c0.3,0.5,0.1,1.1-0.4,1.4C30.3,25,30.2,25,30,25z" fill={color} /></g>
        <g><path d="M25,32H4.5C2,32,0,30,0,27.5S2,23,4.5,23H25c0.6,0,1,0.4,1,1s-0.4,1-1,1H4.5C3.1,25,2,26.1,2,27.5S3.1,30,4.5,30H25 c0.6,0,1,0.4,1,1S25.6,32,25,32z" fill={color} /></g>
        <g><path d="M24,32c-0.3,0-0.7-0.2-0.9-0.5c-1.4-2.5-1.4-5.5,0-8c0.3-0.5,0.9-0.6,1.4-0.4c0.5,0.3,0.6,0.9,0.4,1.4 c-1.1,1.9-1.1,4.1,0,6c0.3,0.5,0.1,1.1-0.4,1.4C24.3,32,24.2,32,24,32z" fill={color} /></g>
        <g><path d="M16.9,5c-0.6,0-1-0.4-1-1c0-0.7-0.6-1.5-1.5-2l-0.2-0.1c-0.5-0.3-0.7-0.9-0.4-1.3c0.3-0.5,0.9-0.7,1.3-0.4l0.2,0.1 c1.6,0.9,2.6,2.3,2.6,3.8C17.9,4.6,17.5,5,16.9,5z" fill={color} /></g>
        <path d="M21.5,3.1L21.5,3.1c-1.2-0.2-2.4,0.1-3.4,0.7c-0.3,0.2-0.8,0.2-1.1,0c-0.3-0.2-0.7-0.4-1.1-0.5c0,0.2,0.1,0.5,0.1,0.7 c0,0.6-0.4,1-1,1s-1-0.4-1-1c0-0.3-0.1-0.6-0.3-0.9c0,0-0.1,0-0.1,0c-2.9,0.5-4.9,3.5-4.5,6.7c0.3,2.3,1.9,5.8,3.9,7.3 c0.7,0.5,1.4,0.8,2,0.8c0.1,0,0.3,0,0.4,0c0.5-0.1,0.9-0.3,1.3-0.6c0.4-0.3,1.1-0.3,1.5,0c0.4,0.3,0.9,0.5,1.3,0.6 c0.8,0.1,1.6-0.1,2.5-0.7c2-1.5,3.6-5,3.9-7.3C26.3,6.6,24.3,3.5,21.5,3.1z" fill={color} />
      </>
    )
  },
  math: {
    transform: "translate(115, 55) scale(5)",
    content: (color) => (
      <path d="M25,0H7C5.3,0,4,1.3,4,3v26c0,1.7,1.3,3,3,3h18c1.7,0,3-1.3,3-3V3C28,1.3,26.7,0,25,0z M10,28c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S11.1,28,10,28z M10,22c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S11.1,22,10,22z M10,16c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S11.1,16,10,16z M16,28c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S17.1,28,16,28z M16,22c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S17.1,22,16,22z M16,16c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S17.1,16,16,16z M22,28c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S23.1,28,22,28z M22,22c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S23.1,22,22,22z M22,16c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S23.1,16,22,16z M24,9c0,0.6-0.4,1-1,1H9c-0.6,0-1-0.4-1-1V5c0-0.6,0.4-1,1-1h14c0.6,0,1,0.4,1,1V9z" fill={color} />
    )
  },
  history: {
    transform: "translate(115, 54) scale(7.5)",
    content: (color) => (
      <path d="M18 8v11h-3v-4a2 2 0 1 0-4 0v4H0v-8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2V8a2 2 0 0 1-2-2V1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2V1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2zm-6 1a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2z" fill={color} transform="translate(1, 0)" />
    )
  },
  art: {
    transform: "translate(105, 55) scale(3.6)",
    content: (color) => (
      <path d="M21.211 6c-12.632 0-20.211 10.133-20.211 15.2s2.526 8.867 7.579 8.867 7.58 1.266 7.58 5.066c0 5.066 3.789 8.866 8.842 8.866 16.422 0 24-8.866 24-17.732-.001-15.2-12.635-20.267-27.79-20.267zm-3.158 5.067c1.744 0 3.158 1.418 3.158 3.166 0 1.75-1.414 3.167-3.158 3.167s-3.158-1.418-3.158-3.167c0-1.748 1.414-3.166 3.158-3.166zm10.104 0c1.744 0 3.158 1.418 3.158 3.166 0 1.75-1.414 3.167-3.158 3.167-1.743 0-3.157-1.418-3.157-3.167 0-1.748 1.414-3.166 3.157-3.166zm10.106 5.066c1.745 0 3.159 1.417 3.159 3.167 0 1.75-1.414 3.166-3.159 3.166-1.744 0-3.157-1.417-3.157-3.166-.001-1.749 1.413-3.167 3.157-3.167zm-29.052 2.534c1.744 0 3.157 1.417 3.157 3.165 0 1.75-1.414 3.167-3.157 3.167s-3.158-1.418-3.158-3.167c0-1.748 1.414-3.165 3.158-3.165zm15.789 12.666c2.093 0 3.789 1.7 3.789 3.801 0 2.098-1.696 3.799-3.789 3.799s-3.789-1.701-3.789-3.799c0-2.101 1.696-3.801 3.789-3.801z" fill={color} />
    )
  },
  music: {
    transform: "translate(115, 65) scale(5)",
    content: (color) => (
      <path d="M29.7,5.5c-0.4-0.4-1-0.4-1.4,0l-2.7,2.7l-0.6-0.6l-0.6-0.6L27,4.3c0.4-0.4,0.4-1,0-1.4s-1-0.4-1.4,0l-2.8,2.8 c-1.4-1-3.1-1.4-4.7-1.1c-2,0.3-3.7,1.5-4.6,3.2c-0.5,0.9-1.2,1.5-2.2,1.9l-3.9,1.5c-2.4,1-4.1,3-4.7,5.5C2.1,19.4,3,22.2,5,24.2 l3.4,3.4C9.9,29.1,12,30,14.2,30c0.5,0,1.1-0.1,1.6-0.2c2.6-0.5,4.6-2.2,5.5-4.7l1.5-3.9c0.4-0.9,1-1.7,1.9-2.2 c1.8-1,2.9-2.6,3.2-4.6c0.2-1.7-0.2-3.4-1.1-4.7L29.7,7C30.1,6.6,30.1,5.9,29.7,5.5z M14.1,23.5c-0.2,0.2-0.5,0.3-0.7,0.3 s-0.5-0.1-0.7-0.3L9,19.8c-0.4-0.4-0.4-1,0-1.4s1-0.4,1.4,0l3.7,3.7C14.5,22.5,14.5,23.1,14.1,23.5z M20.9,17.1 c-0.7,0.7-1.7,1.1-2.7,1.1s-2-0.4-2.7-1.1c-0.7-0.7-1.1-1.7-1.1-2.7s0.4-2,1.1-2.7c1.5-1.5,4-1.5,5.5,0c0.7,0.7,1.1,1.7,1.1,2.7 S21.6,16.3,20.9,17.1z" fill={color} />
    )
  },
  sport: {
    transform: "translate(123, 73) scale(2.4)",
    content: (color) => (
      <>
        <path d="M46.154,46.143c-4.369,4.373-5.616,10.631-3.869,16.141c4.51-1.523,8.763-4.053,12.358-7.652 c3.6-3.596,6.128-7.848,7.652-12.357C56.785,40.529,50.528,41.773,46.154,46.143z" fill={color} />
        <path d="M17.857,17.846c4.369-4.374,5.612-10.631,3.869-16.143c-4.51,1.524-8.763,4.053-12.362,7.653 c-3.596,3.596-6.125,7.848-7.653,12.359C7.227,23.457,13.484,22.215,17.857,17.846z" fill={color} />
        <path d="M29.661,0.085c2.231,8.071,0.195,17.076-6.145,23.422c-6.343,6.336-15.348,8.373-23.419,6.141 c-0.563,7.703,1.649,15.553,6.632,21.957L51.618,6.722C45.213,1.734,37.36-0.478,29.661,0.085z" fill={color} />
        <path d="M57.277,12.381L12.394,57.266c6.405,4.986,14.258,7.199,21.957,6.637c-2.231-8.07-0.199-17.076,6.145-23.42 c6.343-6.34,15.349-8.375,23.419-6.141C64.478,26.639,62.265,18.787,57.277,12.381z" fill={color} />
      </>
    )
  },
  movies: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <>
        <path d="M29.5,14.1c-0.3-0.2-0.7-0.2-1,0l-4.6,2.3C23.7,15,22.5,14,21,14H7c-1.7,0-3,1.3-3,3v6c0,1.7,1.3,3,3,3h5.1l-3,4.4 c-0.3,0.5-0.2,1.1,0.3,1.4c0.5,0.3,1.1,0.2,1.4-0.3l3.2-4.8l3.2,4.8c0.2,0.3,0.5,0.4,0.8,0.4c0.2,0,0.4-0.1,0.6-0.2 c0.5-0.3,0.6-0.9,0.3-1.4l-3-4.4H21c1.5,0,2.7-1,2.9-2.4l4.6,2.3C28.7,26,28.8,26,29,26c0.2,0,0.4-0.1,0.5-0.1 c0.3-0.2,0.5-0.5,0.5-0.9V15C30,14.7,29.8,14.3,29.5,14.1z" fill={color} />
        <path d="M19,1c-2.1,0-3.9,1.1-5,2.7C12.9,2.1,11.1,1,9,1C5.7,1,3,3.7,3,7s2.7,6,6,6c2.1,0,3.9-1.1,5-2.7c1.1,1.6,2.9,2.7,5,2.7 c3.3,0,6-2.7,6-6S22.3,1,19,1z M9,9C7.9,9,7,8.1,7,7s0.9-2,2-2s2,0.9,2,2S10.1,9,9,9z M19,9c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2 S20.1,9,19,9z" fill={color} />
      </>
    )
  },
  media: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <g>
        <path d="M30.6,12.8C30.6,12.8,30.6,12.8,30.6,12.8C30.6,12.7,30.6,12.7,30.6,12.8c-1-4.6-4.1-8.4-8.2-10.3c0,0-0.1,0-0.1-0.1 c0,0-0.1,0-0.1,0C20.3,1.5,18.2,1,16,1C7.7,1,1,7.7,1,16c0,1.6,0.3,3.2,0.8,4.7c0,0,0,0,0,0.1c0,0,0,0.1,0,0.1 c0.7,2.2,2,4.1,3.6,5.7c0,0,0,0,0,0s0,0,0,0C8.1,29.3,11.9,31,16,31c8.3,0,15-6.7,15-15C31,14.9,30.9,13.8,30.6,12.8z M12,16 c0-2.2,1.8-4,4-4s4,1.8,4,4s-1.8,4-4,4S12,18.2,12,16z M16,3c1.6,0,3.1,0.3,4.6,0.8l-3,6.4c-0.5-0.1-1-0.2-1.6-0.2 c-3.3,0-6,2.7-6,6c0,0.3,0,0.6,0.1,0.9l-6.7,2.2C3.1,18.1,3,17.1,3,16C3,8.8,8.8,3,16,3z M16,29c-3.2,0-6.2-1.2-8.4-3.1l5-5 c1,0.7,2.2,1.1,3.5,1.1c3.3,0,6-2.7,6-6c0-0.1,0-0.2,0-0.3l6.9-1.5c0.1,0.6,0.1,1.2,0.1,1.8C29,23.2,23.2,29,16,29z" fill={color} />
        <path d="M19,16c0-1.7-1.3-3-3-3s-3,1.3-3,3s1.3,3,3,3S19,17.7,19,16z M15,16c0-0.6,0.4-1,1-1s1,0.4,1,1s-0.4,1-1,1S15,16.6,15,16z" fill={color} />
      </g>
    )
  },
  geography: {
    transform: "translate(110, 68) scale(5)",
    content: (color) => (
      <g>
        <path d="M9.6,19.4c1.8,1.8,4.1,2.6,6.4,2.6s4.6-0.9,6.4-2.6c3.5-3.5,3.5-9.2,0-12.7c-3.5-3.5-9.2-3.5-12.7,0 C6.1,10.1,6.1,15.9,9.6,19.4z" fill={color} />
        <path d="M26.6,22.2l-1.5-1.5c-0.4-0.4-1-0.4-1.4,0C19.4,25,12.4,25,8.2,20.8C4,16.5,4,9.6,8.3,5.3c0.2-0.2,0.3-0.4,0.3-0.7 S8.5,4.1,8.3,3.9L6.8,2.4C6.4,2,5.8,2,5.4,2.4C5,2.8,5,3.4,5.4,3.8l0.8,0.8C1.9,9.7,2,17.4,6.8,22.2c2.3,2.3,5.2,3.5,8.2,3.7V27 c0,1.1-0.9,2-2,2h-1c-0.6,0-1,0.4-1,1s0.4,1,1,1h8c0.6,0,1-0.4,1-1s-0.4-1-1-1h-1c-1.1,0-2-0.9-2-2v-1.1c2.6-0.2,5.2-1.3,7.4-3.1 l0.8,0.8c0.4,0.4,1,0.4,1.4,0C27,23.2,27,22.6,26.6,22.2z" fill={color} />
      </g>
    )
  },
  philosophy: {
    transform: "translate(111, 68) scale(0.32)",
    content: (color) => (
      <path d="M264.234 33.64a94.945 94.945 0 0 0-10.957.608C190.895 41.376 131.82 93.06 100.975 152.756c.118-.095.234-.193.353-.287l7.463-5.899 5.477 7.778c1.554 2.208 2.872 4.663 4.033 7.34 7.928-17.487 21.63-34.571 40.363-46.084l7.61-4.676 4.734 7.572c2.502 4.003 4.31 8.702 5.713 14.016 9.889-16.645 25.602-32.252 45.758-41.608l8.101-3.76 3.822 8.073c.153.323.298.652.442.982 9.782-13.132 23.275-24.935 39.728-32.572l8.102-3.762 3.822 8.072c1.356 2.864 2.351 6.017 3.104 9.416 8.43-10.724 19.573-20.548 32.812-27.744-18.601-9.895-38.4-15.936-58.178-15.972zm140.498 19.813c-21.58 4.89-40.88 18.458-50.029 31.264-5.337 7.47-6.704 14.015-5.808 17.388.895 3.374 3.457 6.667 14.306 8.53 3.785.65 8.053-.756 13.291-5.094 5.239-4.338 10.728-11.384 15.358-19.36 4.629-7.974 8.462-16.865 10.949-24.75.915-2.9 1.414-5.45 1.933-7.978zm-71.066 10.74c-19.686 10.104-35.007 28.047-40.684 42.725-1.002 2.592-1.669 5.007-2.07 7.205-.134 1.34-.288 2.68-.46 4.022-.123 3.113.378 5.538 1.23 7.058 1.706 3.045 5.005 5.597 15.976 4.703 3.827-.312 7.612-2.734 11.608-8.238 3.995-5.505 7.56-13.695 10.06-22.57 2.5-8.876 4-18.44 4.45-26.696.164-3.037.016-5.63-.11-8.209zm-61.148 21.221c-15.32 10.048-27.077 25.116-32.995 38.63.178 8.541-.428 17.78-1.966 26.833-.003.02-.008.039-.012.059 2.075 2.643 5.784 4.535 16.084 2.58 3.772-.716 7.28-3.525 10.668-9.422 3.388-5.898 6.065-14.421 7.61-23.512 1.544-9.09 2.021-18.762 1.591-27.018-.158-3.037-.581-5.6-.98-8.15zm-52.096 27.28c-18.503 12.135-31.833 31.6-35.92 46.798-2.384 8.867-1.373 15.474.646 18.32 2.02 2.847 5.57 5.036 16.385 2.983 3.773-.716 7.28-3.527 10.668-9.424 3.389-5.897 6.065-14.419 7.61-23.51 1.544-9.09 2.021-18.761 1.591-27.017-.158-3.038-.581-5.6-.98-8.15zm172.715 1.915a64.957 64.957 0 0 1-5.164 4.795c-7.692 6.37-17.404 10.759-27.819 8.971a53.37 53.37 0 0 1-5.308-1.19c-.211.553-.393 1.083-.545 1.585 9.883 3.882 19.338 8.95 27.293 14.312.488.329.951.657 1.427.986 14.312-1.453 31.422-7.418 45.325-17.963-2.27-1.23-4.543-2.485-7.352-3.652-7.635-3.17-16.909-5.96-25.992-7.549-.624-.109-1.244-.198-1.865-.295zm-233.983 22.87c-16.968 14.203-27.946 35.087-30.238 50.658-1.337 9.083.435 15.528 2.772 18.12 2.336 2.593 6.118 4.353 16.62 1.057 3.664-1.15 6.82-4.348 9.5-10.6 2.68-6.25 4.35-15.025 4.827-24.234.477-9.208-.174-18.869-1.56-27.02-.511-2.998-1.228-5.495-1.92-7.981zm167.551 2.595c-4.894 4.226-10.774 7.219-17.586 7.774-.776.063-1.542.098-2.305.129-4.164 5.764-3.952 9.104-2.789 11.761 1.4 3.198 6.544 7.467 15.371 9.99 15.132 4.326 38.685 2.928 58.618-6.681-1.981-1.656-3.96-3.338-6.483-5.04-6.855-4.62-15.39-9.193-23.978-12.552-7.288-2.85-14.632-4.777-20.848-5.38zm86.656 15.182a106.836 106.836 0 0 1-13.511 4.318c.112.164.23.326.34.49l4.949 7.434-7.397 5.006c-20.412 13.818-44.598 18.985-65.494 17.557 1.179 1.786 2.212 3.592 3.055 5.435l3.713 8.123-8.094 3.776c-18.069 8.427-37.682 10.878-55.32 9.015 3.324 5.162 5.82 10.156 7.115 15.174l2.232 8.648-8.63 2.3c-16.504 4.394-33.356 4.273-48.56 1.052 2.399 4.105 4.226 8.128 5.268 12.166l2.233 8.648-8.631 2.3c-17.359 4.621-35.103 4.246-50.908.525 3.2 5.494 5.503 10.687 6.41 16.017l1.59 9.344-9.414 1.103c-29.326 3.442-58.181-6.708-75.637-21.18-4.087-3.387-7.717-7.113-10.414-11.218 17.989 59.19 62.717 123.576 62.717 123.576l-35.479 68.797c49.496 25.554 105.19 38.708 170.56 32.514-1.767-32.096 16.473-55.814 33.022-74.514-14.59-.975-29.987-2.226-44.846-5.064-16.51-3.155-32.54-8.341-46.003-18.032-13.464-9.69-24.033-24.105-28.956-43.7l17.458-4.387c3.99 15.88 11.622 26 22.011 33.478 10.39 7.478 23.863 12.094 38.87 14.961 25.516 4.875 54.75 4.428 79.554 7.643 26.748-2.02 57.07 2.601 63.441-8.596 15.568-27.36 5.054-63.93-3.44-92.492 18.463-.61 28.178-1.69 38.735-4.967-8.607-34.5-21.86-54.883-43.703-73.5 1.629-20.453 4.194-42.05 1.164-61.75zm-143.705 10.031c-3.632 2.872-7.843 4.998-12.672 5.914-5.147.977-10.06 1.154-14.574.598-2.391 3.278-2.569 5.739-2.08 7.879 3.149 2.201 6.213 4.6 9.176 7.135a140.092 140.092 0 0 1 7.195 6.628c14.405 5.749 36.32 7.451 56.233 1.496-1.694-1.947-3.382-3.92-5.604-5.998-6.039-5.646-13.746-11.51-21.695-16.183-5.387-3.167-10.897-5.746-15.979-7.469zm-165.892 9.828C91.6 189.035 84.35 207.673 83.58 221.33c-.47 8.343 1.653 14.076 3.498 15.916 1.846 1.84 4.091 3.065 12.469-.613 2.48-1.089 4.922-4.003 6.73-9.848 1.808-5.845 2.59-13.96 2.32-22.369-.268-8.409-1.532-17.143-3.308-24.436-.448-1.84-1.006-3.23-1.525-4.865zm117.484 14.098c-4.367 4.56-9.797 8.02-16.357 9.266-4.519.857-8.861 1.105-12.909.779.005.14.01.28.02.418.17 2.194 1.611 5.283 4.533 8.59 1.106.886 2.201 1.789 3.281 2.713a137.466 137.466 0 0 1 3.963 3.544c12.956 8.865 35.325 15.08 57.012 12.59-1.326-2.214-2.642-4.454-4.465-6.888-4.955-6.618-11.512-13.74-18.52-19.735-5.473-4.682-11.249-8.637-16.558-11.277zm-51.684 23.215c-3.888 5.477-9.097 9.938-15.865 12.062-3.643 1.144-7.216 1.857-10.646 2.15 1.39 3.355 4.753 7.65 10.494 11.69 12.87 9.058 35.571 15.474 57.555 12.95-1.327-2.215-2.642-4.455-4.465-6.89-4.956-6.617-11.515-13.74-18.522-19.734-6.165-5.274-12.72-9.645-18.55-12.228zm-48.607 26.136c-2.982 6.2-7.496 11.62-14.174 14.551-.504.222-1.01.415-1.515.615a34.936 34.936 0 0 0 4.89 4.92c10.574 8.766 29.946 16.537 49.654 17.452-.717-1.297-1.208-2.436-2.085-3.8-3.937-6.115-9.315-12.875-15.207-18.734-5.892-5.858-12.349-10.798-18.014-13.533a32.419 32.419 0 0 0-3.549-1.47zm-48.676 9.061l-33.43 21.395 9.704 15.162 38.591-24.698a30.468 30.468 0 0 1-1.767-3.634c-4.235-.94-8.022-2.876-11.012-5.858a26.53 26.53 0 0 1-2.086-2.367z" fill={color} />
    )
  },
  economy: {
    transform: "translate(115, 65) scale(5)",
    content: (color) => (
      <path d="M0 25v-18h32v18h-32zM2 8.938v14.062h28v-14.062h-28zM21 16c0-3.313-2.238-6-5-6h13v12h-13c2.762 0 5-2.687 5-6zM25 18c0.828 0 1.5-0.896 1.5-2s-0.672-2-1.5-2-1.5 0.896-1.5 2 0.672 2 1.5 2zM18.118 13.478c-0.015 0.055-0.036 0.094-0.062 0.119-0.027 0.025-0.063 0.037-0.109 0.037s-0.118-0.028-0.219-0.086c-0.1-0.059-0.223-0.121-0.368-0.189-0.146-0.068-0.314-0.13-0.506-0.187s-0.402-0.083-0.631-0.083c-0.18 0-0.336 0.021-0.469 0.065s-0.245 0.104-0.334 0.18c-0.090 0.077-0.156 0.17-0.2 0.277s-0.065 0.222-0.065 0.342c0 0.18 0.049 0.335 0.147 0.466s0.229 0.248 0.394 0.35c0.165 0.103 0.351 0.198 0.56 0.287 0.207 0.090 0.42 0.185 0.637 0.284 0.217 0.101 0.429 0.214 0.637 0.341s0.395 0.279 0.557 0.456 0.293 0.385 0.394 0.624c0.1 0.24 0.149 0.521 0.149 0.847 0 0.425-0.078 0.797-0.236 1.118s-0.373 0.588-0.645 0.802c-0.271 0.215-0.587 0.376-0.949 0.484-0.046 0.014-0.096 0.020-0.143 0.031v1.092h-0.983v-0.963c-0.013 0-0.024 0.002-0.036 0.002-0.279 0-0.539-0.022-0.778-0.067s-0.451-0.101-0.634-0.164c-0.184-0.064-0.336-0.131-0.459-0.201s-0.211-0.132-0.265-0.186c-0.054-0.054-0.093-0.132-0.116-0.234-0.023-0.103-0.035-0.249-0.035-0.441 0-0.129 0.004-0.237 0.013-0.325s0.022-0.158 0.041-0.213s0.043-0.093 0.075-0.116c0.031-0.022 0.067-0.034 0.109-0.034 0.058 0 0.14 0.034 0.247 0.103s0.243 0.145 0.409 0.228c0.167 0.084 0.365 0.159 0.597 0.229 0.231 0.068 0.499 0.103 0.803 0.103 0.2 0 0.379-0.024 0.537-0.072s0.293-0.115 0.403-0.203 0.194-0.196 0.253-0.325c0.059-0.13 0.088-0.273 0.088-0.433 0-0.183-0.051-0.34-0.15-0.472-0.1-0.131-0.23-0.247-0.391-0.35-0.16-0.102-0.342-0.197-0.546-0.287s-0.414-0.185-0.631-0.284c-0.216-0.1-0.427-0.213-0.631-0.341s-0.386-0.278-0.546-0.455c-0.16-0.177-0.291-0.387-0.39-0.628s-0.15-0.531-0.15-0.868c0-0.388 0.072-0.728 0.215-1.021s0.337-0.537 0.581-0.73 0.531-0.338 0.862-0.434c0.17-0.050 0.346-0.085 0.526-0.109v-1.034h0.983v1.034c0.039 0.005 0.078 0.003 0.117 0.009 0.191 0.029 0.371 0.068 0.537 0.118 0.167 0.049 0.314 0.104 0.444 0.167 0.129 0.062 0.214 0.113 0.256 0.155s0.069 0.076 0.085 0.105c0.014 0.029 0.026 0.068 0.037 0.116s0.018 0.108 0.021 0.182c0.004 0.072 0.006 0.163 0.006 0.271 0 0.121-0.003 0.224-0.009 0.308-0.009 0.079-0.019 0.149-0.034 0.203zM11 16c0 3.313 2.238 6 5 6h-13v-12h13c-2.762 0-5 2.687-5 6zM7 14c-0.829 0-1.5 0.896-1.5 2s0.671 2 1.5 2c0.828 0 1.5-0.896 1.5-2s-0.672-2-1.5-2z" fill={color} />
    )
  },
  technical: {
    transform: "translate(105, 60) scale(5.5)",
    content: (color) => (
      <>
        <path d="M12.6,25.7C12.4,25,12,24.5,11.5,24H2.7C2.3,24.5,2,25.1,2,25.8V27c0,0.6,0.4,1,1,1h9c0.3,0,0.6-0.2,0.8-0.4 c0.2-0.3,0.2-0.6,0.1-0.9L12.6,25.7z" fill={color} />
        <path d="M30,10h-3V9.7C27,8.2,25.8,7,24.3,7H23c0-0.6-0.4-1-1-1H7c-2.8,0-5,2.2-5,5c0,2.3,1.6,4.2,3.7,4.8L3.6,22h8.1l0.7-2h2.3 c1.9,0,3.5-1.3,3.9-3l0.2-1H22c0.6,0,1-0.4,1-1h1.3c1.5,0,2.7-1.2,2.7-2.7V12h3c0.6,0,1-0.4,1-1S30.6,10,30,10z M8.9,10.4l-1,2 C7.7,12.8,7.4,13,7,13c-0.2,0-0.3,0-0.4-0.1c-0.5-0.2-0.7-0.8-0.4-1.3l1-2C7.4,9.1,8,8.9,8.4,9.1C8.9,9.4,9.1,10,8.9,10.4z M12.9,10.4l-1,2C11.7,12.8,11.4,13,11,13c-0.2,0-0.3,0-0.4-0.1c-0.5-0.2-0.7-0.8-0.4-1.3l1-2c0.2-0.5,0.8-0.7,1.3-0.4 C12.9,9.4,13.1,10,12.9,10.4z M16.6,16.5c-0.2,0.9-1,1.5-2,1.5h-1.6l0.7-2h3L16.6,16.5z" fill={color} />
      </>
    )
  },
  legal: {
    transform: "translate(112, 47) scale(3.2)",
    content: (color) => (
      <path d="M25 1.9980469C24.8425 1.9980469 24.684062 2.034375 24.539062 2.109375L3.5390625 13.109375C3.2090625 13.289375 3 13.63 3 14L3 16L47 16L47 14C47 13.63 46.790937 13.289375 46.460938 13.109375L25.460938 2.109375C25.315938 2.034375 25.1575 1.9980469 25 1.9980469 z M 5 18L5 19.400391C5 20.650391 5.84 21.669687 7 21.929688L7 38L15 38L15 21.929688C16.16 21.669688 17 20.650391 17 19.400391L17 18L5 18 z M 19 18L19 19.400391C19 20.650391 19.84 21.669687 21 21.929688L21 38L29 38L29 21.929688C30.16 21.669688 31 20.650391 31 19.400391L31 18L19 18 z M 33 18L33 19.400391C33 20.650391 33.84 21.669687 35 21.929688L35 38L43 38L43 21.929688C44.16 21.669688 45 20.650391 45 19.400391L45 18L33 18 z M 4 40C3.56 40 3.0707031 40.159219 2.7207031 40.449219C2.2607031 40.839219 2 41.419297 2 42.029297L2 44.779297C2 46.019297 2.9196094 47 4.0996094 47L45.800781 47C46.960781 47 47.900391 46.050859 47.900391 44.880859L47.900391 42.130859C47.900391 40.960859 46.960781 40.009766 45.800781 40.009766C45.800781 40.009766 4.08 40 4 40 z" fill={color} />
    )
  },
  religion: {
    transform: "translate(123, 73) scale(0.3)",
    content: (color) => (
      <>
        <path d="M347.766,148.262c1.467,2.121,2.775,4.321,3.994,6.529h0.087l39.671-3.102c-11.345-26.204-29.96-48.415-53.303-64.169c-7.837-5.31-16.247-9.957-25.145-13.632l-3.102,39.51C325.068,121.969,338.048,133.975,347.766,148.262z" fill={color} />
        <path d="M192.895,118.134c2.456-1.714,5.062-3.268,7.677-4.736l-3.101-39.59c-26.7,11.265-49.309,30.12-65.309,53.797c-5.063,7.511-9.472,15.594-13.147,24.084l39.758,3.102C167.184,140.098,178.856,127.605,192.895,118.134z" fill={color} />
        <path d="M317.558,303.045c-2.774,1.874-5.549,3.587-8.49,5.142l1.874,39.997c0.741-0.239,1.395-0.487,2.128-0.813c26.612-11.345,49.221-30.128,65.222-53.798c5.556-8.251,10.292-17.06,14.126-26.372l-39.43-3.022C344.497,279.774,332.251,293.08,317.558,303.045z" fill={color} />
        <path d="M162.776,272.917c-1.882-2.774-3.675-5.636-5.222-8.65l-39.431,3.013c0.08,0.328,0.239,0.742,0.406,1.069c11.265,26.691,30.04,49.309,53.718,65.31c8.57,5.795,17.714,10.69,27.345,14.446l1.882-39.838C185.959,299.696,172.653,287.53,162.776,272.917z" fill={color} />
        <path d="M319.663,173.661l-23.088,18.065c-1.882,1.475-4.201,2.28-6.585,2.28h-8.627c-5.892,0-10.666-4.783-10.666-10.683v-10.093c0-1.419,0.47-2.822,1.355-3.946l18.982-24.26L302.49,0h-94.488l11.456,145.024l18.074,23.104c1.467,1.874,2.264,4.194,2.264,6.578v8.618c0,5.9-4.768,10.683-10.675,10.683h-10.093c-1.427,0-2.814-0.494-3.946-1.371l-24.252-18.975L44.29,162.205v94.48l146.54-11.448l23.088-18.073c1.882-1.475,4.202-2.273,6.585-2.273h8.618c5.907,0,10.675,4.784,10.675,10.683v10.086c0,1.435-0.478,2.822-1.355,3.954l-18.982,24.259L208.002,512h94.488l-11.456-238.126l-18.074-23.103c-1.467-1.874-2.264-4.194-2.264-6.586v-8.61c0-5.899,4.775-10.683,10.666-10.683h10.101c1.427,0,2.815,0.478,3.946,1.371l24.252,18.974l148.047,11.448v-94.48L319.663,173.661z" fill={color} />
      </>
    )
  },
  chemistry: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <path d="M19.332 19.041c0 0-1.664 2.125-3.79 0-2.062-2-3.562 0-3.562 0l-4.967 9.79c-0.144 0.533 0.173 1.081 0.706 1.224h16.497c0.533-0.143 0.85-0.69 0.707-1.224l-5.591-9.79zM26.939 28.33l-7.979-13.428v-0.025l-0.014-7.869h0.551c0.826 0 1.498-0.671 1.498-1.499 0-0.827-0.672-1.498-1.498-1.498h-7.995c-0.827 0-1.498 0.671-1.498 1.498 0 0.828 0.671 1.499 1.498 1.499h0.482l-0.016 7.871-6.908 13.451c-0.428 1.599 0.521 3.242 2.119 3.67h17.641c1.6-0.428 2.549-2.071 2.119-3.67zM24.553 30.998l-17.108-0.019c-1.065-0.286-1.697-1.382-1.412-2.446l6.947-13.616 0.021-8.908h-1.498c-0.275 0-0.499-0.224-0.499-0.5s0.224-0.499 0.499-0.499h7.995c0.275 0 0.498 0.224 0.498 0.499 0 0.276-0.223 0.5-0.498 0.5h-1.498l0.025 8.875 7.939 13.666c0.286 1.067-0.347 2.163-1.411 2.448zM16.48 2.512c0 0.552 0.448 1 1 1s1-0.448 1-1-0.447-1-1-1-1 0.447-1 1zM17.48 0.012c0.828 0 1.5-0.671 1.5-1.5s-0.672-1.5-1.5-1.5-1.5 0.671-1.5 1.5 0.672 1.5 1.5 1.5zM13.48 2.512c0.553 0 1-0.448 1-1s-0.447-1-1-1-1 0.448-1 1 0.447 1 1 1z" fill={color} />
    )
  },
  it: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <path d="M29,15c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3v-2h3c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3c0-1.7-1.3-3-3-3V3c0-0.6-0.4-1-1-1s-1,0.4-1,1v3 h-2V3c0-0.6-0.4-1-1-1s-1,0.4-1,1v3h-2V3c0-0.6-0.4-1-1-1s-1,0.4-1,1v3h-2V3c0-0.6-0.4-1-1-1S9,2.4,9,3v3C7.3,6,6,7.3,6,9H3 c-0.6,0-1,0.4-1,1s0.4,1,1,1h3v2H3c-0.6,0-1,0.4-1,1s0.4,1,1,1h3v2H3c-0.6,0-1,0.4-1,1s0.4,1,1,1h3v2H3c-0.6,0-1,0.4-1,1s0.4,1,1,1 h3c0,1.7,1.3,3,3,3v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3h2v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3h2v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3h2v3 c0,0.6,0.4,1,1,1s1-0.4,1-1v-3c1.7,0,3-1.3,3-3h3c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3v-2h3c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3v-2H29z M22,19 c0,1.7-1.3,3-3,3h-6c-1.7,0-3-1.3-3-3v-6c0-1.7,1.3-3,3-3h6c1.7,0,3,1.3,3,3V19z" fill={color} />
    )
  },
  literature: {
    transform: "translate(110, 55) scale(5)",
    content: (color) => (
      <>
        <g>
          <path d="M26,7H9C8.4,7,8,6.6,8,6s0.4-1,1-1h17c0.6,0,1,0.4,1,1S26.6,7,26,7z" fill={color} />
        </g>
        <path d="M26,8h-9v13l-3-1l-3,1V8H9C7.9,8,7,7.1,7,6s0.9-2,2-2h17c0.6,0,1-0.4,1-1s-0.4-1-1-1H9C6.8,2,5,3.8,5,6v20c0,2.2,1.8,4,4,4h17c0.6,0,1-0.4,1-1V9C27,8.4,26.6,8,26,8z" fill={color} />
      </>
    )
  }
};

// Subject watermark component - Refactored for visual uniformity
export function SubjectWatermark({ metadata, methodType, className, svgViewBox = "0 0 460 300" }: { metadata: { title: string, tags?: string[] }; methodType: StudyMethodType; className?: string; svgViewBox?: string }) {
  const category = getSubjectCategory(metadata);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Light: icon-color @ 10% multiply blend on bg-X-50 body → exact rendered solid equivalent.
  // Dark:  icon-color-400 @ 10% blend on slate body (#18223A) → near-invisible watermark.
  const colorMap = {
    'flashcard':       { light: '#FBE1EE', dark: '#2E2A41' },  // pink   @ 10% on dark
    'story':           { light: '#F2E5FE', dark: '#292C48' },  // purple @ 10% on dark
    'quiz':            { light: '#DDEAFE', dark: '#1F2F48' },  // blue   @ 10% on dark
    'mindmap':         { light: '#DBF7E5', dark: '#1D353C' },  // green  @ 10% on dark
    'knowledge-graph': { light: '#FEE9D7', dark: '#2F2D35' },  // orange @ 10% on dark
  };
  const palette = colorMap[methodType] ?? colorMap['flashcard'];
  const iconColor = isDark ? palette.dark : palette.light;

  const data = SUBJECT_WATERMARK_DATA[category] || {
    transform: "translate(200, 150)",
    content: (color: string) => (
      <>
        <circle cx="0" cy="0" r="70" fill={color} />
        <ellipse cx="0" cy="0" rx="110" ry="38" fill={color} />
      </>
    )
  };

  return (
    <div
      className={`absolute pointer-events-none z-[1] flex items-center justify-center ${className || "right-3 top-1/2 -translate-y-1/2 w-[286px] h-[286px]"}`}
    >
      <svg
        viewBox={svgViewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <g transform={!className ? "translate(180, 0)" : undefined}>
          <g transform={data.transform}>
            {data.content(iconColor)}
          </g>
        </g>
      </svg>
    </div>
  );
}
