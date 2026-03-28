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
  Globe,
  Tag,
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
import {
  StoryMethodIcon,
  MethodThumbnail,
  STUDY_METHOD_CONFIG,
} from '@/components/study-method/study-method-config';
import { SubjectWatermark } from '@/components/study-method/subject-watermark';

// ─── Story format config (icon only — format label shown in footer) ───────────

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
    if (/^\[TOPIC:/i.test(text.trim())) {
      const match = text.match(/^\[TOPIC:\s*.+?\]\s*([\s\S]*)/i);
      text = match?.[1]?.trim() ?? '';
    }
    if (!text) continue;
    text = text.replace(/^\[T\]:\s*/m, '').replace(/\[S\]:\s*/gm, ' ').replace(/\[T\]:\s*/gm, ' ');
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
    text = text.trim();
    if (text) return text.length > 120 ? text.slice(0, 117) + '…' : text;
  }
  return '';
}

function formatReadingTime(min: number | string): string {
  if (min === 0 || min === 'minimal') return 'Minimal';
  return `${min} min read`;
}

function formatLanguage(primary: string, secondary: string | null): string {
  if (secondary) return `${primary} / ${secondary}`;
  return primary;
}

// ─── Story card ───────────────────────────────────────────────────────────────

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
  const formatCfg = FORMAT_CONFIG[format] ?? FORMAT_CONFIG.narrative;
  const FormatIcon = formatCfg.icon;
  const cfg = STUDY_METHOD_CONFIG.story;
  const excerpt = getExcerpt(item);

  return (
    <div
      className={cn(
        'group relative rounded-lg border overflow-hidden transition-all duration-200 cursor-pointer',
        'bg-white border-gray-200 hover:shadow-lg hover:border-gray-300',
        'dark:bg-slate-800 dark:border-slate-700 dark:hover:shadow-[0_8px_16px_rgba(255,255,255,0.08)] dark:hover:border-slate-600'
      )}
      onClick={onRead}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRead()}
      aria-label={`Read story: ${item.deck_name}`}
    >
      {/* Background subject watermark — spans full card */}
      <SubjectWatermark
        title={item.deck_name}
        tags={item.tags}
        methodType="story"
      />

      {/* ── Header: white bg, story icon + purple title + ⋮ menu ── */}
      <div className="px-4 py-3 relative z-10">
        <div className="flex items-center gap-2">
          <StoryMethodIcon className={cn('w-4 h-4 flex-shrink-0', cfg.textColor)} />
          <h3
            className={cn('text-sm font-semibold truncate flex-1 min-w-0', cfg.textColor)}
            title={item.deck_name}
          >
            {item.deck_name}
          </h3>
          {/* ⋮ menu — stops card click */}
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Story options"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
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
      </div>
      {/* divider: uses content bg color for seamless transition */}
      <div className={cn('h-px', cfg.bgSection)} />

      {/* ── Content: purple bg, info left + book thumbnail right ── */}
      <div className={cn('p-4 flex gap-4', cfg.bgSection)}>
        <div className="flex-1 min-w-0 space-y-2 relative z-10">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatLanguage(item.primary_language, item.secondary_language)}</span>
          </div>
          {story && (
            <p className="text-xs text-gray-600 dark:text-slate-400">{formatReadingTime(story.reading_time_min)}</p>
          )}
          {excerpt && (
            <p className="text-xs line-clamp-1 text-gray-500 dark:text-slate-500">{excerpt}</p>
          )}
        </div>
        {/* Thumbnail: -mr-6 pushes past flex boundary → overflow-hidden clips right edge */}
        <div className="w-16 h-16 flex-shrink-0 relative -mr-6 z-10">
          <div className="absolute right-0 top-0">
            <MethodThumbnail type="story" />
          </div>
        </div>
      </div>

      {/* ── Footer: white bg, format icon + label — matches flashcard footer height ── */}
      <div className="px-4 pb-3 pt-2 flex items-center gap-1.5 relative z-10">
        <FormatIcon className={cn('h-3.5 w-3.5', cfg.textColor)} />
        <span className={cn('text-xs font-medium', cfg.textColor)}>{formatCfg.label}</span>
      </div>
    </div>
  );
}

// ─── Empty deck card ───────────────────────────────────────────────────────────

function EmptyDeckCard({ item, onGenerate }: { item: StoryWithDeck; onGenerate: () => void }) {
  const cfg = STUDY_METHOD_CONFIG.story;

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-dashed overflow-hidden transition-all duration-200 cursor-pointer opacity-60 hover:opacity-80',
        'bg-white border-gray-200',
        'dark:bg-slate-800 dark:border-slate-700'
      )}
      onClick={onGenerate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onGenerate()}
      aria-label={`Generate story for: ${item.deck_name}`}
    >
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StoryMethodIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <h3 className="text-sm font-semibold truncate flex-1 min-w-0 text-muted-foreground" title={item.deck_name}>
            {item.deck_name}
          </h3>
        </div>
      </div>
      <div className="h-px bg-muted" />

      {/* Content */}
      <div className="p-4 flex gap-4 bg-muted/20">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-400">
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatLanguage(item.primary_language, item.secondary_language)}</span>
          </div>
          <p className="text-xs text-muted-foreground/70">No story generated yet</p>
        </div>
        <div className="w-16 h-16 flex-shrink-0 relative -mr-6 opacity-30">
          <div className="absolute right-0 top-0">
            <MethodThumbnail type="story" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground hover:text-foreground gap-1 px-1 -ml-1"
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
    <div className="rounded-lg border overflow-hidden bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="h-px bg-muted" />
      <div className="p-4 bg-muted/20 flex gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-full" />
        </div>
        <Skeleton className="w-14 h-14 flex-shrink-0 rounded-lg" />
      </div>
      <div className="px-4 pb-4 pt-3">
        <Skeleton className="h-3 w-20" />
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
        if (!res.ok) { toast.error('PDF export failed'); return; }
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
            <ScrollText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            <h1 className="text-2xl font-bold">Stories</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Your generated learning stories</p>
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
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
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
                onRead={() => router.push(`/practice/story/${item.deck_id}?from=stories`)}
                onEdit={(e) => { e.stopPropagation(); router.push(`/edit/${item.deck_id}?tab=story`); }}
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
