'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import {
  MethodThumbnail,
  STUDY_METHOD_CONFIG,
  type StudyMethodType,
} from '@/components/study-method/study-method-config';

// ─── Placeholder card ────────────────────────────────────────────────────────

function PlaceholderCard({
  type,
  title,
  description,
}: {
  type: StudyMethodType;
  title: string;
  description: string;
}) {
  const cfg = STUDY_METHOD_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <Card className="overflow-hidden opacity-70 border-dashed">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4 flex-shrink-0', cfg.textColor)} />
          <h3 className={cn('text-sm font-semibold truncate', cfg.textColor)}>
            {title}
          </h3>
        </div>
      </div>
      <div className={cn('h-px mx-4', cfg.divider)} />

      {/* Colored content section */}
      <div className={cn('p-4 flex items-center gap-3', cfg.bgSection)}>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs text-gray-600 dark:text-slate-400">{description}</p>
          <p className="text-xs text-gray-500 dark:text-slate-500">Coming soon</p>
        </div>
        <div className="w-16 h-16 flex-shrink-0 relative -mr-6 opacity-50">
          <div className="absolute right-0 top-0">
            <MethodThumbnail type={type} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-3">
        <Badge variant="secondary" className="text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          Coming Soon
        </Badge>
      </div>
    </Card>
  );
}

// ─── Page config ──────────────────────────────────────────────────────────────

const PAGE_CONFIG: Record<
  Extract<StudyMethodType, 'quiz' | 'mindmap' | 'knowledge-graph'>,
  {
    heading: string;
    subheading: string;
    cards: { title: string; description: string }[];
  }
> = {
  quiz: {
    heading: 'Quizzes',
    subheading: 'Test your knowledge with AI-generated quizzes',
    cards: [
      { title: 'De Nederlandse Taal', description: 'Multiple-choice questions on Dutch grammar and vocabulary.' },
      { title: 'Biologie Woordenschat', description: 'True/false and fill-in-the-blank biology questions.' },
      { title: 'Geschiedenis van Europa', description: 'Short-answer questions on European history.' },
    ],
  },
  mindmap: {
    heading: 'Mind Maps',
    subheading: 'Visualise connections between concepts',
    cards: [
      { title: 'De Nederlandse Taal', description: 'A radial map linking grammar rules to examples.' },
      { title: 'Biologie Woordenschat', description: 'Concept clusters for cells, organs, and systems.' },
      { title: 'Geschiedenis van Europa', description: 'Timeline branches from key historical events.' },
    ],
  },
  'knowledge-graph': {
    heading: 'Knowledge Graphs',
    subheading: 'Explore hierarchical relationships between ideas',
    cards: [
      { title: 'De Nederlandse Taal', description: 'Hierarchical graph of Dutch sentence structures.' },
      { title: 'Biologie Woordenschat', description: 'Tree of biological classifications and terms.' },
      { title: 'Geschiedenis van Europa', description: 'Cause-and-effect graph of historical events.' },
    ],
  },
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function ComingSoonPageClient({
  type,
}: {
  type: Extract<StudyMethodType, 'quiz' | 'mindmap' | 'knowledge-graph'>;
}) {
  const cfg = STUDY_METHOD_CONFIG[type];
  const PageIcon = cfg.icon;
  const page = PAGE_CONFIG[type];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <PageIcon className={cn('h-6 w-6', cfg.textColor)} />
            <h1 className="text-2xl font-bold">{page.heading}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{page.subheading}</p>
        </div>
        <Badge variant="secondary" className="shrink-0 mt-1">
          <Sparkles className="h-3 w-3 mr-1" />
          Coming Soon
        </Badge>
      </div>

      {/* Coming-soon banner */}
      <div className={cn(
        'rounded-lg border border-dashed px-5 py-4 mb-6 flex items-start gap-3',
        cfg.bgSection,
      )}>
        <Sparkles className={cn('h-5 w-5 mt-0.5 flex-shrink-0', cfg.textColor)} />
        <div>
          <p className={cn('text-sm font-medium', cfg.textColor)}>
            {page.heading} are on the way
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This feature is currently in development. Below is a preview of what your {page.heading.toLowerCase()} will look like once available.
          </p>
        </div>
      </div>

      {/* Placeholder grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {page.cards.map((card) => (
          <PlaceholderCard
            key={card.title}
            type={type}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>
    </div>
  );
}
