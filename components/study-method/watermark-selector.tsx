'use client';

/**
 * Dropdown selector for deck watermark type.
 * Shows SVG thumbnail previews for each subject category.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { SUBJECT_WATERMARK_DATA } from './subject-watermark';
import { WATERMARK_TYPES, type WatermarkType } from '@/lib/schema/deckSchemas';
import { RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Human-readable labels for each category
const CATEGORY_LABELS: Record<WatermarkType, string> = {
  general: 'General',
  language: 'Language',
  math: 'Mathematics',
  science: 'Science',
  chemistry: 'Chemistry',
  astronomy: 'Astronomy',
  it: 'IT / Computing',
  technical: 'Engineering',
  literature: 'Literature',
  history: 'History',
  art: 'Art',
  music: 'Music',
  sport: 'Sport',
  movies: 'Movies',
  media: 'Media',
  geography: 'Geography',
  philosophy: 'Philosophy',
  economy: 'Economy',
  legal: 'Legal',
  religion: 'Religion',
};

// Per-category viewBox for rendering raw SVG content WITHOUT the card-level transform.
// Each category's SVG paths use different native coordinate ranges.
const THUMBNAIL_VIEWBOX: Record<string, string> = {
  general:    '-1 -1 34 34',
  language:   '0 0 32 32',
  math:       '2 0 28 32',
  science:    '0 0 32 32',
  chemistry:  '3 2 27 30',
  astronomy:  '2 4 28 24',
  it:         '1 1 30 30',
  technical:  '0 4 32 26',
  literature: '3 1 26 30',
  history:    '-1 -1 21 21',
  art:        '-1 4 52 42',
  music:      '2 0 30 32',
  sport:      '-2 -2 68 68',
  movies:     '1 0 30 32',
  media:      '0 0 32 32',
  geography:  '2 0 28 32',
  philosophy: '40 0 480 520',
  economy:    '-1 5 34 24',
  legal:      '0 0 50 50',
  religion:   '0 0 512 512',
};

/** Renders an SVG thumbnail preview for a watermark category */
function WatermarkThumbnail({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' }) {
  const data = SUBJECT_WATERMARK_DATA[category];
  if (!data) return null;

  const sizeClass = size === 'sm' ? 'w-6 h-6' : 'w-10 h-10';
  const viewBox = THUMBNAIL_VIEWBOX[category] ?? '0 0 32 32';

  // Render raw SVG content without the card-level transform, using a viewBox
  // matched to each category's native coordinate space.
  return (
    <div className={cn(sizeClass, 'flex-shrink-0 rounded-md bg-gray-100 dark:bg-slate-700 overflow-hidden p-1')}>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {data.content('#9ca3af')}
      </svg>
    </div>
  );
}

interface WatermarkSelectorProps {
  value: string | null; // null = auto-detect
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

export function WatermarkSelector({ value, onChange, disabled }: WatermarkSelectorProps) {
  return (
    <Select
      value={value ?? '__auto__'}
      onValueChange={(v) => onChange(v === '__auto__' ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full max-w-xs">
        <SelectValue placeholder="Auto-detect">
          {value ? (
            <span className="flex items-center gap-2">
              <WatermarkThumbnail category={value} size="sm" />
              <span>{CATEGORY_LABELS[value as WatermarkType] ?? value}</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <span>Auto-detect from tags</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80 w-64">
        {/* Auto-detect option */}
        <SelectItem value="__auto__">
          <span className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 rounded-md bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
            </div>
            <span className="text-sm">Auto-detect</span>
          </span>
        </SelectItem>

        {/* All watermark categories */}
        {WATERMARK_TYPES.map((cat) => (
          <SelectItem key={cat} value={cat}>
            <span className="flex items-center gap-3">
              <WatermarkThumbnail category={cat} />
              <span className="text-sm">{CATEGORY_LABELS[cat]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
