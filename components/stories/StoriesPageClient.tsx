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
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import { getAllStoriesWithDecks } from '@/lib/actions/storyActions';
import type { StoryWithDeck } from '@/lib/actions/storyActions';
import type { StoryFormat } from '@/types/story';
import { useSettings } from '@/providers/settings-provider';

// ─── Format config — icon only, no per-format colour ───────────────────────────

const FORMAT_CONFIG: Record<
  StoryFormat,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  narrative: { label: 'Narrative', icon: BookOpen },
  dialogue:  { label: 'Dialogue',  icon: MessageCircle },
  summary:   { label: 'Summary',   icon: AlignLeft },
  analogy:   { label: 'Analogy',   icon: Lightbulb },
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
    <Card
      className="group hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-primary/5 dark:from-primary/10 to-transparent dark:border-slate-700 cursor-pointer"
      onClick={onRead}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRead()}
      aria-label={`Read story: ${item.deck_name}`}
    >
      <CardHeader className="pt-4 pb-2 space-y-1 px-4">
        <div className="flex justify-between items-start">
          {/* Story-mode type badge — consistent across all story cards */}
          <div className="flex items-center gap-1 text-xs text-primary/70 font-medium">
            <ScrollText className="h-3 w-3" />
            <span className="uppercase tracking-wide">Story</span>
          </div>

          {/* ⋮ menu — stop propagation so card click doesn't fire */}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 -mr-1 shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
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

        {/* Deck name — same style as CardTitle in deck cards */}
        <CardTitle className="truncate text-lg font-medium" title={item.deck_name}>
          {item.deck_name}
        </CardTitle>
      </CardHeader>

      {/* Content area — matches deck card's CardContent section */}
      <CardContent className="px-4 pt-2 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg space-y-2">
        {/* Format row — icon + label, neutral colour, distinguishes story sub-type */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FormatIcon className="h-3.5 w-3.5 shrink-0" />
          <span>{config.label}</span>
        </div>

        {excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{excerpt}</p>
        )}

        <Separator className="my-1" />

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}

// ─── Empty deck card ───────────────────────────────────────────────────────────

function EmptyDeckCard({ item, onGenerate }: { item: StoryWithDeck; onGenerate: () => void }) {
  return (
    <Card
      className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-muted/40 to-transparent dark:border-slate-700 cursor-pointer opacity-60 hover:opacity-80 border-dashed"
      onClick={onGenerate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
      aria-label={`Generate story for: ${item.deck_name}`}
    >
      <CardHeader className="pt-4 pb-2 space-y-1 px-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
          <ScrollText className="h-3 w-3" />
          <span className="uppercase tracking-wide">Story</span>
        </div>
        <CardTitle className="truncate text-lg font-medium text-muted-foreground" title={item.deck_name}>
          {item.deck_name}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pt-2 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span>No story yet</span>
        </div>

        <Separator className="my-1" />

        <div className="flex items-center gap-x-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            {formatLanguage(item.primary_language, item.secondary_language)}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2 -ml-2 mt-1"
          onClick={(e) => { e.stopPropagation(); onGenerate(); }}
        >
          <Plus className="h-3 w-3" />
          Generate story
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="pt-4 pb-2 px-4 space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-5 w-3/4" />
      </CardHeader>
      <CardContent className="px-4 pt-2 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Separator />
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
      </CardContent>
    </Card>
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
