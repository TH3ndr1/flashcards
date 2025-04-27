// components/StudySetSelector.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStudySets } from '@/hooks/useStudySets';
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema'; 
import type { Database, Tables } from "@/types/database"; 
import type { StudyInput, StudyMode } from "@/store/studySessionStore";
import { toast } from 'sonner';
import { Loader2 as IconLoader } from 'lucide-react';

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

  const handleInitiateStudy = () => {
    let actionInput: StudyInput | null = null;

    if (selectionType === 'all') {
      actionInput = { criteria: { allCards: true } };
    } else if (selectionType === 'deck') {
      if (!selectedDeckId) {
        toast.error("Please select a deck.");
        return;
      }
      actionInput = { criteria: { deckId: selectedDeckId } };
    } else if (selectionType === 'studySet') {
       if (!selectedStudySetId) {
        toast.error("Please select a smart playlist.");
        return;
      }
      actionInput = { studySetId: selectedStudySetId };
    } else {
      toast.error("Selection type not yet implemented.");
      return; 
    }
    
    if (actionInput) {
        onStartStudying(actionInput, selectedMode);
    }
  };

  const isStartDisabled = 
    (selectionType === 'deck' && !selectedDeckId) || 
    (selectionType === 'studySet' && !selectedStudySetId);

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

      <hr />

      <div className="space-y-2">
        <Label>Choose Study Mode</Label>
        <RadioGroup
          value={selectedMode}
          onValueChange={(value) => setSelectedMode(value as StudyMode)}
          className="flex space-x-4"
        >
           <div className="flex items-center space-x-2">
            <RadioGroupItem value="learn" id="m-learn" />
            <Label htmlFor="m-learn">Learn</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="review" id="m-review" />
            <Label htmlFor="m-review">Review (SRS)</Label>
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