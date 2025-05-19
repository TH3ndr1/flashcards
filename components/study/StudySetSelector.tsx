'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardSrsStatesByIds } from '@/lib/actions/cardActions';
import { useStudySessionStore, type StudyInput, type StudyMode } from '@/store/studySessionStore';
import { isValid, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 as IconLoader, GraduationCap, Play } from 'lucide-react';
import type { Database, Tables } from "@/types/database";
import type { StudyQueryCriteria } from "@/lib/schema/study-query.schema";
import { appLogger, statusLogger } from '@/lib/logger';

// Type definitions
type DbDeck = Pick<Tables<'decks'>, 'id' | 'name'>;
type DbStudySet = Pick<Tables<'study_sets'>, 'id' | 'name'>;
type SrsCardState = Pick<Tables<'cards'>, 
  'id' | 'srs_level' | 'learning_state' | 'next_review_due' | 'learning_step_index' | 
  'failed_attempts_in_learn' | 'hard_attempts_in_learn'
>;

interface StudySetSelectorProps {
  decks: DbDeck[];
  studySets?: DbStudySet[];
  isLoadingStudySets?: boolean;
  onStartStudying: (actionInput: StudyInput, mode: StudyMode) => void;
}

type SelectionType = 'all' | 'deck' | 'studySet'; 

export function StudySetSelector({
  decks = [], 
  studySets = [],
  isLoadingStudySets = false,
  onStartStudying
}: StudySetSelectorProps) {
  const router = useRouter();
  
  // Selection state
  const [selectionType, setSelectionType] = useState<SelectionType>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(undefined); 
  const [selectedStudySetId, setSelectedStudySetId] = useState<string | undefined>(undefined); 
  const [selectedMode, setSelectedMode] = useState<StudyMode>('learn');
  
  // Card count state
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(false);
  const [learnCount, setLearnCount] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [countError, setCountError] = useState<string | null>(null);

  // Get the current criteria based on user selection
  const getCurrentCriteria = useCallback((): StudyQueryCriteria | null => {
    if (selectionType === 'all') {
      return { 
        allCards: true,
        tagLogic: 'ANY',
      };
    } else if (selectionType === 'deck' && selectedDeckId) {
      return { 
        deckId: selectedDeckId,
        tagLogic: 'ANY',
      };
    } else if (selectionType === 'studySet' && selectedStudySetId) {
      // For study sets, we'll get the criteria from the backend
      return null; // Will use studySetId directly
    }
    return null;
  }, [selectionType, selectedDeckId, selectedStudySetId]);

  // Function to fetch card counts
  const fetchCardCounts = useCallback(async () => {
    const criteria = getCurrentCriteria();
    
    // Early return if no valid criteria (except for studySet which uses ID directly)
    if (!criteria && selectionType !== 'studySet') {
      setLearnCount(0);
      setReviewCount(0);
      return;
    }
    
    // Early return if study set is selected but no ID
    if (selectionType === 'studySet' && !selectedStudySetId) {
      setLearnCount(0);
      setReviewCount(0);
      return;
    }
    
    setIsLoadingCounts(true);
    setCountError(null);
    
    try {
      // Step 1: Get all card IDs matching the base criteria
      let cardIdsResult;
      
      if (selectionType === 'studySet') {
        cardIdsResult = await resolveStudyQuery({ studySetId: selectedStudySetId! });
      } else {
        cardIdsResult = await resolveStudyQuery({ criteria: criteria! });
      }
      
      if (cardIdsResult.error || !cardIdsResult.data) {
        appLogger.error("Error fetching card IDs:", cardIdsResult.error);
        setCountError("Failed to check available cards");
        setLearnCount(0);
        setReviewCount(0);
        setIsLoadingCounts(false);
        return;
      }
      
      const cardIds = cardIdsResult.data;
      appLogger.info(`[StudySetSelector] Found ${cardIds.length} total cards matching criteria`);
      
      if (cardIds.length === 0) {
        setLearnCount(0);
        setReviewCount(0);
        setIsLoadingCounts(false);
        return;
      }
      
      // Step 2: Get only the SRS state fields for the matched cards
      const srsStatesResult = await getCardSrsStatesByIds(cardIds);
      
      if (srsStatesResult.error || !srsStatesResult.data) {
        appLogger.error("Error fetching card SRS states:", srsStatesResult.error);
        setCountError("Failed to check card states");
        setLearnCount(0);
        setReviewCount(0);
        setIsLoadingCounts(false);
        return;
      }
      
      const cardStates = srsStatesResult.data;
      
      // Step 3: Count cards for each mode based on SRS state
      // Learn Mode: srs_level=0, learning_state=null or 'learning' (not 'relearning')
      const learnEligibleCards = cardStates.filter(card => 
        card.srs_level !== null && card.srs_level !== undefined && card.srs_level === 0 && 
        (card.learning_state === null || card.learning_state === 'learning')
      );
      
      // Review Mode: (srs_level>=1) OR (srs_level=0 and learning_state='relearning') AND is due
      const now = new Date();
      const reviewEligibleCards = cardStates.filter(card => {
        // First check if card is graduated (srs_level >= 1) or in relearning
        const isGraduatedOrRelearning = 
          (card.srs_level !== null && card.srs_level !== undefined && card.srs_level >= 1) || 
          (card.srs_level === 0 && card.learning_state === 'relearning');
          
        // Then check if it's due (next_review_due <= now)
        const isDue = 
          card.next_review_due && 
          isValid(parseISO(card.next_review_due)) && 
          parseISO(card.next_review_due) <= now;
          
        return isGraduatedOrRelearning && isDue;
      });
      
      appLogger.info(`[StudySetSelector] Learn-eligible: ${learnEligibleCards.length}, Review-eligible: ${reviewEligibleCards.length}`);
      
      // Update state
      setLearnCount(learnEligibleCards.length);
      setReviewCount(reviewEligibleCards.length);
      
    } catch (error) {
      appLogger.error("Error in fetchCardCounts:", error);
      setCountError("Error checking available cards");
      setLearnCount(0);
      setReviewCount(0);
    } finally {
      setIsLoadingCounts(false);
    }
  }, [getCurrentCriteria, selectionType, selectedDeckId, selectedStudySetId]);

  // Fetch counts whenever selection changes
  useEffect(() => {
    fetchCardCounts();
  }, [selectionType, selectedDeckId, selectedStudySetId, fetchCardCounts]);

  // Start studying with the selected mode
  const handleStartStudying = () => {
    const criteria = getCurrentCriteria();
    
    // Create a study input appropriate for the selection
    let studyInput: StudyInput;
    
    if (selectionType === 'studySet' && selectedStudySetId) {
      studyInput = { studySetId: selectedStudySetId };
    } else if (criteria) {
      studyInput = { criteria };
    } else {
      toast.error("Please make a valid selection");
      return;
    }
    
    // Verify counts for the selected mode
    if (selectedMode === 'learn' && learnCount === 0) {
      toast.error("No cards available for learning in this selection.");
      return;
    }
    
    if (selectedMode === 'review' && reviewCount === 0) {
      toast.error("No cards due for review in this selection.");
      return;
    }
    
    // Start studying with the chosen input and mode
    onStartStudying(studyInput, selectedMode);
  };

  // Determine if the start button should be disabled
  const isStartDisabled = 
    (selectionType === 'deck' && !selectedDeckId) || 
    (selectionType === 'studySet' && !selectedStudySetId) ||
    (selectedMode === 'learn' && learnCount === 0) ||
    (selectedMode === 'review' && reviewCount === 0) ||
    isLoadingCounts;

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-background/60">
      <h3 className="text-lg font-medium">Select Cards to Study</h3>

      <RadioGroup
        value={selectionType}
        onValueChange={(value) => {
          const newType = value as SelectionType;
          setSelectionType(newType);
          setSelectedDeckId(undefined);
          setSelectedStudySetId(undefined); 
        }}
        className="flex flex-wrap gap-4"
      >
         <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="r-all" />
          <Label htmlFor="r-all">All My Cards</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="deck" id="r-deck" />
          <Label htmlFor="r-deck">From a Deck</Label>
        </div>
         <div className="flex items-center space-x-2">
          <RadioGroupItem value="studySet" id="r-studySet" disabled={isLoadingStudySets} />
          <Label htmlFor="r-studySet" className={isLoadingStudySets ? "text-muted-foreground" : ""}>
            Smart Playlist {isLoadingStudySets ? "(Loading...)" : ""}
          </Label>
        </div>
      </RadioGroup>

      {selectionType === 'deck' && (
         <div className="space-y-2 mt-4"> 
          <Label htmlFor="deck-select">Choose deck</Label>
          <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
            <SelectTrigger id="deck-select" className="w-full sm:w-[280px]"><SelectValue placeholder="Select a deck..." /></SelectTrigger>
            <SelectContent>
              {decks.length > 0 ? (
                decks.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id}>{deck.name as string}</SelectItem>
                ))
              ) : (
                <SelectItem value="no-decks" disabled>No decks available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      
       {selectionType === 'studySet' && (
         <div className="space-y-2 mt-4"> 
          <Label htmlFor="study-set-select">Choose playlist</Label>
          <Select
            value={selectedStudySetId}
            onValueChange={setSelectedStudySetId}
            disabled={isLoadingStudySets}
          >
            <SelectTrigger id="study-set-select" className="w-full sm:w-[280px]">
              <SelectValue placeholder="Select a smart playlist..." />
            </SelectTrigger>
            <SelectContent>
              {isLoadingStudySets ? (
                  <SelectItem value="loading" disabled>Loading playlists...</SelectItem>
              ) : studySets.length > 0 ? (
                studySets.map((set) => (
                  <SelectItem key={set.id} value={set.id}>
                    {set.name as string}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-sets" disabled>No smart playlists saved</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Error display */}
      {countError && (
        <div className="text-destructive text-sm">
          {countError}
        </div>
      )}

      {/* Loading indicator */}
      {isLoadingCounts && (
        <div className="flex items-center text-muted-foreground text-sm">
          <IconLoader className="w-3 h-3 mr-2 animate-spin" />
          Checking available cards...
        </div>
      )}

      <hr />

      <div className="space-y-4">
        <Label>Choose Study Mode</Label>
        <RadioGroup
          value={selectedMode}
          onValueChange={(value) => setSelectedMode(value as StudyMode)}
          className="flex space-x-6"
        >
           <div className="flex items-center space-x-2">
            <RadioGroupItem value="learn" id="m-learn" disabled={learnCount === 0 || isLoadingCounts} />
            <Label 
              htmlFor="m-learn" 
              className={learnCount === 0 || isLoadingCounts ? "text-muted-foreground" : ""}
            >
              Learn {!isLoadingCounts && learnCount > 0 && `(${learnCount})`}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="review" id="m-review" disabled={reviewCount === 0 || isLoadingCounts} />
            <Label 
              htmlFor="m-review" 
              className={reviewCount === 0 || isLoadingCounts ? "text-muted-foreground" : ""}
            >
              Review (SRS) {!isLoadingCounts && reviewCount > 0 && `(${reviewCount})`}
            </Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          {selectedMode === 'learn'
            ? "Reviews all selected cards, repeating until learned in this session."
            : "Reviews only cards that are due based on Spaced Repetition."
          }
        </p>
      </div>

      <div className="flex justify-center pt-2">
        <Button
          onClick={handleStartStudying}
          disabled={isStartDisabled} 
          className="w-full sm:w-auto"
          size="lg"
        >
          {isLoadingCounts ? (
            <>
              <IconLoader className="mr-2 h-4 w-4 animate-spin" /> 
              Checking cards...
            </>
          ) : selectedMode === 'learn' ? (
            <>
              <GraduationCap className="mr-2 h-5 w-5" /> 
              Start Learning {learnCount > 0 && `(${learnCount})`}
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" /> 
              Start Reviewing {reviewCount > 0 && `(${reviewCount})`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 