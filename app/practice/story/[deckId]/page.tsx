// app/practice/story/[deckId]/page.tsx
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStoryStore } from '@/store/storyStore';
import { getStoryForDeck, getDeckLanguages } from '@/lib/actions/storyActions';
import { useSettings } from '@/providers/settings-provider';
import { useTTS } from '@/hooks/use-tts';
import { getFontClass } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Volume2, Square, GraduationCap, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import type { Story } from '@/types/story';

// ─── Sentence splitting ───────────────────────────────────────────────────────

function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+/g) || [text];
  return raw.map((s) => s.trim()).filter(Boolean);
}

// ─── Dialogue parsing ─────────────────────────────────────────────────────────

interface DialogueLine {
  speaker: 'T' | 'S' | 'topic';
  text: string;
}

/**
 * Parses a dialogue paragraph that uses [TOPIC: ...], [T]: and [S]: markers.
 * Falls back to rendering as plain text if no markers are found.
 */
function parseDialogueParagraph(text: string): DialogueLine[] | null {
  if (!text.includes('[T]:') && !text.includes('[S]:')) return null;

  const lines: DialogueLine[] = [];
  const raw = text.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of raw) {
    const topicMatch = line.match(/^\[TOPIC:\s*(.+?)\]$/i);
    const tMatch = line.match(/^\[T\]:\s*(.+)$/);
    const sMatch = line.match(/^\[S\]:\s*(.+)$/);

    if (topicMatch) {
      lines.push({ speaker: 'topic', text: topicMatch[1] });
    } else if (tMatch) {
      lines.push({ speaker: 'T', text: tMatch[1] });
    } else if (sMatch) {
      lines.push({ speaker: 'S', text: sMatch[1] });
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
              className="flex items-center gap-2 pt-3 pb-1 border-t border-border/50 first:pt-0 first:border-t-0"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                    {sentence}{' '}
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

  const { currentStory, currentDeckName, currentDeckId, originUrl, clearCurrentStory } = useStoryStore();
  const { settings } = useSettings();
  const { speak, stop, ttsState } = useTTS({});

  const [story, setStory] = useState<Story | null>(null);
  const [deckName, setDeckName] = useState<string>('');
  const [primaryLanguage, setPrimaryLanguage] = useState<string>('en');
  const [secondaryLanguage, setSecondaryLanguage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ttsActive, setTtsActive] = useState(false);
  const [currentSentenceKey, setCurrentSentenceKey] = useState<string | null>(null);

  const ttsAbortRef = useRef(false);

  // Load story + deck languages
  useEffect(() => {
    const load = async () => {
      let loadedStory: Story | null = null;

      if (currentStory && currentDeckId === deckId) {
        loadedStory = currentStory;
        setDeckName(currentDeckName ?? '');
      } else {
        const { data, error } = await getStoryForDeck(deckId);
        if (error || !data) {
          appLogger.warn('[StoryPage] No story found, redirecting to edit.');
          router.replace(`/edit/${deckId}?tab=story`);
          return;
        }
        loadedStory = data;
      }

      setStory(loadedStory);

      // Always fetch deck languages (needed for TTS)
      const { data: langs } = await getDeckLanguages(deckId);
      if (langs) {
        setPrimaryLanguage(langs.primary_language);
        setSecondaryLanguage(langs.secondary_language);
      }

      setIsLoading(false);
    };
    load();
  }, [deckId, currentStory, currentDeckId, currentDeckName, router]);

  // TTS language: knowledge → primary language; translation → secondary language (L2 is primary text)
  const ttsLanguage = useMemo(() => {
    if (!story) return primaryLanguage;
    return story.deck_mode === 'translation'
      ? (secondaryLanguage ?? primaryLanguage)
      : primaryLanguage;
  }, [story, primaryLanguage, secondaryLanguage]);

  // Flatten all speakable sentences with unique keys
  const allSentences = useMemo(() => {
    if (!story) return [];
    const isDialogue = story.story_format === 'dialogue';

    return story.paragraphs.flatMap((para, pIdx) => {
      const text = isDialogue ? stripDialogueMarkers(para.primary) : para.primary;
      return splitIntoSentences(text).map((sentence, sIdx) => ({
        key: `${pIdx}-${sIdx}`,
        text: sentence,
      }));
    });
  }, [story]);

  const handleBack = useCallback(() => {
    stop();
    setTtsActive(false);
    ttsAbortRef.current = true;
    if (originUrl) {
      router.push(originUrl);
    } else {
      router.back();
    }
  }, [originUrl, router, stop]);

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

    for (const { key, text } of allSentences) {
      if (ttsAbortRef.current) break;
      setCurrentSentenceKey(key);
      try {
        await speak(text, ttsLanguage);
      } catch (err) {
        appLogger.error('[StoryPage] TTS error:', err);
        toast.error('Text-to-speech error', { description: 'Could not read sentence.' });
        break;
      }
    }

    setTtsActive(false);
    setCurrentSentenceKey(null);
  }, [ttsActive, allSentences, speak, stop, ttsLanguage]);

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

  // For non-dialogue modes: annotate sentences with highlight keys
  const annotatedParagraphs = story.paragraphs.map((para, pIdx) => {
    const sentences = splitIntoSentences(para.primary).map((s, sIdx) => ({
      key: `${pIdx}-${sIdx}`,
      text: s,
    }));
    return { primary: sentences, secondary: para.secondary, raw: para.primary };
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-base font-semibold truncate mx-4 flex-1 text-center">
          {deckName || 'Story'}
        </h1>
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
              <Volume2 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Read aloud</span>
            </>
          )}
        </Button>
      </div>

      {/* Story body */}
      <article className={cn('space-y-6', fontClass)}>
        {isDialogue
          ? story.paragraphs.map((para, pIdx) => {
              const lines = parseDialogueParagraph(para.primary);
              return (
                <div key={pIdx}>
                  {lines ? (
                    <DialogueParagraphView
                      lines={lines}
                      currentSentenceKey={currentSentenceKey}
                      paraIdx={pIdx}
                    />
                  ) : (
                    <p className="leading-relaxed text-base">{para.primary}</p>
                  )}
                  {story.deck_mode === 'translation' && para.secondary && (
                    <div className="mt-2 text-sm text-muted-foreground italic border-l-2 border-muted pl-3 leading-relaxed space-y-1">
                      {parseDialogueParagraph(para.secondary)
                        ? parseDialogueParagraph(para.secondary)!.map((line, i) =>
                            line.speaker === 'topic' ? null : (
                              <p key={i}>{line.text}</p>
                            )
                          )
                        : para.secondary}
                    </div>
                  )}
                </div>
              );
            })
          : annotatedParagraphs.map(({ primary, secondary }, pIdx) => (
              <div key={pIdx}>
                <p className="leading-relaxed text-base">
                  {primary.map(({ key, text }) => (
                    <span
                      key={key}
                      className={cn(
                        'transition-colors duration-200',
                        currentSentenceKey === key && 'bg-primary/20 rounded px-0.5'
                      )}
                    >
                      {text}{' '}
                    </span>
                  ))}
                </p>
                {story.deck_mode === 'translation' && secondary && (
                  <p className="mt-2 text-sm text-muted-foreground italic border-l-2 border-muted pl-3 leading-relaxed">
                    {secondary}
                  </p>
                )}
              </div>
            ))}
      </article>
    </div>
  );
}
