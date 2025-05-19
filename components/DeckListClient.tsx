"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStudySessionStore } from "@/store/studySessionStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeckProgressBar } from "@/components/deck/DeckProgressBar";
import { useSettings } from "@/providers/settings-provider";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { StudyModeButtons } from "@/components/study/StudyModeButtons";
import { useDecks } from "@/hooks/use-decks";
import { appLogger } from '@/lib/logger';

// Type for enhanced deck data that includes learn/review counts
interface EnhancedDeck {
  id: string;
  name: string;
  primary_language: string | null;
  secondary_language: string | null;
  is_bilingual: boolean;
  updated_at: string;
  new_count: number;
  learning_count: number;
  young_count: number;
  mature_count: number;
  learn_eligible_count: number;
  review_eligible_count: number;
}

interface DeckListClientProps {
  initialData?: EnhancedDeck[];
}

export function DeckListClient({ initialData }: DeckListClientProps) {
  const { decks: fallbackDecks, loading: fallbackLoading, refetchDecks } = useDecks();
  const { settings, loading: settingsLoading } = useSettings();
  const [isVisible, setIsVisible] = useState(true);
  const router = useRouter();
  
  // Use initialData if provided, otherwise fall back to client-side fetching
  const [decks, setDecks] = useState<EnhancedDeck[]>(initialData || []);
  const isUsingInitialData = Boolean(initialData);
  
  // If initial data is not provided, we need to use the fallback
  const isLoading = !isUsingInitialData && (fallbackLoading || settingsLoading);

  // Effect for handling page visibility
  useEffect(() => {
    const handleVisibilityChange = () => setIsVisible(!document.hidden);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      setIsVisible(!document.hidden); // Set initial state
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  }, []);

  // If we don't have initial data, we need to update decks when fallbackDecks changes
  useEffect(() => {
    if (!isUsingInitialData && fallbackDecks && fallbackDecks.length > 0) {
      // Convert fallbackDecks to EnhancedDeck format
      // This won't have learn_eligible_count and review_eligible_count initially
      const convertedDecks = fallbackDecks.map(deck => ({
        ...deck,
        learn_eligible_count: 0,  // Will be calculated later in StudyModeButtons
        review_eligible_count: 0  // Will be calculated later in StudyModeButtons
      })) as EnhancedDeck[];
      
      setDecks(convertedDecks);
    }
  }, [fallbackDecks, isUsingInitialData]);

  // Effect to refetch decks when page becomes visible again
  useEffect(() => {
    if (isVisible && !isUsingInitialData && !fallbackLoading) {
      appLogger.info("[DeckListClient] Page visible, refetching decks.");
      refetchDecks();
    }
  }, [isVisible, isUsingInitialData, fallbackLoading, refetchDecks]);

  // Navigate to the edit page for a specific deck
  const handleEditDeck = (deckId: string) => {
    router.push(`/edit/${deckId}`);
  };

  // Navigate to the intermediate deck creation choice page
  const handleCreateDeckClick = () => {
    appLogger.info("[DeckListClient] Navigating to deck creation choice page.");
    router.push('/decks/create-choice');
  };

  // Legend data with hex codes
  const legendStages = [
    { name: 'New', startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning', startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Young', startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature', startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div
          className={`h-12 w-12 rounded-full border-2 border-primary ${isVisible ? 'animate-spin border-b-transparent' : ''}`}
          style={{
            animation: isVisible ? 'spin 1s linear infinite' : 'none',
            borderBottomColor: 'transparent'
          }}
        />
      </div>
    );
  }

  // Get setting value, default to true if settings not loaded yet
  const showDeckProgress = settings?.showDeckProgress ?? true;

  // Main component render
  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4 md:p-6">
        {/* Header section */}
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
          <h2 className="text-2xl font-semibold">Your Decks</h2>
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
                    {/* Use pre-calculated counts from server if available */}
                    <StudyModeButtons 
                      studyType="deck" 
                      contentId={deck.id} 
                      size="sm"
                      preCalculatedLearnCount={isUsingInitialData ? deck.learn_eligible_count : undefined}
                      preCalculatedReviewCount={isUsingInitialData ? deck.review_eligible_count : undefined}
                      batchFetchInProgress={false}
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
  );
} 