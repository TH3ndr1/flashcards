// components/study/StudySetSelector.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StudySessionInput, SessionType } from '@/types/study';
import { toast } from 'sonner';
import { Loader2 as IconLoader, GraduationCap, Play, Info } from 'lucide-react';
import type { Tables } from "@/types/database";
import type { StudyQueryCriteria } from "@/lib/schema/study-query.schema";
import { appLogger } from '@/lib/logger';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getLearnNewCardCountForSource, getReviewDueCardCountForSource, getStudySetCardCountByCriteria } from '@/lib/actions/studyQueryActions';
import type { ResolveStudyQueryInput } from '@/lib/actions/studyQueryActions';
import { getBaseCriteria } from '@/lib/actions/studyQueryActions';
import type { UserGlobalSrsSummary } from '@/lib/actions/studyQueryActions';


type DeckWithTotalCount = Pick<Tables<'decks'>, 'id' | 'name'> & {
  totalCardCount: number;
};
type StudySetWithTotalCount = Pick<Tables<'study_sets'>, 'id' | 'name'> & {
  totalCardCount: number;
};


interface StudySetSelectorProps {
  decks: DeckWithTotalCount[];
  studySets?: StudySetWithTotalCount[];
  globalSrsSummary: UserGlobalSrsSummary;
  isLoadingStudySets?: boolean;
  onStartStudying: (input: StudySessionInput, sessionType: SessionType) => void;
}

type SelectionSourceType = 'all' | 'deck' | 'studySet';

// Define a specific type for the session types handled by this component's dropdown
type StudySelectorSessionType = 'unified' | 'learn' | 'review';

export function StudySetSelector({
  decks = [],
  studySets = [],
  globalSrsSummary,
  isLoadingStudySets = false,
  onStartStudying
}: StudySetSelectorProps) {
  const [selectionSource, setSelectionSource] = useState<SelectionSourceType>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(undefined);
  const [selectedStudySetId, setSelectedStudySetId] = useState<string | undefined>(undefined);
  const [selectedSessionType, setSelectedSessionType] = useState<StudySelectorSessionType>('unified');

  const [selectedSourceTotalCount, setSelectedSourceTotalCount] = useState<number | null>(null);
  const [learnNewCount, setLearnNewCount] = useState<number | null>(null);
  const [reviewDueCount, setReviewDueCount] = useState<number | null>(null);
  const [unifiedCount, setUnifiedCount] = useState<number | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  // Effect to update selectedSourceTotalCount when the source or specific ID changes
  useEffect(() => {
    if (selectionSource === 'all') {
      setSelectedSourceTotalCount(globalSrsSummary.total_cards);
    } else if (selectionSource === 'deck' && selectedDeckId) {
      const selectedDeck = decks.find(d => d.id === selectedDeckId);
      setSelectedSourceTotalCount(selectedDeck?.totalCardCount ?? 0);
    } else if (selectionSource === 'studySet' && selectedStudySetId) {
      const selectedSet = studySets.find(s => s.id === selectedStudySetId);
      setSelectedSourceTotalCount(selectedSet?.totalCardCount ?? 0);
    } else {
      setSelectedSourceTotalCount(0); // Default or if no selection
    }
  }, [selectionSource, selectedDeckId, selectedStudySetId, globalSrsSummary, decks, studySets]);

  const getCurrentStudyInput = useCallback((): StudySessionInput | null => {
    if (selectionSource === 'all') {
      const criteriaForAll: StudyQueryCriteria = { allCards: true, tagLogic: 'ANY' };
      return { criteria: criteriaForAll };
    } else if (selectionSource === 'deck' && selectedDeckId) {
      const criteriaForDeck: StudyQueryCriteria = { deckIds: [selectedDeckId], tagLogic: 'ANY' };
      return { criteria: criteriaForDeck };
    } else if (selectionSource === 'studySet' && selectedStudySetId) {
      return { studySetId: selectedStudySetId };
    }
    return null;
  }, [selectionSource, selectedDeckId, selectedStudySetId]);

  useEffect(() => {
    const fetchSpecificCounts = async () => {
      setIsLoadingCounts(true);
      setLearnNewCount(null);
      setReviewDueCount(null);
      setUnifiedCount(null);

      if (selectionSource === 'all') {
        setLearnNewCount(globalSrsSummary.new_cards);
        setReviewDueCount(globalSrsSummary.due_cards);
        setUnifiedCount(globalSrsSummary.new_review_cards);
        setIsLoadingCounts(false);
        return;
      }

      const baseInputForCounts = getCurrentStudyInput();
      if (!baseInputForCounts) {
        appLogger.warn('[StudySetSelector] No base input for fetching counts.');
        setLearnNewCount(0);
        setReviewDueCount(0);
        setUnifiedCount(0);
        setIsLoadingCounts(false);
        return;
      }

      // Fetch counts using base criteria + specific srsFilter
      const fetchCountForFilter = async (filter: 'new' | 'due' | 'new_review') => {
        const baseCriteriaResult = await getBaseCriteria(baseInputForCounts as ResolveStudyQueryInput);
        if (baseCriteriaResult.error || !baseCriteriaResult.data) {
          appLogger.error(`[StudySetSelector] Error fetching base criteria for ${filter} count:`, baseCriteriaResult.error);
          return 0; // Default to 0 on error
        }
        const specificCriteria: StudyQueryCriteria = { ...baseCriteriaResult.data, srsFilter: filter };
        const countResult = await getStudySetCardCountByCriteria({ criteria: specificCriteria });
        if (countResult.error) {
          appLogger.error(`[StudySetSelector] Error fetching count for srsFilter ${filter}:`, countResult.error);
          toast.error(`Error fetching count for ${filter}.`);
          return 0;
        }
        return countResult.data ?? 0;
      };

      try {
        const newCount = await fetchCountForFilter('new');
        setLearnNewCount(newCount);

        const dueCount = await fetchCountForFilter('due');
        setReviewDueCount(dueCount);

        const newReviewCount = await fetchCountForFilter('new_review');
        setUnifiedCount(newReviewCount);

      } catch (e) {
        appLogger.error('[StudySetSelector] General exception during count fetching:', e);
        toast.error("Failed to load some card counts.");
        setLearnNewCount(0);
        setReviewDueCount(0);
        setUnifiedCount(0);
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchSpecificCounts();
  }, [selectionSource, selectedDeckId, selectedStudySetId, getCurrentStudyInput, globalSrsSummary]);

  const currentSelectionTotalCardCount = useMemo(() => {
    if (selectionSource === 'all') {
      return globalSrsSummary.total_cards;
    } else if (selectionSource === 'deck' && selectedDeckId) {
      const selectedDeck = decks.find(d => d.id === selectedDeckId);
      return selectedDeck?.totalCardCount ?? 0;
    } else if (selectionSource === 'studySet' && selectedStudySetId) {
      const selectedSet = studySets.find(s => s.id === selectedStudySetId);
      return selectedSet?.totalCardCount ?? 0;
    }
    return 0;
  }, [selectionSource, selectedDeckId, selectedStudySetId, globalSrsSummary, decks, studySets]);

  const handleInitiateStudy = () => {
    const currentInput = getCurrentStudyInput();
    if (!currentInput) {
      toast.error("Please select a valid study option.");
      return;
    }

    let actualSessionTypeForStore: SessionType;
    switch (selectedSessionType) {
      case 'unified':
        actualSessionTypeForStore = 'unified';
        break;
      case 'learn':
        actualSessionTypeForStore = 'learn-only'; // Map to the correct SessionType enum value
        break;
      case 'review':
        actualSessionTypeForStore = 'review-only'; // Map to the correct SessionType enum value
        break;
      default:
        // This case should ideally not be reached if selectedSessionType is correctly typed
        // and dropdown values are restricted.
        appLogger.error(`[StudySetSelector] Unexpected selectedSessionType: ${selectedSessionType}`);
        toast.error("Invalid session type selected.");
        return;
    }

    if (selectedSourceTotalCount === 0) {
      toast.info("No cards available to study in this selection.");
      return;
    }
    
    appLogger.info(`[StudySetSelector] Initiating ${actualSessionTypeForStore} session for ${selectionSource} (${selectedDeckId || selectedStudySetId || 'all'})`);
    onStartStudying(currentInput, actualSessionTypeForStore);
  };

  const isStartButtonDisabled =
    (selectionSource === 'deck' && !selectedDeckId) ||
    (selectionSource === 'studySet' && !selectedStudySetId) ||
    selectedSourceTotalCount === 0; // Use selectedSourceTotalCount for disabling start button

  const renderCountBadge = (count: number) => {
    return <Badge variant="secondary" className="ml-2">{count} card{count === 1 ? '' : 's'}</Badge>;
  };

  const studyOptions = useMemo(() => [
    {
      value: 'unified',
      label: "Unified Practice",
      description: "Interleaves new, due, and learning cards based on SRS.",
      icon: GraduationCap,
      count: unifiedCount,
      criteria: { srsFilter: 'new_review' }
    },
    {
      value: 'learn',
      label: "Learn New Cards",
      description: "Focus only on cards you haven't seen or started learning.",
      icon: Play,
      count: learnNewCount,
      criteria: { srsFilter: 'new' }
    },
    {
      value: 'review',
      label: "Review Due Cards",
      description: "Focus only on cards due for review (including relearning).",
      icon: Play,
      count: reviewDueCount,
      criteria: { srsFilter: 'due' }
    },
  ], [unifiedCount, learnNewCount, reviewDueCount]);

  return (
    <TooltipProvider>
    <div className="space-y-6 p-4 border rounded-lg bg-background/60 dark:bg-slate-800/30">
      <h3 className="text-lg font-medium">Select Cards to Study</h3>
      <RadioGroup
        value={selectionSource}
        onValueChange={(value) => {
          setSelectionSource(value as SelectionSourceType);
          setSelectedDeckId(undefined);
          setSelectedStudySetId(undefined);
        }}
        className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-3"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all" id="r-all" />
          <Label htmlFor="r-all" className="cursor-pointer flex items-center">
            All My Cards {selectionSource === 'all' && renderCountBadge(globalSrsSummary.total_cards)}
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="deck" id="r-deck" />
          <Label htmlFor="r-deck" className="cursor-pointer flex items-center">
            From a Deck
            {selectionSource === 'deck' && selectedDeckId && decks.find(d => d.id === selectedDeckId) && 
              renderCountBadge(decks.find(d => d.id === selectedDeckId)!.totalCardCount)
            }
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="studySet" id="r-studySet" disabled={isLoadingStudySets || studySets.length === 0} />
          <Label 
            htmlFor="r-studySet" 
            className={`cursor-pointer flex items-center ${(isLoadingStudySets || studySets.length === 0) ? "text-muted-foreground" : ""}`}
          >
            Smart Playlist 
            {isLoadingStudySets ? " (Loading...)" : studySets.length === 0 ? " (None)" : ""}
            {selectionSource === 'studySet' && selectedStudySetId && studySets.find(s => s.id === selectedStudySetId) &&
               renderCountBadge(studySets.find(s => s.id === selectedStudySetId)!.totalCardCount)
            }
          </Label>
        </div>
      </RadioGroup>

      {selectionSource === 'deck' && (
         <div className="space-y-2 mt-4">
          <Label htmlFor="deck-select">Choose deck</Label>
          <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
            <SelectTrigger id="deck-select" className="w-full sm:w-[320px]"><SelectValue placeholder="Select a deck..." /></SelectTrigger>
            <SelectContent>
              {decks.length > 0 ? (
                decks.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id}>{deck.name} ({deck.totalCardCount})</SelectItem>
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
          <Select value={selectedStudySetId} onValueChange={setSelectedStudySetId} disabled={isLoadingStudySets || studySets.length === 0}>
            <SelectTrigger id="study-set-select" className="w-full sm:w-[320px]"><SelectValue placeholder="Select a smart playlist..." /></SelectTrigger>
            <SelectContent>
              {isLoadingStudySets ? ( <SelectItem value="loading" disabled>Loading playlists...</SelectItem>
              ) : studySets.length > 0 ? (
                studySets.map((set) => ( <SelectItem key={set.id} value={set.id}>{set.name} ({set.totalCardCount})</SelectItem> ))
              ) : (
                <SelectItem value="no-sets" disabled>No smart playlists available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2 mt-6">
        <div className="flex items-center space-x-2">
          <Label htmlFor="session-type-select">Session type</Label>
            <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                    <Info size={16} className="text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                        <strong>Unified:</strong> Mixes new cards and reviews. (Recommended)
                    </p>
                    <p className="text-sm mt-1">
                        <strong>Learn-only:</strong> Focuses on cards you haven't seen or are still learning.
                    </p>
                    <p className="text-sm mt-1">
                        <strong>Review-only:</strong> Focuses on cards due for review.
                    </p>
                </TooltipContent>
            </Tooltip>
        </div>
        <Select value={selectedSessionType} onValueChange={(value) => setSelectedSessionType(value as StudySelectorSessionType)}>
            <SelectTrigger id="session-type-select" className="w-full sm:w-[320px]">
                <SelectValue placeholder="Select session type..." />
            </SelectTrigger>
            <SelectContent>
                {studyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <option.icon size={16} className="mr-2 text-primary" />
                      {option.label}
                      {option.count !== null && renderCountBadge(option.count)}
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
      
      <Button 
        onClick={handleInitiateStudy} 
        disabled={isStartButtonDisabled}
        className="w-full sm:w-auto mt-6"
        size="lg"
      >
        Start Studying ({
          (() => {
            let countToShow = 0;
            if (selectedSessionType === 'unified') {
              countToShow = unifiedCount ?? 0;
            } else if (selectedSessionType === 'learn') {
              countToShow = learnNewCount ?? 0;
            } else if (selectedSessionType === 'review') {
              countToShow = reviewDueCount ?? 0;
            } else {
              countToShow = selectedSourceTotalCount ?? 0; // Fallback for any other unhandled session type
            }
            return `${countToShow} card${countToShow === 1 ? '' : 's'}`;
          })()
        })
      </Button>
    </div>
    </TooltipProvider>
  );
}