// components/study/StudySetSelector.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardSrsStatesByIds } from '@/lib/actions/cardActions';
import type { StudySessionInput, SessionType } from '@/types/study';
import { isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Loader2 as IconLoader, GraduationCap, Play } from 'lucide-react';
import type { Tables } from "@/types/database";
import type { StudyQueryCriteria } from "@/lib/schema/study-query.schema";
import { appLogger } from '@/lib/logger';


type DbDeck = Pick<Tables<'decks'>, 'id' | 'name'>;
type DbStudySet = Pick<Tables<'study_sets'>, 'id' | 'name'>;

interface StudySetSelectorProps {
  decks: DbDeck[];
  studySets?: DbStudySet[];
  isLoadingStudySets?: boolean;
  onStartStudying: (input: StudySessionInput, sessionType: SessionType) => void;
}

type SelectionSourceType = 'all' | 'deck' | 'studySet';

export function StudySetSelector({
  decks = [],
  studySets = [],
  isLoadingStudySets = false,
  onStartStudying
}: StudySetSelectorProps) {
  const [selectionSource, setSelectionSource] = useState<SelectionSourceType>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(undefined);
  const [selectedStudySetId, setSelectedStudySetId] = useState<string | undefined>(undefined);
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType>('learn-only');

  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(false);
  const [learnCount, setLearnCount] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [countError, setCountError] = useState<string | null>(null);

  const getCurrentStudyInput = useCallback((): StudySessionInput | null => {
    if (selectionSource === 'all') {
      const criteriaForAll: StudyQueryCriteria = { allCards: true, tagLogic: 'ANY' };
      return { criteria: criteriaForAll };
    } else if (selectionSource === 'deck' && selectedDeckId) {
      const criteriaForDeck: StudyQueryCriteria = { deckId: selectedDeckId, tagLogic: 'ANY' };
      return { criteria: criteriaForDeck };
    } else if (selectionSource === 'studySet' && selectedStudySetId) {
      return { studySetId: selectedStudySetId };
    }
    return null;
  }, [selectionSource, selectedDeckId, selectedStudySetId]);

  useEffect(() => {
    const fetchCardCounts = async () => {
        const currentStudySessionInput = getCurrentStudyInput();
        if (!currentStudySessionInput) {
            setLearnCount(0); setReviewCount(0); setIsLoadingCounts(false); return;
        }
        setIsLoadingCounts(true); setCountError(null);
        try {
            let queryPayloadForAction: Parameters<typeof resolveStudyQuery>[0];
            if (currentStudySessionInput.studySetId) {
                queryPayloadForAction = { studySetId: currentStudySessionInput.studySetId };
            } else if (currentStudySessionInput.criteria) {
                queryPayloadForAction = { criteria: currentStudySessionInput.criteria };
            } else {
                throw new Error("Invalid input for fetching card counts from StudySetSelector.");
            }

            const cardIdsResult = await resolveStudyQuery(queryPayloadForAction);
            if (cardIdsResult.error || !cardIdsResult.data) {
                throw new Error(cardIdsResult.error || "Failed to fetch card IDs for counts");
            }
            const cardIds = cardIdsResult.data;
            if (cardIds.length === 0) {
                setLearnCount(0); setReviewCount(0); setIsLoadingCounts(false); return;
            }
            const srsStatesResult = await getCardSrsStatesByIds(cardIds);
            if (srsStatesResult.error || !srsStatesResult.data) {
                throw new Error(srsStatesResult.error || "Failed to fetch SRS states for counts");
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
            appLogger.info(`[StudySetSelector] Counts for ${selectionSource} (${selectedDeckId || selectedStudySetId || 'all'}): Learn=${learnEligibleCards.length}, Review=${reviewEligibleCards.length}`);
            setLearnCount(learnEligibleCards.length);
            setReviewCount(reviewEligibleCards.length);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error checking available cards";
            appLogger.error("[StudySetSelector] Error in fetchCardCounts:", message);
            setCountError(message);
            setLearnCount(0); setReviewCount(0);
        } finally {
            setIsLoadingCounts(false);
        }
    };
    fetchCardCounts();
}, [selectionSource, selectedDeckId, selectedStudySetId, getCurrentStudyInput]);


  const handleInitiateStudy = () => {
    const currentInput = getCurrentStudyInput();
    if (!currentInput) {
      toast.error("Please select a valid study option.");
      return;
    }

    if (selectedSessionType === 'learn-only' && learnCount === 0) {
      toast.info("No new cards available to learn in this selection.");
      return;
    }
    if (selectedSessionType === 'review-only' && reviewCount === 0) {
      toast.info("No cards currently due for review in this selection.");
      return;
    }
    // For 'unified', this component doesn't offer it, but if it did:
    // if (selectedSessionType === 'unified' && learnCount === 0 && reviewCount === 0) {
    //     toast.info("No cards available to practice in this selection.");
    //     return;
    // }

    onStartStudying(currentInput, selectedSessionType);
  };

  const isStartButtonDisabled =
    (selectionSource === 'deck' && !selectedDeckId) ||
    (selectionSource === 'studySet' && !selectedStudySetId) ||
    (selectedSessionType === 'learn-only' && learnCount === 0 && !isLoadingCounts) ||
    (selectedSessionType === 'review-only' && reviewCount === 0 && !isLoadingCounts) ||
    isLoadingCounts;

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-background/60 dark:bg-slate-800/30">
      <h3 className="text-lg font-medium">Select Cards to Study</h3>
      <RadioGroup
        value={selectionSource}
        onValueChange={(value) => {
          setSelectionSource(value as SelectionSourceType);
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

      {selectionSource === 'deck' && (
         <div className="space-y-2 mt-4">
          <Label htmlFor="deck-select">Choose deck</Label>
          <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
            <SelectTrigger id="deck-select" className="w-full sm:w-[280px]"><SelectValue placeholder="Select a deck..." /></SelectTrigger>
            <SelectContent>
              {decks.length > 0 ? (
                decks.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>
                ))
              ) : (
                <SelectItem value="no-decks" disabled>No decks available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      {selectionSource === 'studySet' && (
         <div className="space-y-2 mt-4">
          <Label htmlFor="study-set-select">Choose playlist</Label>
          <Select value={selectedStudySetId} onValueChange={setSelectedStudySetId} disabled={isLoadingStudySets}>
            <SelectTrigger id="study-set-select" className="w-full sm:w-[280px]"><SelectValue placeholder="Select a smart playlist..." /></SelectTrigger>
            <SelectContent>
              {isLoadingStudySets ? ( <SelectItem value="loading" disabled>Loading playlists...</SelectItem>
              ) : studySets.length > 0 ? (
                studySets.map((set) => ( <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem> ))
              ) : ( <SelectItem value="no-sets" disabled>No smart playlists saved</SelectItem> )}
            </SelectContent>
          </Select>
        </div>
      )}

      {countError && (<div className="text-destructive text-sm mt-2">{countError}</div>)}
      {isLoadingCounts && (
        <div className="flex items-center text-muted-foreground text-sm mt-2">
          <IconLoader className="w-4 h-4 mr-2 animate-spin" /> Checking available cards...
        </div>
      )}
      <hr className="my-4"/>
      <div className="space-y-4">
        <Label className="text-base font-medium">Choose Study Type</Label>
        <RadioGroup
          value={selectedSessionType}
          onValueChange={(value) => setSelectedSessionType(value as SessionType)}
          className="flex flex-col sm:flex-row gap-4 sm:gap-6"
        >
           <div className="flex items-center space-x-2">
            <RadioGroupItem value="learn-only" id="st-learn" disabled={(learnCount === 0 && !isLoadingCounts)} />
            <Label htmlFor="st-learn" className={(!isLoadingCounts && learnCount === 0) ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer"}>
              Learn New {(!isLoadingCounts && learnCount > 0) && `(${learnCount})`}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="review-only" id="st-review" disabled={(reviewCount === 0 && !isLoadingCounts)} />
            <Label htmlFor="st-review" className={(!isLoadingCounts && reviewCount === 0) ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer"}>
              Review Due (SRS) {(!isLoadingCounts && reviewCount > 0) && `(${reviewCount})`}
            </Label>
          </div>
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          {selectedSessionType === 'learn-only'
            ? "Focus on new cards or cards still in early learning steps."
            : "Review cards that are due based on Spaced Repetition."
          }
        </p>
      </div>
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleInitiateStudy}
          disabled={isStartButtonDisabled}
          className="w-full sm:w-auto"
          size="lg"
        >
          {isLoadingCounts ? <><IconLoader className="mr-2 h-4 w-4 animate-spin" />Checking Cards...</> :
           selectedSessionType === 'learn-only' ? <><GraduationCap className="mr-2 h-5 w-5" /> Start Learning {learnCount > 0 && `(${learnCount})`}</> :
           <><Play className="mr-2 h-5 w-5" /> Start Reviewing {reviewCount > 0 && `(${reviewCount})`}</>
          }
        </Button>
      </div>
    </div>
  );
}