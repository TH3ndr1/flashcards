// components/story/StoryTabContent.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getStoryForDeck, updateStoryParagraphs, getDeckCardsHash } from '@/lib/actions/storyActions';
import { useStoryStore } from '@/store/storyStore';
import { StoryGenerateModal } from '@/components/story/StoryGenerateModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BookOpen, AlertTriangle, Eye, RefreshCw, Save } from 'lucide-react';
import type { Story, StoryParagraph } from '@/types/story';
import { appLogger } from '@/lib/logger';

interface StoryTabContentProps {
  deckId: string;
  deckName: string;
}

export function StoryTabContent({ deckId, deckName }: StoryTabContentProps) {
  const router = useRouter();
  const setCurrentStory = useStoryStore((s) => s.setCurrentStory);

  const [story, setStory] = useState<Story | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [editedParagraphs, setEditedParagraphs] = useState<StoryParagraph[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const loadStory = useCallback(async () => {
    setIsLoading(true);
    const [storyResult, hashResult] = await Promise.all([
      getStoryForDeck(deckId),
      getDeckCardsHash(deckId),
    ]);

    if (storyResult.data) {
      setStory(storyResult.data);
      setEditedParagraphs(storyResult.data.paragraphs);
      if (hashResult.data && hashResult.data !== storyResult.data.cards_hash) {
        setIsStale(true);
      }
    }
    setIsLoading(false);
  }, [deckId]);

  useEffect(() => {
    loadStory();
  }, [loadStory]);

  const handleSaveEdits = async () => {
    if (!story) return;
    setIsSaving(true);
    const { data, error } = await updateStoryParagraphs(story.id, editedParagraphs);
    if (error) {
      toast.error('Failed to save edits', { description: error });
    } else if (data) {
      setStory(data);
      toast.success('Story saved.');
    }
    setIsSaving(false);
  };

  const handleViewStory = () => {
    if (!story) return;
    setCurrentStory(story, deckName, deckId, `/edit/${deckId}?tab=story`);
    router.push(`/practice/story/${deckId}`);
  };

  const handleRegenerateClick = () => {
    if (story?.is_manually_edited) {
      setShowRegenerateConfirm(true);
    } else {
      setIsRegenerating(true);
      setShowGenerateModal(true);
    }
  };

  const handleModalClose = async () => {
    setShowGenerateModal(false);
    setIsRegenerating(false);
    // Reload story from DB and sync the store so "View Story" and deck list show the new story
    const { data: refreshed } = await getStoryForDeck(deckId);
    if (refreshed) {
      setStory(refreshed);
      setEditedParagraphs(refreshed.paragraphs);
      setCurrentStory(refreshed, deckName, deckId, `/edit/${deckId}?tab=story`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <div>
          <h3 className="text-lg font-medium">No story yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Generate an AI-powered story based on this deck&apos;s cards.
          </p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)} className="gap-2">
          <BookOpen className="h-4 w-4" />
          Generate Story
        </Button>

        <StoryGenerateModal
          deckId={deckId}
          deckName={deckName}
          isOpen={showGenerateModal}
          onClose={handleModalClose}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* Stale warning */}
      {isStale && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Your cards have changed since this story was generated.{' '}
            <button
              className="underline font-medium"
              onClick={handleRegenerateClick}
            >
              Regenerate
            </button>{' '}
            to reflect the latest deck.
          </AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleViewStory} className="gap-1">
          <Eye className="h-4 w-4" />
          View Story
        </Button>
        <Button variant="outline" size="sm" onClick={handleRegenerateClick} className="gap-1">
          <RefreshCw className="h-4 w-4" />
          Regenerate
        </Button>
      </div>

      {/* Story metadata */}
      <p className="text-xs text-muted-foreground">
        Generated for age {story.age_at_generation} ·{' '}
        {story.reading_time_min === 'minimal' ? 'Minimal' : `${story.reading_time_min} min`} read ·{' '}
        {story.story_format ?? 'narrative'} · {story.paragraphs.length} paragraphs
        {story.is_manually_edited && ' · Manually edited'}
      </p>

      {/* Editable paragraphs */}
      <div className="space-y-4">
        {editedParagraphs.map((para, idx) => (
          <div key={idx} className="space-y-2 border rounded-lg p-3">
            <label className="text-xs font-medium text-muted-foreground">
              Paragraph {idx + 1}{story.deck_mode === 'translation' ? ' — Primary (L2)' : ''}
            </label>
            <Textarea
              value={para.primary}
              onChange={(e) =>
                setEditedParagraphs((prev) =>
                  prev.map((p, i) => (i === idx ? { ...p, primary: e.target.value } : p))
                )
              }
              className="min-h-[80px] text-sm"
            />
            {story.deck_mode === 'translation' && (
              <>
                <label className="text-xs font-medium text-muted-foreground">
                  Paragraph {idx + 1} — Translation (L1)
                </label>
                <Textarea
                  value={para.secondary}
                  onChange={(e) =>
                    setEditedParagraphs((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, secondary: e.target.value } : p))
                    )
                  }
                  className="min-h-[80px] text-sm text-muted-foreground"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {/* Save button */}
      <Button onClick={handleSaveEdits} disabled={isSaving} className="gap-2">
        <Save className="h-4 w-4" />
        {isSaving ? 'Saving…' : 'Save Edits'}
      </Button>

      {/* Generate modal */}
      <StoryGenerateModal
        deckId={deckId}
        deckName={deckName}
        isOpen={showGenerateModal}
        onClose={handleModalClose}
        forceRegenerate={isRegenerating}
      />

      {/* Regenerate confirmation (when manually edited) */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate story?</AlertDialogTitle>
            <AlertDialogDescription>
              You have manually edited this story. Regenerating will replace all your edits with a new AI-generated version. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowRegenerateConfirm(false);
                setIsRegenerating(true);
                setShowGenerateModal(true);
              }}
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
