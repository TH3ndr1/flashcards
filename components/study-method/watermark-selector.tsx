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

/** Renders a small SVG thumbnail preview for a watermark category */
function WatermarkThumbnail({ category, className }: { category: string; className?: string }) {
  const data = SUBJECT_WATERMARK_DATA[category];
  if (!data) return null;

  // Wrap in a div to avoid Select's [&>svg]:size-3 override.
  // Use a tight viewBox centered on the watermark content area.
  return (
    <div className={cn('w-7 h-7 flex-shrink-0 rounded bg-gray-100 dark:bg-slate-700 p-0.5', className)}>
      <svg
        viewBox="200 40 200 200"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <g transform="translate(180, 0)">
          <g transform={data.transform}>
            {data.content('#6b7280')}
          </g>
        </g>
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
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Auto-detect">
          {value ? (
            <span className="flex items-center gap-2">
              <WatermarkThumbnail category={value} />
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
      <SelectContent className="max-h-72">
        {/* Auto-detect option */}
        <SelectItem value="__auto__">
          <span className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
            <span>Auto-detect from tags</span>
          </span>
        </SelectItem>

        {/* All watermark categories */}
        {WATERMARK_TYPES.map((cat) => (
          <SelectItem key={cat} value={cat}>
            <span className="flex items-center gap-2">
              <WatermarkThumbnail category={cat} />
              <span>{CATEGORY_LABELS[cat]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
