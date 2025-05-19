// components/StudySetSelector.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudySets } from '@/hooks/useStudySets';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema'; 
import type { Database, Tables } from "@/types/database"; 
import type { StudyInput, StudyMode } from "@/store/studySessionStore";
import { toast } from 'sonner';
import { Loader2 as IconLoader } from 'lucide-react';
import { appLogger } from '@/lib/logger';

type DbDeck = Pick<Tables<'decks'>, 'id' | 'name'>;
type DbStudySet = Pick<Tables<'study_sets'>, 'id' | 'name'>;

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
  const [selectionType, setSelectionType] = useState<SelectionType>('all');
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(undefined); 
  const [selectedStudySetId, setSelectedStudySetId] = useState<string | undefined>(undefined); 
  const [selectedMode, setSelectedMode] = useState<StudyMode>('learn');
  
  // New state for card counts
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(false);
  const [learnCount, setLearnCount] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [countError, setCountError] = useState<string | null>(null);

  // Generate the current selection criteria
  const getCurrentCriteria = (): StudyInput | null => {
    if (selectionType === 'all') {
      return { criteria: { 
        allCards: true,
        tagLogic: 'ANY',
      } };
    } else if (selectionType === 'deck') {
      if (!selectedDeckId) return null;
      return { criteria: { 
        deckId: selectedDeckId,
        tagLogic: 'ANY',
      } };
    } else if (selectionType === 'studySet') {
      if (!selectedStudySetId) return null;
      return { studySetId: selectedStudySetId };
    } 
    return null;
  };

  // Fetch card counts whenever the selection changes
  useEffect(() => {
    const fetchCardCounts = async () => {
      const currentInput = getCurrentCriteria();
      if (!currentInput) {
        setLearnCount(0);
        setReviewCount(0);
        return;
      }

      setIsLoadingCounts(true);
      setCountError(null);
      
      try {
        // Query for learning-eligible cards
        const learnResult = 'criteria' in currentInput 
          ? await resolveStudyQuery({ 
              criteria: { 
                ...currentInput.criteria, 
                includeLearning: true 
              } 
            })
          : await resolveStudyQuery(currentInput); // For studySetId

        // Query for review-eligible cards
        const reviewResult = 'criteria' in currentInput 
          ? await resolveStudyQuery({ 
              criteria: { 
                ...currentInput.criteria, 
                nextReviewDue: { operator: 'isDue' } 
              } 
            })
          : await resolveStudyQuery(currentInput); // For studySetId

        if (learnResult.error) {
          appLogger.error("Error fetching learn count:", learnResult.error);
          setCountError("Failed to check available cards");
        }
        
        if (reviewResult.error) {
          appLogger.error("Error fetching review count:", reviewResult.error);
          setCountError("Failed to check available cards");
        }

        // Set counts
        const learnCardIds = learnResult.data || [];
        const reviewCardIds = reviewResult.data || [];
        
        // For the review count, we only count cards with a next_review_due
        // This would ideally be filtered by the DB function, but for now we'll assume all returned cards are valid
        setLearnCount(learnCardIds.length);
        setReviewCount(reviewCardIds.length);
        
      } catch (error) {
        appLogger.error("Error fetching card counts:", error);
        setCountError("Error checking available cards");
        setLearnCount(0);
        setReviewCount(0);
      } finally {
        setIsLoadingCounts(false);
      }
    };

    fetchCardCounts();
  }, [selectionType, selectedDeckId, selectedStudySetId]);

  const handleInitiateStudy = () => {
    const actionInput = getCurrentCriteria();
    
    if (!actionInput) {
      toast.error("Please select a valid study option.");
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
    
    onStartStudying(actionInput, selectedMode);
  };

  const isStartDisabled = 
    (selectionType === 'deck' && !selectedDeckId) || 
    (selectionType === 'studySet' && !selectedStudySetId) ||
    (selectedMode === 'learn' && learnCount === 0) ||
    (selectedMode === 'review' && reviewCount === 0);

  return (
    <div className="space-y-6 p-4 border rounded-md">
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

      {countError && (
        <div className="text-destructive text-sm">
          {countError}
        </div>
      )}

      {isLoadingCounts && (
        <div className="flex items-center text-muted-foreground text-sm">
          <IconLoader className="w-3 h-3 mr-2 animate-spin" />
          Checking available cards...
        </div>
      )}

      <hr />

      <div className="space-y-2">
        <Label>Choose Study Mode</Label>
        <RadioGroup
          value={selectedMode}
          onValueChange={(value) => setSelectedMode(value as StudyMode)}
          className="flex space-x-4"
        >
           <div className="flex items-center space-x-2">
            <RadioGroupItem value="learn" id="m-learn" disabled={learnCount === 0} />
            <Label 
              htmlFor="m-learn" 
              className={learnCount === 0 ? "text-muted-foreground" : ""}
            >
              Learn {learnCount > 0 && `(${learnCount})`}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="review" id="m-review" disabled={reviewCount === 0} />
            <Label 
              htmlFor="m-review" 
              className={reviewCount === 0 ? "text-muted-foreground" : ""}
            >
              Review (SRS) {reviewCount > 0 && `(${reviewCount})`}
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

      <Button
        onClick={handleInitiateStudy}
        disabled={isStartDisabled} 
        className="w-full sm:w-auto"
      >
        Start Studying 
      </Button>
    </div>
  );
}