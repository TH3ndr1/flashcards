// app/practice/story/[deckId]/page.tsx
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStoryStore } from '@/store/storyStore';
import { getStoryForDeck } from '@/lib/actions/storyActions';
import { useSettings } from '@/providers/settings-provider';
import { useTTS } from '@/hooks/use-tts';
import { getFontClass } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Volume2, Square } from 'lucide-react';
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import type { Story } from '@/types/story';

// Split a paragraph into sentences for TTS tracking
function splitIntoSentences(text: string): string[] {
  const raw = text.match(/[^.!?]+[.!?]+/g) || [text];
  return raw.map((s) => s.trim()).filter(Boolean);
}

export default function StoryPage() {
  const params = useParams();
  const deckId = params.deckId as string;
  const router = useRouter();

  const { currentStory, currentDeckName, currentDeckId, originUrl, clearCurrentStory } = useStoryStore();
  const { settings } = useSettings();
  const { speak, stop, ttsState } = useTTS({});

  const [story, setStory] = useState<Story | null>(null);
  const [deckName, setDeckName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [ttsActive, setTtsActive] = useState(false);
  const [currentSentenceKey, setCurrentSentenceKey] = useState<string | null>(null);

  const ttsAbortRef = useRef(false);

  // Load story: from store if available, else fetch
  useEffect(() => {
    const load = async () => {
      if (currentStory && currentDeckId === deckId) {
        setStory(currentStory);
        setDeckName(currentDeckName ?? '');
        setIsLoading(false);
        return;
      }

      // Fallback: fetch from DB
      const { data, error } = await getStoryForDeck(deckId);
      if (error || !data) {
        appLogger.warn('[StoryPage] No story found, redirecting to edit.');
        router.replace(`/edit/${deckId}?tab=story`);
        return;
      }
      setStory(data);
      setIsLoading(false);
    };
    load();
  }, [deckId, currentStory, currentDeckId, currentDeckName, router]);

  // Flatten all primary sentences with keys for highlight tracking
  const allSentences = useMemo(() => {
    if (!story) return [];
    return story.paragraphs.flatMap((para, pIdx) =>
      splitIntoSentences(para.primary).map((sentence, sIdx) => ({
        key: `${pIdx}-${sIdx}`,
        text: sentence,
        language: story.deck_mode === 'translation'
          ? 'en' // secondary language is L2; primary is source for translation
          : 'en',
      }))
    );
  }, [story]);

  // Determine TTS language from deck
  // For knowledge: primary language; for translation: secondary language (L2, the immersive language)
  const ttsLanguage = useMemo(() => {
    if (!story) return 'en';
    // We store primary_language as language name (e.g. 'English', 'French')
    // useTTS accepts ISO codes. We'll use deck primary/secondary language stored in settings
    // For now default to 'en' — the TTS hook handles language mapping
    return 'en';
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
      // Stop reading
      ttsAbortRef.current = true;
      stop();
      setTtsActive(false);
      setCurrentSentenceKey(null);
      return;
    }

    // Start reading
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

  // Build a flat map of sentence keys → text for rendering with highlights
  const sentenceKeyMap = new Map(allSentences.map(({ key, text }) => [key, text]));

  // For each paragraph, annotate sentences with their keys
  const annotatedParagraphs = story.paragraphs.map((para, pIdx) => {
    const sentences = splitIntoSentences(para.primary).map((s, sIdx) => ({
      key: `${pIdx}-${sIdx}`,
      text: s,
    }));
    return { primary: sentences, secondary: para.secondary };
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
        {annotatedParagraphs.map(({ primary, secondary }, pIdx) => (
          <div key={pIdx}>
            {/* Primary paragraph (L2 for translation, L1 for knowledge) */}
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

            {/* Secondary paragraph (L1 translation) — only for translation mode */}
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
