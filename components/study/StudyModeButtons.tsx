'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardSrsStatesByIds } from '@/lib/actions/cardActions';
import { useStudySessionStore, type StudyInput, type StudyMode } from '@/store/studySessionStore';
import { Loader2 as IconLoader, GraduationCap, Play } from 'lucide-react';
import { toast } from 'sonner';
import { isValid, parseISO } from 'date-fns';
import type { Tables } from "@/types/database";
import React from 'react';
import { appLogger, statusLogger } from '@/lib/logger';

interface StudyModeButtonsProps {
  /** Type of content to study - either a deck or a study set */
  studyType: 'deck' | 'studySet';
  /** ID of the deck or study set */
  contentId: string;
  /** Optional CSS class to apply to the button container */
  className?: string;
  /** Optional size variant for the buttons */
  size?: 'default' | 'sm' | 'lg';
  /** Optional label for the Learn button (default: "Learn") */
  learnLabel?: string;
  /** Optional label for the Review button (default: "Review") */
  reviewLabel?: string;
  /** Pre-calculated learn count (if provided, skips fetching) */
  preCalculatedLearnCount?: number;
  /** Pre-calculated review count (if provided, skips fetching) */
  preCalculatedReviewCount?: number;
  /** Whether a parent component is performing a batch fetch operation */
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
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);
  const clearStudyParameters = useStudySessionStore((state) => state.clearStudyParameters);
  
  // If we have counts, we're not loading; if batch fetch is in progress but no counts yet, we're loading
  const [isLoading, setIsLoading] = useState(
    preCalculatedLearnCount === undefined && 
    (batchFetchInProgress || preCalculatedReviewCount === undefined)
  );
  const [learnCount, setLearnCount] = useState(preCalculatedLearnCount ?? 0);
  const [reviewCount, setReviewCount] = useState(preCalculatedReviewCount ?? 0);
  const [error, setError] = useState<string | null>(null);
  
  // Add a ref to track if we've already fetched for this contentId
  const fetchedRef = React.useRef<{[key: string]: boolean}>({});

  // Log props on mount for debugging
  useEffect(() => {
    appLogger.info(`[StudyModeButtons] Mounted with props for ${contentId}:`, {
      preCalculatedLearnCount,
      preCalculatedReviewCount,
      batchFetchInProgress,
      initialIsLoading: isLoading
    });
  }, []);

  // Effect to update loading state when preCalculated counts change
  useEffect(() => {
    // If we have pre-calculated counts, we're no longer loading
    if (preCalculatedLearnCount !== undefined && preCalculatedReviewCount !== undefined) {
      appLogger.info(`[StudyModeButtons] Received pre-calculated counts for ${contentId}:`, 
        { learn: preCalculatedLearnCount, review: preCalculatedReviewCount });
      setIsLoading(false);
      
      // Also update the count state values to match the pre-calculated values
      setLearnCount(preCalculatedLearnCount);
      setReviewCount(preCalculatedReviewCount);
    }
  }, [preCalculatedLearnCount, preCalculatedReviewCount, contentId, setIsLoading, setLearnCount, setReviewCount]);

  // Track loading state changes
  useEffect(() => {
    appLogger.info(`[StudyModeButtons] Loading state for ${contentId} is now:`, isLoading);
  }, [isLoading, contentId]);

  useEffect(() => {
    // Skip fetching if we have pre-calculated counts
    if (preCalculatedLearnCount !== undefined && preCalculatedReviewCount !== undefined) {
      return;
    }
    
    // Skip if parent is doing a batch fetch
    if (batchFetchInProgress) {
      appLogger.info(`[StudyModeButtons] Skipping fetch for ${contentId} - batch fetch in progress`);
      return;
    }
    
    // Skip if we've already fetched for this content ID
    if (fetchedRef.current[contentId]) {
      return;
    }
    
    const fetchCardCounts = async () => {
      if (!contentId) return;
      
      // Mark that we're fetching for this content ID
      fetchedRef.current[contentId] = true;
      
      setIsLoading(true);
      setError(null);
      
      try {
        appLogger.info(`[StudyModeButtons] Fetching counts for ${studyType} ID: ${contentId}`);
        
        // Step 1: Get all card IDs matching the content (deck or study set)
        if (studyType === 'studySet') {
          const studySetQuery = { studySetId: contentId };
          const cardIdsResult = await resolveStudyQuery(studySetQuery);
          
          if (cardIdsResult.error || !cardIdsResult.data) {
            appLogger.error(`Error fetching study set cards:`, cardIdsResult.error);
            setError(`Failed to check available cards`);
            setLearnCount(0);
            setReviewCount(0);
            return;
          }
          
          const cardIds = cardIdsResult.data;
          processCardIds(cardIds);
        } else {
          // For decks, use proper typing for tagLogic
          const deckQuery = { 
            criteria: { 
              deckId: contentId, 
              tagLogic: 'ANY' as const, // Use const assertion to fix type
              includeDifficult: false 
            } 
          };
          
          const cardIdsResult = await resolveStudyQuery(deckQuery);
          
          if (cardIdsResult.error || !cardIdsResult.data) {
            appLogger.error(`Error fetching deck cards:`, cardIdsResult.error);
            setError(`Failed to check available cards`);
            setLearnCount(0);
            setReviewCount(0);
            return;
          }
          
          const cardIds = cardIdsResult.data;
          processCardIds(cardIds);
        }
      } catch (error) {
        appLogger.error("Error fetching card counts:", error);
        setError("Error checking available cards");
        setLearnCount(0);
        setReviewCount(0);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Helper function to process card IDs and update counts
    const processCardIds = async (cardIds: string[]) => {
      appLogger.info(`[StudyModeButtons] Found ${cardIds.length} total cards`);
      
      if (cardIds.length === 0) {
        setLearnCount(0);
        setReviewCount(0);
        return;
      }
      
      // Step 2: Efficiently fetch only the SRS state fields for all cards in one request
      const srsStatesResult = await getCardSrsStatesByIds(cardIds);
      
      if (srsStatesResult.error || !srsStatesResult.data) {
        appLogger.error(`Error fetching card SRS states:`, srsStatesResult.error);
        setError(`Failed to check card states`);
        setLearnCount(0);
        setReviewCount(0);
        return;
      }
      
      // Step 3: Filter and count locally based on SRS state
      const cardStates = srsStatesResult.data;
      const now = new Date();
      
      // Learn Mode: srs_level=0, learning_state=null or 'learning' (not 'relearning')
      const learnEligibleCards = cardStates.filter(card => 
        card.srs_level !== null && card.srs_level !== undefined && card.srs_level === 0 && 
        (card.learning_state === null || card.learning_state === 'learning')
      );
      
      // Review Mode: (srs_level>=1) OR (srs_level=0 and learning_state='relearning') AND is due
      const reviewEligibleCards = cardStates.filter(card => {
        // First check if card is graduated or in relearning
        const isGraduatedOrRelearning = 
          (card.srs_level !== null && card.srs_level !== undefined && card.srs_level >= 1) || 
          (card.srs_level === 0 && card.learning_state === 'relearning');
        
        // Then check if it's due
        const isDue = 
          card.next_review_due && 
          isValid(parseISO(card.next_review_due)) && 
          parseISO(card.next_review_due) <= now;
        
        return isGraduatedOrRelearning && isDue;
      });
      
      appLogger.info(`[StudyModeButtons] Learn eligible: ${learnEligibleCards.length}, Review eligible: ${reviewEligibleCards.length}`);
      
      setLearnCount(learnEligibleCards.length);
      setReviewCount(reviewEligibleCards.length);
    };
    
    fetchCardCounts();
  }, [
    contentId, 
    studyType, 
    preCalculatedLearnCount, 
    preCalculatedReviewCount, 
    batchFetchInProgress,
    resolveStudyQuery,
    getCardSrsStatesByIds,
    setIsLoading,
    setError,
    setLearnCount,
    setReviewCount
  ]);
  
  const handleStartStudying = (mode: StudyMode) => {
    // Create the appropriate StudyInput based on type and mode
    let studyInput: StudyInput;
    
    if (studyType === 'studySet') {
      // For study sets, we pass studySetId and appropriate criteria for filtering
      studyInput = {
        studySetId: contentId,
        criteria: mode === 'learn' ? 
          {
            includeLearning: true,
            srsLevel: { operator: 'equals', value: 0 },
            tagLogic: 'ANY' as const,
          } : 
          {
            nextReviewDue: { operator: 'isDue' },
            srsLevel: { operator: 'greaterThan', value: 0 },
            tagLogic: 'ANY' as const,
          }
      };
    } else {
      // For decks, use the existing approach
      studyInput = {
        criteria: { 
          deckId: contentId, 
          tagLogic: 'ANY' as const, 
          // Include special criteria for Learn mode
          ...(mode === 'learn' ? {
            srsLevel: { operator: 'equals', value: 0 },
            includeLearning: true
          } : {}),
          // Include special criteria for Review mode
          ...(mode === 'review' ? {
            nextReviewDue: { operator: 'isDue' },
            srsLevel: { operator: 'greaterThan', value: 0 }
          } : {})
        } 
      };
    }
    
    appLogger.info(`[StudyModeButtons] Starting ${mode} mode with input:`, studyInput);
      
    // Verify counts for the selected mode
    if (mode === 'learn' && learnCount === 0) {
      toast.error("No cards available for learning in this selection.");
      return;
    }
    
    if (mode === 'review' && reviewCount === 0) {
      toast.error("No cards due for review in this selection.");
      return;
    }
    
    // Clear previous params BEFORE setting new ones
    clearStudyParameters();
    
    // Set parameters and navigate
    setStudyParameters(studyInput, mode);
    router.push('/study/session');
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {isLoading ? (
        <div className="flex items-center text-muted-foreground text-sm">
          <IconLoader className="w-3 h-3 mr-2 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          <Button
            variant="secondary"
            size={size}
            className="bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => handleStartStudying('learn')}
            disabled={learnCount === 0}
          >
            <GraduationCap className="h-4 w-4 mr-1" /> {learnLabel} {learnCount > 0 && `(${learnCount})`}
          </Button>
          
          <Button
            variant="secondary"
            size={size}
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={() => handleStartStudying('review')}
            disabled={reviewCount === 0}
          >
            <Play className="h-4 w-4 mr-1" /> {reviewLabel} {reviewCount > 0 && `(${reviewCount})`}
          </Button>
        </>
      )}
    </div>
  );
} 