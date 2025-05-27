// components/DeckListClient.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react"; // Added useMemo, useCallback
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Play, Loader2 } from "lucide-react"; // Added Loader2
import { useRouter } from "next/navigation";
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudySessionInput, SessionType } from '@/types/study';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeckProgressBar } from "@/components/deck/DeckProgressBar";
// Import useSettings and DEFAULT_SETTINGS
import { useSettings, DEFAULT_SETTINGS, Settings } from "@/providers/settings-provider";
import { Separator } from "@/components/ui/separator";
import { toast } from 'sonner';
import { useDecks as useDecksHook } from "@/hooks/use-decks"; // Renamed to avoid conflict if 'decks' is used as variable
import type { DeckListItemWithCounts } from "@/hooks/use-decks"; // Import this type
import { parseISO, format } from 'date-fns'; // For sorting by date
import { Badge } from "@/components/ui/badge";
import { ItemInfoBadges } from '@/components/ItemInfoBadges'; // Updated import path

// Type for TagInfo (if not already globally defined)
interface TagInfo {
  id: string;
  name: string;
}

// Extend DeckListItemWithCounts locally for this component to include processed fields
interface ProcessedDeck extends DeckListItemWithCounts {
  totalCards: number;
  tags: TagInfo[];
  languageDisplay: string;
}

// Props remain the same, initialData is passed from server component
interface DeckListClientProps {
  // initialData is no longer a prop, data comes from useDecks hook
}

export function DeckListClient({}: DeckListClientProps) { // Removed initialData from props
  const router = useRouter();
  const { 
    decks: rawDecksFromHook, // Renamed to avoid conflict
    loading: decksLoading, 
    error: decksError, 
    refetchDecks 
  } = useDecksHook();

  const { settings, loading: settingsLoading } = useSettings();
  const { setStudyParameters, clearStudyParameters } = useStudySessionStore(); // Corrected destructuring

  // Preferences from settings, with fallbacks to defaults
  const groupingMode = settings?.deckListGroupingMode || DEFAULT_SETTINGS.deckListGroupingMode;
  const activeTagGroupId = settings?.deckListActiveTagGroupId || DEFAULT_SETTINGS.deckListActiveTagGroupId;
  const sortField = settings?.deckListSortField || DEFAULT_SETTINGS.deckListSortField;
  const sortDirection = settings?.deckListSortDirection || DEFAULT_SETTINGS.deckListSortDirection;
  const showDeckProgressBars = settings?.showDeckProgress ?? DEFAULT_SETTINGS.showDeckProgress; // Use setting for progress bar

  const isOverallLoading = decksLoading || settingsLoading;

  const legendStages = [ /* ... as before ... */
    { name: 'New', startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning', startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Relearning', startColor: '#F59E0B', endColor: '#F97316' },
    { name: 'Young', startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature', startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  // Memoized and processed decks (this will be expanded in Task X.3.3 for grouping)
  const processedAndSortedDecks = useMemo(() => {
    if (!rawDecksFromHook) return [];

    let decksToProcess: ProcessedDeck[] = rawDecksFromHook.map(deck => {
      const totalCards = (deck.new_count ?? 0) +
                         (deck.learning_count ?? 0) +
                         (deck.relearning_count ?? 0) +
                         (deck.young_count ?? 0) +
                         (deck.mature_count ?? 0);
      
      let tags: TagInfo[] = [];
      if (deck.deck_tags_json && Array.isArray(deck.deck_tags_json)) {
         try {
            tags = (deck.deck_tags_json as any[]).filter(tag => tag && typeof tag.name === 'string') as TagInfo[];
         } catch (e) { console.error("Error parsing tags for deck " + deck.id, e); }
      }

      const languageDisplay = deck.is_bilingual
        ? `${deck.primary_language || 'N/A'} / ${deck.secondary_language || 'N/A'}`
        : deck.primary_language || 'N/A';
      return { ...deck, totalCards, tags, languageDisplay };
    });

    // --- Filtering based on 'tag_id' groupingMode (from settings) ---
    if (groupingMode === 'tag_id' && activeTagGroupId) {
      decksToProcess = decksToProcess.filter(deck => 
        deck.tags?.some(tag => tag.id === activeTagGroupId)
      );
    }

    // --- Sorting logic ---
    decksToProcess.sort((a, b) => {
      let valA, valB;
      if (sortField === 'created_at') {
        // Use updated_at if created_at is not directly available or if it makes more sense for "Last Modified"
        valA = a.updated_at ? parseISO(a.updated_at).getTime() : (a.created_at ? parseISO(a.created_at).getTime() : 0);
        valB = b.updated_at ? parseISO(b.updated_at).getTime() : (b.created_at ? parseISO(b.created_at).getTime() : 0);
      } else { // 'name'
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return decksToProcess;

  }, [rawDecksFromHook, groupingMode, activeTagGroupId, sortField, sortDirection]);


  // The actual rendering of groups (Accordion, etc.) will be in Task X.3.3
  // For this task, we just confirm settings are read.
  // console.log("DeckListClient - Settings read:", { groupingMode, activeTagGroupId, sortField, sortDirection });

  const handlePracticeDeck = (deckId: string, learnCount: number, reviewCount: number) => {
    if (learnCount === 0 && reviewCount === 0) {
        toast.info("No cards available to practice in this deck right now.");
        return;
    }
    const studyInput: StudySessionInput = { deckId: deckId };
    const sessionTypeForStore: SessionType = 'unified';
    clearStudyParameters();
    setStudyParameters(studyInput, sessionTypeForStore);
    router.push('/study/session');
  };

  const handleCreateDeckClick = () => {
    // Link to the choice page, then to new, or directly to new.
    // Assuming /decks/new is the unified entry point as per previous plans.
    router.push('/decks/new'); 
  };

  if (isOverallLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (decksError) {
    return <p className="text-center text-destructive py-10">Error loading decks: {decksError}</p>;
  }

  // --- This is where rendering logic for different grouping modes will go (Task X.3.3) ---
  // For now, we'll render a flat list using processedAndSortedDecks
  // The grouping UI controls will be added in the Settings page (Task X.S1)

  const renderDeckItem = (deck: ProcessedDeck) => {
    const learnEligible = deck.learn_eligible_count ?? 0;
    const reviewEligible = deck.review_eligible_count ?? 0;
    const totalPracticeable = learnEligible + reviewEligible;

    return (
      <Card key={deck.id} className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent dark:border-slate-700">
        <CardHeader className="pt-4 pb-2 space-y-1 px-4">
          <div className="flex justify-between items-center">
            <CardTitle className="truncate text-lg" title={deck.name}>{deck.name}</CardTitle>
            {/* Edit button is removed for practice view - Task X.3.2 */}
          </div>
          <ItemInfoBadges 
            primaryLanguage={deck.primary_language}
            secondaryLanguage={deck.secondary_language}
            isBilingual={deck.is_bilingual}
            cardCount={deck.totalCards}
            tags={deck.tags}
          />
        </CardHeader>
        <CardFooter className="flex justify-center pt-4 px-4 pb-4 mt-auto"> {/* Added mt-auto for consistent button placement */}
          <Button
              onClick={() => handlePracticeDeck(deck.id, learnEligible, reviewEligible)}
              disabled={totalPracticeable === 0}
              size="sm"
              className="w-full bg-primary hover:bg-primary/90"
          >
              <Play className="h-4 w-4 mr-2" />
              Practice {totalPracticeable > 0 ? `(${totalPracticeable})` : ''}
          </Button>
        </CardFooter>
        {showDeckProgressBars && deck.totalCards > 0 && (
          <>
            <Separator />
            <CardContent className="px-4 pt-4 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg">
              <DeckProgressBar
                newCount={deck.new_count ?? 0}
                learningCount={deck.learning_count ?? 0}
                relearningCount={deck.relearning_count ?? 0}
                youngCount={deck.young_count ?? 0}
                matureCount={deck.mature_count ?? 0}
              />
            </CardContent>
          </>
        )}
      </Card>
    );
  }
  // --- End of renderDeckItem ---

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4 md:p-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
          <h2 className="text-2xl font-semibold">Practice Your Decks</h2>
        </div>

        {/* UI Controls for grouping/sorting will be added to Settings page (Task X.S1) */}
        {/* This component now just reads and applies them. */}
        {/* For debugging, you can display the current settings: */}
        {/* 
        <div className="p-2 bg-muted text-xs rounded mb-2">
            Grouping: {groupingMode}
            {groupingMode === 'tag_id' && activeTagGroupId && ` (Tag ID: ${activeTagGroupId})`}
            , Sort: {sortField} ({sortDirection})
        </div> 
        */}

        {processedAndSortedDecks.length === 0 && !isOverallLoading && (
          <div className="col-span-full text-center text-muted-foreground mt-10">
            <p>
              {groupingMode === 'tag_id' && activeTagGroupId 
                ? "No decks found with the selected tag." 
                : "You haven't created any decks yet, or no decks match current filters."}
            </p>
            <Button onClick={handleCreateDeckClick} className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Your First Deck
            </Button>
          </div>
        )}

        {/* Actual rendering based on groupingMode will be built in Task X.3.3 */}
        {/* For now, rendering a flat list for simplicity of this task */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedAndSortedDecks.map(renderDeckItem)}
        </div>


        {showDeckProgressBars && processedAndSortedDecks.length > 0 && (
          <div className="mt-4 flex justify-end">
            {/* ... legend ... */}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}