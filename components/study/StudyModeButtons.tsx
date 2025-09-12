// components/study/StudyModeButtons.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter, usePathname } from 'next/navigation';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardSrsStatesByIds } from '@/lib/actions/cardActions';
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudySessionInput, SessionType } from '@/types/study';
import { Loader2 as IconLoader, GraduationCap, Play } from 'lucide-react';
import { toast } from 'sonner';
import { isValid, parseISO } from 'date-fns';
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // Import for criteria construction

interface StudyModeButtonsProps {
  studyType: 'deck' | 'studySet';
  contentId: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  learnLabel?: string;
  reviewLabel?: string;
  preCalculatedLearnCount?: number;
  preCalculatedReviewCount?: number;
  batchFetchInProgress?: boolean;
}

export function StudyModeButtons({
  studyType,
  contentId,
  className = '',
  size = 'default',
  learnLabel = 'Learn',
  reviewLabel = 'Review',
  preCalculatedLearnCount,
  preCalculatedReviewCount,
  batchFetchInProgress = false
}: StudyModeButtonsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);
  const clearStudyParameters = useStudySessionStore((state) => state.clearStudyParameters);

  const [isLoading, setIsLoading] = useState(
    preCalculatedLearnCount === undefined &&
    (batchFetchInProgress || preCalculatedReviewCount === undefined)
  );
  const [learnCount, setLearnCount] = useState(preCalculatedLearnCount ?? 0);
  const [reviewCount, setReviewCount] = useState(preCalculatedReviewCount ?? 0);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<{[key: string]: boolean}>({});

  useEffect(() => {
    console.log(`[StudyModeButtons] Mounted for ${contentId}: preLearn=${preCalculatedLearnCount}, preRev=${preCalculatedReviewCount}, batchInProg=${batchFetchInProgress}`);
  }, [contentId, preCalculatedLearnCount, preCalculatedReviewCount, batchFetchInProgress]);

  useEffect(() => {
    if (preCalculatedLearnCount !== undefined && preCalculatedReviewCount !== undefined) {
      setIsLoading(false);
      setLearnCount(preCalculatedLearnCount);
      setReviewCount(preCalculatedReviewCount);
    }
  }, [preCalculatedLearnCount, preCalculatedReviewCount]);

  useEffect(() => {
    console.log(`[StudyModeButtons] Loading state for ${contentId} is now:`, isLoading);
  }, [isLoading, contentId]);

  useEffect(() => {
    if (preCalculatedLearnCount !== undefined && preCalculatedReviewCount !== undefined) return;
    if (batchFetchInProgress) {
      console.log(`[StudyModeButtons] Skipping fetch for ${contentId} - batch fetch in progress by parent`);
      return;
    }
    if (fetchedRef.current[contentId]) {
      console.log(`[StudyModeButtons] Skipping fetch for ${contentId} - already fetched`);
      return;
    }

    const fetchCardCounts = async () => {
      if (!contentId) return;
      fetchedRef.current[contentId] = true;
      setIsLoading(true);
      setError(null);
      try {
        console.log(`[StudyModeButtons] Fetching counts for ${studyType} ID: ${contentId}`);

        // Explicitly construct the payload for resolveStudyQuery
        let queryPayloadForAction: Parameters<typeof resolveStudyQuery>[0];
        if (studyType === 'studySet') {
            queryPayloadForAction = { studySetId: contentId };
        } else { // deck
            const criteriaForDeck: StudyQueryCriteria = {
                deckIds: [contentId],
                tagLogic: 'ANY', // Default, other filters can be added if needed by StudyModeButtons
            };
            queryPayloadForAction = { criteria: criteriaForDeck };
        }

        const cardIdsResult = await resolveStudyQuery(queryPayloadForAction); // Use the correctly shaped payload
        // ... (rest of the logic for srsStatesResult and setting counts remains the same)
        if (cardIdsResult.error || !cardIdsResult.data) {
            throw new Error(cardIdsResult.error || `Failed to fetch card IDs for ${studyType} ${contentId}`);
        }
        const cardIds = cardIdsResult.data;
        if (cardIds.length === 0) {
            setLearnCount(0); setReviewCount(0); setIsLoading(false); return;
        }
        const srsStatesResult = await getCardSrsStatesByIds(cardIds);
        if (srsStatesResult.error || !srsStatesResult.data) {
            throw new Error(srsStatesResult.error || `Failed to fetch SRS states for ${studyType} ${contentId}`);
        }
        const cardStates = srsStatesResult.data;
        const now = new Date();
        const learnEligibleCards = cardStates.filter(card =>
            card.srs_level === 0 && (card.learning_state === null || card.learning_state === 'learning')
        );
        const reviewEligibleCards = cardStates.filter(card => {
            const isGraduatedOrRelearning = (card.srs_level != null && card.srs_level >= 1) || (card.srs_level === 0 && card.learning_state === 'relearning');
            const isDue = card.next_review_due && isValid(parseISO(card.next_review_due)) && parseISO(card.next_review_due) <= now;
            return isGraduatedOrRelearning && isDue;
        });
        setLearnCount(learnEligibleCards.length);
        setReviewCount(reviewEligibleCards.length);

      } catch (err) {
        const message = err instanceof Error ? err.message : "Error checking available cards";
        console.error(`[StudyModeButtons] Error fetching counts for ${contentId}:`, message);
        setError(message);
        setLearnCount(0); setReviewCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCardCounts();
  }, [contentId, studyType, preCalculatedLearnCount, preCalculatedReviewCount, batchFetchInProgress]);

  const handleStartStudying = (sessionTypeToStart: SessionType) => {
    let studyInputForStore: StudySessionInput;

    if (studyType === 'studySet') {
      studyInputForStore = { studySetId: contentId };
    } else { // deck
      // For a deck, StudySessionInput expects a deckId directly
      studyInputForStore = { deckId: contentId };
    }

    console.log(`[StudyModeButtons] Starting '${sessionTypeToStart}' session from ${pathname} with input:`, studyInputForStore);

    if (sessionTypeToStart === 'learn-only' && learnCount === 0) {
      toast.info("No new cards available to learn in this selection.");
      return;
    }
    if (sessionTypeToStart === 'review-only' && reviewCount === 0) {
      toast.info("No cards currently due for review in this selection.");
      return;
    }

    clearStudyParameters();
    setStudyParameters(studyInputForStore, sessionTypeToStart, pathname, true);
    router.push('/study/session');
  };

  // ... (rest of the JSX remains the same) ...
  return (
    <div className={`flex gap-2 ${className}`}>
      {isLoading ? (
        <div className="flex items-center text-muted-foreground text-sm h-9">
          <IconLoader className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </div>
      ) : error ? (
        <div className="flex items-center text-destructive text-sm h-9" title={error}>
            Error
        </div>
      ) : (
        <>
          <Button
            variant="secondary"
            size={size}
            className="bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => handleStartStudying('learn-only')}
            disabled={learnCount === 0}
            title={learnCount === 0 ? "No cards to learn" : `${learnLabel} ${learnCount} card(s)`}
          >
            <GraduationCap className="h-4 w-4 mr-1" /> {learnLabel} {learnCount > 0 && `(${learnCount})`}
          </Button>
          <Button
            variant="secondary"
            size={size}
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={() => handleStartStudying('review-only')}
            disabled={reviewCount === 0}
            title={reviewCount === 0 ? "No cards to review" : `${reviewLabel} ${reviewCount} card(s)`}
          >
            <Play className="h-4 w-4 mr-1" /> {reviewLabel} {reviewCount > 0 && `(${reviewCount})`}
          </Button>
        </>
      )}
    </div>
  );
}