// components/deck-list.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Edit } from "lucide-react"
import { useDecks } from "@/hooks/use-decks"
import { useRouter } from "next/navigation"
import { useStudySessionStore } from "@/store/studySessionStore"
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DeckProgressBar } from "@/components/deck/DeckProgressBar"
import { useSettings } from "@/providers/settings-provider"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { StudyModeButtons } from "@/components/study/StudyModeButtons"
import { getCardSrsStatesByIds } from '@/lib/actions/cardActions';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { isValid, parseISO } from 'date-fns';

export function DeckList() {
  const { decks, loading, refetchDecks } = useDecks() // Added refetchDecks
  const { settings, loading: settingsLoading } = useSettings() // Get settings
  const [isVisible, setIsVisible] = useState(true)
  const router = useRouter() // Keep router
  const [deckCardCounts, setDeckCardCounts] = useState<{
    [deckId: string]: { learn: number; review: number }
  }>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  // Effect for handling page visibility (for spinner animation)
  useEffect(() => {
    const handleVisibilityChange = () => setIsVisible(!document.hidden);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      setIsVisible(!document.hidden); // Set initial state
      // Cleanup listener on component unmount
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, [])

  // Effect to refetch decks when page becomes visible again after being hidden
  // This helps keep the list fresh if the user navigates away and back
   useEffect(() => {
     if (isVisible && !loading) {
        // Optional: Add a check to avoid refetching too frequently if needed
        console.log("[DeckList] Page visible, refetching decks.");
        refetchDecks();
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isVisible]); // Rerun only when visibility changes

  // Navigate to the edit page for a specific deck
  const handleEditDeck = (deckId: string) => {
    router.push(`/edit/${deckId}`)
  }

  // Navigate to the intermediate deck creation choice page
  const handleCreateDeckClick = () => {
    console.log("[DeckList] Navigating to deck creation choice page.");
    router.push('/decks/create-choice'); // Navigate to the choice page
  }

  // Handle combined loading state
  const isLoading = loading || settingsLoading;

  // Legend data - UPDATED with hex codes
  const legendStages = [
    { name: 'New', startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning', startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Young', startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature', startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  // Function to fetch all card counts at once
  const fetchAllDeckCardCounts = useCallback(async () => {
    if (!decks?.length) return;
    
    setIsLoadingCounts(true);
    
    try {
      console.log('[DeckList] Batch fetching card counts for all decks');
      
      // For each deck, get card IDs
      const deckCardsPromises = decks.map(deck => 
        resolveStudyQuery({
          criteria: { 
            deckId: deck.id, 
            tagLogic: 'ANY' as const,
          }
        })
      );
      
      // Wait for all queries to complete
      const deckCardsResults = await Promise.all(deckCardsPromises);
      
      // Collect all card IDs
      const allCardIds: string[] = [];
      const deckCardIds: {[deckId: string]: string[]} = {};
      
      decks.forEach((deck, index) => {
        const cardIds = deckCardsResults[index].data || [];
        deckCardIds[deck.id] = cardIds;
        allCardIds.push(...cardIds);
      });
      
      if (allCardIds.length === 0) {
        console.log('[DeckList] No cards found in any deck');
        setDeckCardCounts({});
        setIsLoadingCounts(false);
        return;
      }
      
      // Get SRS states for all cards in one request
      const srsStatesResult = await getCardSrsStatesByIds([...new Set(allCardIds)]);
      
      if (srsStatesResult.error || !srsStatesResult.data) {
        console.error('Error fetching SRS states:', srsStatesResult.error);
        setIsLoadingCounts(false);
        return;
      }
      
      // Process the results
      const now = new Date();
      const cardStates = srsStatesResult.data;
      const cardStateMap = new Map();
      
      // Create a lookup for faster access
      cardStates.forEach(state => {
        cardStateMap.set(state.id, state);
      });
      
      // Calculate counts for each deck
      const newCounts: {[deckId: string]: {learn: number; review: number}} = {};
      
      Object.entries(deckCardIds).forEach(([deckId, cardIds]) => {
        let learnCount = 0;
        let reviewCount = 0;
        
        cardIds.forEach(cardId => {
          const state = cardStateMap.get(cardId);
          if (!state) return;
          
          // Learn Mode eligibility
          if (state.srs_level === 0 && 
              (state.learning_state === null || state.learning_state === 'learning')) {
            learnCount++;
          }
          
          // Review Mode eligibility
          const isGraduatedOrRelearning = 
            (state.srs_level !== null && state.srs_level !== undefined && state.srs_level >= 1) || 
            (state.srs_level === 0 && state.learning_state === 'relearning');
          
          const isDue = 
            state.next_review_due && 
            isValid(parseISO(state.next_review_due)) && 
            parseISO(state.next_review_due) <= now;
          
          if (isGraduatedOrRelearning && isDue) {
            reviewCount++;
          }
        });
        
        newCounts[deckId] = { learn: learnCount, review: reviewCount };
      });
      
      console.log('[DeckList] Calculated counts for all decks:', newCounts);
      
      // Log an example of a single deck's counts for better debugging
      if (Object.keys(newCounts).length > 0) {
        const firstDeckId = Object.keys(newCounts)[0];
        console.log(`[DeckList] Example count for deck ${firstDeckId}:`, newCounts[firstDeckId]);
      }
      
      // Log state before update
      console.log('[DeckList] Current state before update:', deckCardCounts);
      
      // Update state
      setDeckCardCounts(newCounts);
      
      // This won't show the updated state due to React's state batching, but logging here for sequence
      console.log('[DeckList] Updated deckCardCounts state');
    } catch (error) {
      console.error('Error in batch card count calculation:', error);
    } finally {
      setIsLoadingCounts(false);
    }
  }, [decks]);
  
  // Fetch counts when decks load
  useEffect(() => {
    fetchAllDeckCardCounts();
  }, [fetchAllDeckCardCounts]);
  
  // Track loading state changes
  useEffect(() => {
    console.log('[DeckList] isLoadingCounts changed to:', isLoadingCounts);
  }, [isLoadingCounts]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        {/* Spinner animation */}
        <div
          className={`h-12 w-12 rounded-full border-2 border-primary ${isVisible ? 'animate-spin border-b-transparent' : ''}`}
          style={{
            animation: isVisible ? 'spin 1s linear infinite' : 'none',
            borderBottomColor: 'transparent'
          }}
        />
      </div>
    )
  }

  // Get setting value, default to true if settings not loaded yet
  const showDeckProgress = settings?.showDeckProgress ?? true;

  // Main component render
  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4 md:p-6">
        {/* Header section */}
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
          {/* Title remains */}
          <h2 className="text-2xl font-semibold">Your Decks</h2>
          {/* Create button remains */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleCreateDeckClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Deck
            </Button>
          </div>
        </div>

        {/* Grid container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Display message if no decks exist */}
          {decks.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground mt-10">
              <p>You haven't created any decks yet.</p>
              {/* Button to create the first deck */}
              <Button onClick={handleCreateDeckClick} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Your First Deck
              </Button>
            </div>
          ) : (
            // Map through existing decks and render a card for each
            decks.map((deck) => {
              const totalCards = (deck.new_count ?? 0) +
                                 (deck.learning_count ?? 0) +
                                 (deck.young_count ?? 0) +
                                 (deck.mature_count ?? 0);
              // Format language display based on whether the deck is bilingual
              let languageDisplay = deck.primary_language || 'Lang not set';
              if (deck.is_bilingual && deck.secondary_language) {
                  languageDisplay = `${deck.primary_language ?? '?'} / ${deck.secondary_language ?? '?'}`;
              }

              return (
                <Card key={deck.id} className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent dark:border-slate-700">
                  <CardHeader className="pt-4 pb-2 space-y-1 px-4">
                    <div className="flex justify-between items-center">
                      {/* Deck name (truncated if long) */}
                      <CardTitle className="truncate text-lg" title={deck.name}>{deck.name}</CardTitle>
                      {/* Edit button with tooltip */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditDeck(deck.id)}
                            className="h-7 w-7 flex-shrink-0 text-muted-foreground"
                            aria-label={`Edit deck ${deck.name}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Deck</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    {/* Deck metadata */}
                    <CardDescription className="text-sm">
                      {totalCards} card{totalCards !== 1 ? 's' : ''} • {languageDisplay}
                    </CardDescription>
                  </CardHeader>
                  {/* Footer with study buttons */}
                  <CardFooter className="flex justify-center pt-4 px-4 pb-4">
                    {/* Replace the buttons with the new component */}
                    <StudyModeButtons 
                      studyType="deck" 
                      contentId={deck.id} 
                      size="sm"
                      preCalculatedLearnCount={deckCardCounts[deck.id]?.learn}
                      preCalculatedReviewCount={deckCardCounts[deck.id]?.review}
                      batchFetchInProgress={isLoadingCounts}
                    />
                  </CardFooter>
                  {/* Conditionally render Separator AND DeckProgressBar */}
                  {showDeckProgress && (
                    <>
                      <Separator />
                      <CardContent className="px-4 pt-4 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg">
                        <DeckProgressBar
                          newCount={deck.new_count ?? 0}
                          learningCount={deck.learning_count ?? 0}
                          youngCount={deck.young_count ?? 0}
                          matureCount={deck.mature_count ?? 0}
                        />
                      </CardContent>
                    </>
                  )}
                </Card>
              )
            })
          )}
        </div>

        {/* Expanded Legend */}
        {showDeckProgress && decks.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 p-2 border rounded-md bg-background shadow-sm">
              {legendStages.map(stage => (
                <span key={stage.name} className="flex items-center gap-1">
                  {/* Apply inline gradient style to legend chip */}
                  <span
                    className="h-2 w-3 rounded"
                    style={{ backgroundImage: `linear-gradient(to right, ${stage.startColor}, ${stage.endColor})` }}
                  ></span>
                  {stage.name}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </TooltipProvider>
  )
}