// components/deck-list.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Play, Edit, GraduationCap } from "lucide-react"
// REMOVED: import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { useDecks } from "@/hooks/use-decks"
import { useRouter } from "next/navigation" // Keep useRouter
// REMOVED: import { useSettings } from "@/providers/settings-provider" // No longer needed here
// REMOVED: import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert" // No longer needed here
// REMOVED: import { Terminal } from "lucide-react" // No longer needed here
import { useStudySessionStore, StudyInput } from "@/store/studySessionStore"
import { StudyQueryCriteria } from "@/lib/schema/study-query.schema"
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

export function DeckList() {
  const { decks, loading, refetchDecks } = useDecks() // Added refetchDecks
  const { settings, loading: settingsLoading } = useSettings() // Get settings
  // REMOVED: const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const router = useRouter() // Keep router
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters)
  const clearStudyParameters = useStudySessionStore((state) => state.clearStudyParameters)
  // REMOVED: const { settings } = useSettings(); // No longer needed here

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

  // Prepare and navigate to a study session
  const handleStudy = (deckId: string, mode: 'learn' | 'review') => {
    console.log(`[DeckList] Starting session for Deck ID: ${deckId}, Mode: ${mode}`);
    // Prepare study parameters based on the selected deck
    // Ensure the criteria object includes default fields expected by StudyQueryCriteria
    const criteria: StudyQueryCriteria = {
        deckId: deckId,
        // Add default values for fields that have defaults in the schema
        tagLogic: 'ANY', // Default logic
        includeDifficult: false, // Default value
        // Other fields are optional and can be omitted
    };
    const actionInput: StudyInput = { criteria: criteria };
    clearStudyParameters(); // Clear any previous session parameters
    setStudyParameters(actionInput, mode); // Set parameters for the new session
    router.push('/study/session'); // Navigate to the study session page
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
        {/* Header section - LEGEND REMOVED FROM HERE */}
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6"> {/* Added mb-6 */}
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
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleStudy(deck.id, 'learn')}
                        aria-label={`Learn ${deck.name}`}
                        className="bg-gradient-to-br from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white shadow-sm hover:shadow"
                        size="sm"
                        disabled={totalCards === 0}
                      >
                        <GraduationCap className="h-4 w-4 mr-1" /> Learn
                      </Button>
                      <Button
                        onClick={() => handleStudy(deck.id, 'review')}
                        aria-label={`Review ${deck.name}`}
                        className="bg-gradient-to-br from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white shadow-sm hover:shadow"
                        size="sm"
                        disabled={totalCards === 0}
                      >
                        <Play className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </div>
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