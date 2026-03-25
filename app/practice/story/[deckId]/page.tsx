// app/practice/story/[deckId]/page.tsx
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useStoryStore } from '@/store/storyStore';
import { getStoryForDeck, getDeckLanguages } from '@/lib/actions/storyActions';
import { useSettings } from '@/providers/settings-provider';
import { useTTS } from '@/hooks/use-tts';
import { getFontClass } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Headphones, Square, GraduationCap, MessageCircle, Hash, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import type { Story } from '@/types/story';

// ─── Markdown utilities ───────────────────────────────────────────────────────

/** Strip markdown markers — used for TTS so "sterretje sterretje" isn't spoken */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1');
}

/** Render inline markdown (bold, italic) as React nodes */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </>
  );
}

// ─── Sentence splitting ───────────────────────────────────────────────────────

function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+/g) || [text];
  return raw.map((s) => s.trim()).filter(Boolean);
}

// ─── Topic heading detection (all modes) ──────────────────────────────────────

/**
 * Detects a [TOPIC: ...] prefix at the start of a paragraph.
 * The AI sometimes outputs it as a standalone paragraph, sometimes inline.
 * Returns { title, rest } where rest is any text after the marker (trimmed).
 * Returns null if no topic marker found.
 */
function parseTopicPrefix(text: string): { title: string; rest: string } | null {
  const match = text.trim().match(/^\[TOPIC:\s*(.+?)\]\s*([\s\S]*)/i);
  if (!match) return null;
  return { title: match[1].trim(), rest: match[2].trim() };
}

// ─── Topic heading renderer ────────────────────────────────────────────────────

function TopicHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5 mt-6 mb-2 px-2.5 py-1.5 rounded-md bg-primary/8 border border-primary/20 first:mt-0">
      <Hash className="h-3 w-3 text-primary/70 flex-shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
        {title}
      </span>
    </div>
  );
}

// ─── Dialogue parsing ─────────────────────────────────────────────────────────

interface DialogueLine {
  speaker: 'T' | 'S' | 'topic';
  text: string;
}

/**
 * Parses a dialogue paragraph.
 * Supports new [T]:/[S]: markers and legacy "Teacher:"/"Student:" English format
 * (for backwards compatibility with cached stories generated before the format change).
 * Falls back to rendering as plain text if no markers are found.
 */
function parseDialogueParagraph(text: string): DialogueLine[] | null {
  const hasNewMarkers = text.includes('[T]:') || text.includes('[S]:');
  const hasLegacyMarkers = /^\s*(?:\*\*)?(?:Teacher|Student)(?:\*\*)?:/mi.test(text);
  if (!hasNewMarkers && !hasLegacyMarkers) return null;

  const lines: DialogueLine[] = [];
  const raw = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of raw) {
    const topicMatch = line.match(/^\[TOPIC:\s*(.+?)\]$/i);
    const tMatch = line.match(/^\[T\]:\s*(.+)$/);
    const sMatch = line.match(/^\[S\]:\s*(.+)$/);
    // Legacy fallback: "Teacher: ..." or "**Teacher:** ..."
    const legacyTMatch = line.match(/^(?:\*\*)?Teacher(?:\*\*)?:\s*(.+)$/i);
    const legacySMatch = line.match(/^(?:\*\*)?Student(?:\*\*)?:\s*(.+)$/i);

    if (topicMatch) {
      lines.push({ speaker: 'topic', text: topicMatch[1] });
    } else if (tMatch) {
      lines.push({ speaker: 'T', text: tMatch[1] });
    } else if (sMatch) {
      lines.push({ speaker: 'S', text: sMatch[1] });
    } else if (legacyTMatch) {
      lines.push({ speaker: 'T', text: legacyTMatch[1] });
    } else if (legacySMatch) {
      lines.push({ speaker: 'S', text: legacySMatch[1] });
    } else if (line.length > 0) {
      // Unrecognised line — append to last entry or create plain entry
      if (lines.length > 0 && lines[lines.length - 1].speaker !== 'topic') {
        lines[lines.length - 1].text += ' ' + line;
      } else {
        lines.push({ speaker: 'T', text: line });
      }
    }
  }

  return lines.length > 0 ? lines : null;
}

/** Strip dialogue markers from text for TTS (read only spoken content) */
function stripDialogueMarkers(text: string): string {
  return text
    .replace(/^\[TOPIC:[^\]]*\]\s*/gm, '')
    .replace(/^\[T\]:\s*/gm, '')
    .replace(/^\[S\]:\s*/gm, '')
    .replace(/^(?:\*\*)?Teacher(?:\*\*)?:\s*/gim, '')
    .replace(/^(?:\*\*)?Student(?:\*\*)?:\s*/gim, '')
    .trim();
}

// ─── Dialogue paragraph renderer ─────────────────────────────────────────────

function DialogueParagraphView({
  lines,
  currentSentenceKey,
  paraIdx,
}: {
  lines: DialogueLine[];
  currentSentenceKey: string | null;
  paraIdx: number;
}) {
  let sentenceCounter = 0;

  return (
    <div className="space-y-1">
      {lines.map((line, lineIdx) => {
        if (line.speaker === 'topic') {
          return (
            <div
              key={lineIdx}
              className="flex items-center gap-1.5 mt-4 mb-1 px-2.5 py-1.5 rounded-md bg-primary/8 border border-primary/20 first:mt-0"
            >
              <Hash className="h-3 w-3 text-primary/70 flex-shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide text-primary/80">
                {line.text}
              </span>
            </div>
          );
        }

        const isTeacher = line.speaker === 'T';
        const sentences = splitIntoSentences(line.text);
        const lineStartIdx = sentenceCounter;
        sentenceCounter += sentences.length;

        return (
          <div
            key={lineIdx}
            className={cn(
              'flex gap-2 rounded-lg px-3 py-2',
              isTeacher
                ? 'bg-primary/5 border border-primary/10'
                : 'bg-muted/40'
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {isTeacher ? (
                <GraduationCap className="h-4 w-4 text-primary" />
              ) : (
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <p className="leading-relaxed text-sm flex-1">
              {sentences.map((sentence, sIdx) => {
                const key = `${paraIdx}-d-${lineStartIdx + sIdx}`;
                return (
                  <span
                    key={key}
                    className={cn(
                      'transition-colors duration-200',
                      currentSentenceKey === key && 'bg-primary/20 rounded px-0.5'
                    )}
                  >
                    {renderInlineMarkdown(sentence)}{' '}
                  </span>
                );
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryPage() {
  const params = useParams();
  const deckId = params.deckId as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  const { currentDeckName, currentDeckId, originUrl } = useStoryStore();
  // ?from=stories overrides Zustand originUrl so back button returns to Stories page
  const effectiveOriginUrl = searchParams.get('from') === 'stories'
    ? '/practice/stories'
    : originUrl;
  const { settings } = useSettings();
  const { speak, preload, stop, ttsState } = useTTS({});

  const [story, setStory] = useState<Story | null>(null);
  const [deckName, setDeckName] = useState<string>('');
  const [primaryLanguage, setPrimaryLanguage] = useState<string>('en');
  const [secondaryLanguage, setSecondaryLanguage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ttsActive, setTtsActive] = useState(false);
  const [currentSentenceKey, setCurrentSentenceKey] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const ttsAbortRef = useRef(false);

  const handleExportPdf = useCallback(async () => {
    if (!story || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const res = await fetch('/api/generate-story-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckId,
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
      a.download = `${deckName || 'story'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      appLogger.error('[StoryPage] PDF export error:', err);
      toast.error('Could not export PDF');
    } finally {
      setIsExportingPdf(false);
    }
  }, [story, isExportingPdf, deckId, deckName, settings]);

  // Load story + deck info. Always fetch from DB to ensure we have the latest
  // (avoids stale Zustand store showing old story after regeneration).
  useEffect(() => {
    const load = async () => {
      const [storyResult, deckResult] = await Promise.all([
        getStoryForDeck(deckId),
        getDeckLanguages(deckId),
      ]);

      if (storyResult.error || !storyResult.data) {
        appLogger.warn('[StoryPage] No story found, redirecting to edit.');
        router.replace(`/edit/${deckId}?tab=story`);
        return;
      }

      setStory(storyResult.data);

      if (deckResult.data) {
        setDeckName(deckResult.data.name || (currentDeckId === deckId ? currentDeckName ?? '' : ''));
        setPrimaryLanguage(deckResult.data.primary_language);
        setSecondaryLanguage(deckResult.data.secondary_language);
      }

      setIsLoading(false);
    };
    load();
  }, [deckId, currentDeckId, currentDeckName, router]);

  // TTS language: knowledge → primary language; translation → secondary language (L2 is primary text)
  const ttsLanguage = useMemo(() => {
    if (!story) return primaryLanguage;
    return story.deck_mode === 'translation'
      ? (secondaryLanguage ?? primaryLanguage)
      : primaryLanguage;
  }, [story, primaryLanguage, secondaryLanguage]);

  interface SpeakableSentence { key: string; text: string; speaker?: 'T' | 'S'; }

  // Flatten all speakable sentences with unique keys (markers + markdown stripped for TTS)
  // For dialogue, each sentence carries speaker info for gendered TTS voices.
  const allSentences = useMemo((): SpeakableSentence[] => {
    if (!story) return [];
    const isDialogue = story.story_format === 'dialogue';
    const result: SpeakableSentence[] = [];

    story.paragraphs.forEach((para, pIdx) => {
      const topicParsed = parseTopicPrefix(para.primary);
      const contentText = topicParsed ? topicParsed.rest : para.primary;
      if (!contentText) return;

      if (isDialogue) {
        const lines = parseDialogueParagraph(contentText);
        if (lines) {
          let lIdx = 0;
          lines.forEach((line) => {
            if (line.speaker === 'topic') return;
            const text = stripMarkdown(line.text);
            splitIntoSentences(text).forEach((sentence, sIdx) => {
              result.push({ key: `${pIdx}-d-${lIdx}-${sIdx}`, text: sentence, speaker: line.speaker as 'T' | 'S' });
            });
            lIdx++;
          });
          return;
        }
        // Fallback: strip all markers
        const raw = stripDialogueMarkers(contentText);
        const text = stripMarkdown(raw);
        splitIntoSentences(text).forEach((sentence, sIdx) => {
          result.push({ key: `${pIdx}-${sIdx}`, text: sentence });
        });
        return;
      }

      const text = stripMarkdown(contentText);
      splitIntoSentences(text).forEach((sentence, sIdx) => {
        result.push({ key: `${pIdx}-${sIdx}`, text: sentence });
      });
    });

    return result;
  }, [story]);

  const handleBack = useCallback(() => {
    stop();
    setTtsActive(false);
    ttsAbortRef.current = true;
    if (effectiveOriginUrl) {
      router.push(effectiveOriginUrl);
    } else {
      router.back();
    }
  }, [effectiveOriginUrl, router, stop]);

  // Teacher = MALE voice, Student = FEMALE voice (both same language)
  const getGender = (speaker?: 'T' | 'S'): 'MALE' | 'FEMALE' | 'NEUTRAL' => {
    if (speaker === 'T') return 'MALE';
    if (speaker === 'S') return 'FEMALE';
    return 'NEUTRAL';
  };

  const handleTtsToggle = useCallback(async () => {
    if (ttsActive) {
      ttsAbortRef.current = true;
      stop();
      setTtsActive(false);
      setCurrentSentenceKey(null);
      return;
    }

    ttsAbortRef.current = false;
    setTtsActive(true);

    for (let i = 0; i < allSentences.length; i++) {
      if (ttsAbortRef.current) break;
      const { key, text, speaker } = allSentences[i];
      setCurrentSentenceKey(key);

      // Preload the next sentence in the background to reduce inter-sentence pause
      if (i + 1 < allSentences.length) {
        const next = allSentences[i + 1];
        preload(next.text, ttsLanguage, getGender(next.speaker));
      }

      try {
        await speak(text, ttsLanguage, getGender(speaker));
      } catch (err) {
        appLogger.error('[StoryPage] TTS error:', err);
        toast.error('Text-to-speech error', { description: 'Could not read sentence.' });
        break;
      }
    }

    setTtsActive(false);
    setCurrentSentenceKey(null);
  }, [ttsActive, allSentences, speak, preload, stop, ttsLanguage]);

  const fontClass = getFontClass(settings?.cardFont);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!story) return null;

  const isDialogue = story.story_format === 'dialogue';

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-base font-semibold truncate mx-4 flex-1 text-center">
          {deckName || 'Story'}
        </h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            title="Export to PDF"
          >
            <FileDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTtsToggle}
            disabled={ttsState === 'loading' && !ttsActive}
            title={ttsActive ? 'Stop reading' : 'Read aloud'}
            className="gap-1"
          >
            {ttsActive ? (
              <>
                <Square className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Stop</span>
              </>
            ) : (
              <>
                <Headphones className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Read aloud</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <p className="text-xs text-muted-foreground text-center mb-6">
        {story.story_format ?? 'narrative'} ·{' '}
        {story.reading_time_min === 'minimal' ? 'Minimal' : `${story.reading_time_min} min`} read ·{' '}
        age {story.age_at_generation} · {story.paragraphs.length} paragraphs
      </p>

      {/* Story body */}
      <article className={cn('space-y-4', fontClass)}>
        {story.paragraphs.map((para, pIdx) => {
          // ── Extract [TOPIC: ...] prefix if present (standalone or inline) ──
          const topicParsed = parseTopicPrefix(para.primary);
          const primaryContent = topicParsed ? topicParsed.rest : para.primary;

          // Also strip topic prefix from secondary (translation) for display
          const secondaryTopicParsed = para.secondary ? parseTopicPrefix(para.secondary) : null;
          const secondaryContent = secondaryTopicParsed ? secondaryTopicParsed.rest : para.secondary;

          // ── Dialogue paragraph ──
          if (isDialogue) {
            const lines = primaryContent ? parseDialogueParagraph(primaryContent) : null;
            return (
              <div key={pIdx}>
                {topicParsed && <TopicHeading title={topicParsed.title} />}
                {primaryContent && (lines ? (
                  <DialogueParagraphView
                    lines={lines}
                    currentSentenceKey={currentSentenceKey}
                    paraIdx={pIdx}
                  />
                ) : (
                  <p className="leading-relaxed text-base">{renderInlineMarkdown(primaryContent)}</p>
                ))}
                {story.deck_mode === 'translation' && secondaryContent && (
                  <div className="mt-2 text-sm text-muted-foreground italic border-l-2 border-muted pl-3 leading-relaxed space-y-1">
                    {parseDialogueParagraph(secondaryContent)
                      ? parseDialogueParagraph(secondaryContent)!.map((line, i) =>
                          line.speaker === 'topic' ? null : (
                            <p key={i}>{renderInlineMarkdown(line.text)}</p>
                          )
                        )
                      : renderInlineMarkdown(secondaryContent)}
                  </div>
                )}
              </div>
            );
          }

          // ── Regular narrative / summary / analogy paragraph ──
          if (!primaryContent) {
            // Heading-only paragraph (no content after the topic marker)
            return topicParsed ? <TopicHeading key={pIdx} title={topicParsed.title} /> : null;
          }

          const sentences = splitIntoSentences(primaryContent).map((s, sIdx) => ({
            key: `${pIdx}-${sIdx}`,
            text: s,
          }));
          return (
            <div key={pIdx}>
              {topicParsed && <TopicHeading title={topicParsed.title} />}
              <p className="leading-relaxed text-base">
                {sentences.map(({ key, text }) => (
                  <span
                    key={key}
                    className={cn(
                      'transition-colors duration-200',
                      currentSentenceKey === key && 'bg-primary/20 rounded px-0.5'
                    )}
                  >
                    {renderInlineMarkdown(text)}{' '}
                  </span>
                ))}
              </p>
              {story.deck_mode === 'translation' && secondaryContent && (
                <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-muted pl-3 leading-relaxed">
                  {renderInlineMarkdown(secondaryContent)}
                </p>
              )}
            </div>
          );
        })}
      </article>
    </div>
  );
}
