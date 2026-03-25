'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  MessageCircle,
  AlignLeft,
  Lightbulb,
  FileText,
  ScrollText,
  MoreVertical,
  Pencil,
  FileDown,
  Plus,
  Clock,
  User,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import { getAllStoriesWithDecks } from '@/lib/actions/storyActions';
import type { StoryWithDeck } from '@/lib/actions/storyActions';
import type { StoryFormat } from '@/types/story';
import { useSettings } from '@/providers/settings-provider';

// ─── Format config ─────────────────────────────────────────────────────────────

const FORMAT_CONFIG: Record<
  StoryFormat,
  { label: string; icon: React.ComponentType<{ className?: string }>; gradient: string; iconColor: string; badgeClass: string }
> = {
  narrative: {
    label: 'Narrative',
    icon: BookOpen,
    gradient: 'from-blue-500/25 to-indigo-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  dialogue: {
    label: 'Dialogue',
    icon: MessageCircle,
    gradient: 'from-amber-500/25 to-orange-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  summary: {
    label: 'Summary',
    icon: AlignLeft,
    gradient: 'from-emerald-500/25 to-green-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  analogy: {
    label: 'Analogy',
    icon: Lightbulb,
    gradient: 'from-purple-500/25 to-violet-500/10',
    iconColor: 'text-purple-600 dark:text-purple-400',
    badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getExcerpt(item: StoryWithDeck): string {
  const { story } = item;
  if (!story) return '';

  for (const para of story.paragraphs) {
    let text = para.primary || '';
    // Skip pure [TOPIC: ...] paragraphs
    if (/^\[TOPIC:/i.test(text.trim())) {
      const match = text.match(/^\[TOPIC:\s*.+?\]\s*([\s\S]*)/i);
      text = match?.[1]?.trim() ?? '';
    }
    if (!text) continue;
    // Strip dialogue markers
    text = text.replace(/^\[T\]:\s*/m, '').replace(/\[S\]:\s*/gm, ' ').replace(/\[T\]:\s*/gm, ' ');
    // Strip bold/italic markdown
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
    text = text.trim();
    if (text.length > 120) return text.slice(0, 117) + '…';
    if (text) return text;
  }
  return '';
}

function formatReadingTime(min: number | string): string {
  if (min === 0 || min === 'minimal') return 'Minimal';
  return `${min} min`;
}

function formatRelativeDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatLanguage(primary: string, secondary: string | null): string {
  if (secondary) return `${primary.toUpperCase()} → ${secondary.toUpperCase()}`;
  return primary.toUpperCase();
}

// ─── Story Card ────────────────────────────────────────────────────────────────

interface StoryCardProps {
  item: StoryWithDeck;
  onRead: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDownloadPdf: (e: React.MouseEvent) => void;
  isDownloadingPdf: boolean;
}

function StoryCard({ item, onRead, onEdit, onDownloadPdf, isDownloadingPdf }: StoryCardProps) {
  const { story } = item;
  const format = (story?.story_format ?? 'narrative') as StoryFormat;
  const config = FORMAT_CONFIG[format] ?? FORMAT_CONFIG.narrative;
  const FormatIcon = config.icon;
  const excerpt = getExcerpt(item);

  return (
    <div
      className="group relative flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
      onClick={onRead}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRead()}
      aria-label={`Read story: ${item.deck_name}`}
    >
      {/* Gradient header */}
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r',
          config.gradient
        )}
      >
        <FormatIcon className={cn('h-5 w-5 flex-shrink-0', config.iconColor)} />
        <span className={cn('text-xs font-semibold uppercase tracking-wide', config.iconColor)}>
          {config.label}
        </span>

        {/* ⋮ menu — stop propagation so card click doesn't fire */}
        <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Story options"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => onEdit(e)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => onDownloadPdf(e)} disabled={isDownloadingPdf}>
                <FileDown className="mr-2 h-4 w-4" />
                {isDownloadingPdf ? 'Exporting…' : 'Download PDF'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="font-semibold text-base leading-tight line-clamp-2">{item.deck_name}</h3>
        {excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{excerpt}</p>
        )}
      </div>

      {/* Metadata footer */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground border-t pt-2 mt-auto">
        <span className="flex items-center gap-1">
          <Globe className="h-3 w-3" />
          {formatLanguage(item.primary_language, item.secondary_language)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatReadingTime(story!.reading_time_min)}
        </span>
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          Age {story!.age_at_generation}
        </span>
        {story!.updated_at && (
          <span className="ml-auto">{formatRelativeDate(story!.updated_at)}</span>
        )}
      </div>
    </div>
  );
}

// ─── Empty deck card ───────────────────────────────────────────────────────────

function EmptyDeckCard({ item, onGenerate }: { item: StoryWithDeck; onGenerate: () => void }) {
  return (
    <div
      className="flex flex-col rounded-xl border border-dashed bg-card/50 opacity-70 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
      onClick={onGenerate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
      aria-label={`Generate story for: ${item.deck_name}`}
    >
      {/* Gray header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-muted/60 to-muted/20">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          No story
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="font-semibold text-base leading-tight line-clamp-2 text-muted-foreground">
          {item.deck_name}
        </h3>
        <p className="text-sm text-muted-foreground/70">No story generated yet</p>
      </div>

      {/* CTA */}
      <div className="px-4 pb-3 pt-2 border-t mt-auto">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2"
          onClick={(e) => { e.stopPropagation(); onGenerate(); }}
        >
          <Plus className="h-3 w-3" />
          Generate story
        </Button>
      </div>
    </div>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-xl border bg-card overflow-hidden">
      <Skeleton className="h-11 w-full rounded-none" />
      <div className="p-4 flex flex-col gap-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="px-4 pb-3 pt-2 border-t flex gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-10" />
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StoriesPageClient() {
  const router = useRouter();
  const { settings } = useSettings();
  const [items, setItems] = useState<StoryWithDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingDeckId, setDownloadingDeckId] = useState<string | null>(null);

  useEffect(() => {
    getAllStoriesWithDecks().then((result) => {
      if (!result.error && result.data) {
        setItems(result.data);
      } else if (result.error) {
        appLogger.error('[StoriesPage] Failed to load stories:', result.error);
        toast.error('Could not load stories');
      }
      setIsLoading(false);
    });
  }, []);

  const handleDownloadPdf = useCallback(
    async (item: StoryWithDeck, e: React.MouseEvent) => {
      e?.stopPropagation();
      if (!item.story || downloadingDeckId === item.deck_id) return;
      setDownloadingDeckId(item.deck_id);
      try {
        const res = await fetch('/api/generate-story-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deckId: item.deck_id,
            cardFont: settings?.cardFont ?? 'default',
            pdfCardContentFontSize: settings?.pdfCardContentFontSize ?? 11,
          }),
        });
        if (!res.ok) {
          toast.error('PDF export failed');
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${item.deck_name || 'story'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        appLogger.error('[StoriesPage] PDF export error:', err);
        toast.error('Could not export PDF');
      } finally {
        setDownloadingDeckId(null);
      }
    },
    [downloadingDeckId, settings]
  );

  const storiesCount = items.filter((i) => i.story !== null).length;
  const totalCount = items.length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ScrollText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Stories</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Your generated learning stories
          </p>
        </div>
        {!isLoading && totalCount > 0 && (
          <Badge variant="secondary" className="shrink-0 mt-1">
            {storiesCount} of {totalCount} deck{totalCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <ScrollText className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg font-medium text-muted-foreground">No decks yet</p>
          <p className="text-sm text-muted-foreground/70">
            Create a deck first, then generate a story from the deck&apos;s edit page.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) =>
            item.story ? (
              <StoryCard
                key={item.deck_id}
                item={item}
                onRead={() =>
                  router.push(`/practice/story/${item.deck_id}?from=stories`)
                }
                onEdit={(e) => {
                  e.stopPropagation();
                  router.push(`/edit/${item.deck_id}?tab=story`);
                }}
                onDownloadPdf={(e) => handleDownloadPdf(item, e)}
                isDownloadingPdf={downloadingDeckId === item.deck_id}
              />
            ) : (
              <EmptyDeckCard
                key={item.deck_id}
                item={item}
                onGenerate={() => router.push(`/edit/${item.deck_id}?tab=story`)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
