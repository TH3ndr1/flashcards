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
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function DeckList() {
  const { decks, loading, refetchDecks } = useDecks() // Added refetchDecks
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
    const actionInput: StudyInput = { criteria: { deckId: deckId } };
    clearStudyParameters(); // Clear any previous session parameters
    setStudyParameters(actionInput, mode); // Set parameters for the new session
    router.push('/study/session'); // Navigate to the study session page
  }

  // Navigate to the intermediate deck creation choice page
  const handleCreateDeckClick = () => {
    console.log("[DeckList] Navigating to deck creation choice page.");
    router.push('/decks/create-choice'); // Navigate to the choice page
  }

  // Render loading state
  if (loading) {
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

  // Main component render
  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4 md:p-6">
        {/* Header section with title and create button */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-2xl font-semibold">Your Decks</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Button to initiate deck creation */}
            <Button onClick={handleCreateDeckClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Deck
            </Button>
          </div>
        </div>

        {/* Grid container for deck cards */}
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
              const totalCards = deck.card_count ?? 0;
              // Format language display based on whether the deck is bilingual
              let languageDisplay = deck.primary_language || 'Lang not set';
              if (deck.is_bilingual && deck.secondary_language) {
                  languageDisplay = `${deck.primary_language ?? '?'} / ${deck.secondary_language ?? '?'}`;
              }

              return (
                <Card key={deck.id} className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent">
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
                  <CardFooter className="flex justify-center mt-auto pt-4">
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleStudy(deck.id, 'learn')}
                        aria-label={`Learn ${deck.name}`}
                        className="bg-gradient-to-br from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white shadow-sm hover:shadow"
                        size="sm"
                      >
                        <GraduationCap className="h-4 w-4 mr-1" /> Learn
                      </Button>
                      <Button
                        onClick={() => handleStudy(deck.id, 'review')}
                        aria-label={`Review ${deck.name}`}
                        className="bg-gradient-to-br from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white shadow-sm hover:shadow"
                        size="sm"
                      >
                        <Play className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              )
            })
          )}
        </div>
        {/* Removed the CreateDeckDialog component */}
      </div>
    </TooltipProvider>
  )
}