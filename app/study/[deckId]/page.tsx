"use client"

import { useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Custom Hooks & Types
import type { Deck, FlashCard } from "@/types/deck"
import { useSettings } from "@/providers/settings-provider"
import { useStudySession } from "@/hooks/use-study-session"

// Extracted Study Components
import { DeckHeader } from "@/components/deck-header";
import { StudyProgress } from "@/components/study-progress";
import { StudyCompletionScreen } from '@/components/study-completion-screen';
import { StudyFlashcardView } from '@/components/study-flashcard-view';

/**
 * Study Deck Page Component.
 *
 * This component orchestrates the flashcard study session for a specific deck.
 * It fetches the deck, manages the sequence of cards to study (including difficult ones),
 * handles user interactions (flipping, marking correct/incorrect/skip),
 * updates card statistics, provides Text-to-Speech (TTS) functionality,
 * tracks progress, and displays loading, error, study, and completion states.
 *
 * Key Features:
 * - Fetches deck data with retry logic.
 * - Prepares study card sequence based on settings and difficulty.
 * - Renders the current card with question and answer sides.
 * - Handles card flipping animations and state.
 * - Processes user answers, updates card stats locally, and attempts immediate persistence per card.
 * - Provides TTS for questions and answers based on deck language and settings.
 * - Calculates and displays overall deck mastery and progress.
 * - Allows saving progress and exiting, practicing difficult cards, or restarting the session.
 *
 * @returns {JSX.Element} The study session UI, loading indicator, error message, or completion screen.
 */
export default function StudyDeckPage() {
  // --- Hooks ---
  const { deckId } = useParams<{ deckId: string }>()
  const router = useRouter()
  const { settings } = useSettings()
  const {
    deck,
    currentStudyCard,
    isFlipped,
    isLoading,
    error,
    isTransitioning,
    totalCards,
    masteredCount,
    currentCardIndex,
    studyCardsCount,
    overallProgressPercent,
    masteryProgressPercent,
    totalAchievedCorrectAnswers,
    totalRequiredCorrectAnswers,
    difficultCardsCount,
    isDifficultMode,
    cardProgressText,
    flipCard,
    answerCardCorrect,
    answerCardIncorrect,
    practiceDifficultCards,
    resetDeckProgress,
    isFullDeckMastered,
    isDifficultSessionComplete,
  } = useStudySession({ deckId, settings });

  // --- Effect for Auth Redirect --- 
  // Moved to top level to comply with Rules of Hooks
  useEffect(() => {
    // Only redirect if loading is complete, deck is missing, AND the error is auth-related
    if (!isLoading && !deck && error && error.toLowerCase().includes("user not authenticated")) {
      const callbackUrl = encodeURIComponent(`/study/${deckId}`);
      console.log("Auth error detected, redirecting to login...");
      router.push(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [isLoading, deck, error, router, deckId]); // Dependencies for the effect

  // --- Derived State from Hook Data (MUST be before conditional returns) ---
  const currentFullCardData = useMemo(() => {
    // Ensure dependencies are valid before trying to find the card
    if (!deck || !currentStudyCard) return undefined;
    return deck.cards.find(card => card.id === currentStudyCard.id);
  }, [deck, currentStudyCard]);

  // --- Render Logic ---

  // Loading State
  if (isLoading) {
     return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-4 text-muted-foreground">Loading Deck...</span>
      </div>
    )
  }

  // --- Post-Loading Checks --- 
  // Order: Error -> Not Found -> Empty -> **Completed** -> Active Card Error -> Active Card Render

  // Error State (Handles errors from the hook)
  if (error && !deck) {
    // Check if the specific error is the auth error to display redirect message
    if (error.toLowerCase().includes("user not authenticated")) {
      // Render minimal loading/redirecting message while the useEffect triggers navigation
      return (
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="ml-4 text-muted-foreground">Redirecting to login...</span>
        </div>
      );
    } else {
      // Handle other errors as before
      return (
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-4">Error Loading Deck</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push("/")}><ArrowLeft className="mr-2 h-4 w-4"/> Return to Home</Button>
        </div>
      )
    }
  }

  // Deck Not Found State (Hook handles retries, sets error)
  // This state might be covered by the error state above if the hook sets error correctly.
  // If not, a specific check for !deck && !isLoading && !error might be needed.
  if (!deck && !isLoading) { // Check isLoading to avoid flashing this while loading
      return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold mb-4">Deck Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The requested deck could not be found or loaded.
        </p>
        <Button onClick={() => router.push("/")}><ArrowLeft className="mr-2 h-4 w-4"/> Return to Home</Button>
      </div>
    )
  }

  // Empty Deck State
  if (totalCards === 0 && deck) { // Add deck check to ensure it's loaded
      return (
      <main className="container mx-auto px-4 py-8">
        <DeckHeader deckName={deck.name} onReset={resetDeckProgress} showReset={false} />
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="flex flex-col items-center justify-center p-6 py-10 text-center">
            <p className="text-muted-foreground mb-4">This deck has no cards.</p>
            <Link href={`/edit/${deckId}`} passHref>
              <Button>Add Cards</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  // --- Simplified Completion Checks ---

  // Scenario 1: Deck is fully mastered on load (and not in difficult mode)
  if (!isLoading && isFullDeckMastered && !isDifficultMode && deck) {
    console.log("Rendering completion screen: Full deck mastered.");
      return (
       <StudyCompletionScreen
         deckName={deck.name}
         totalCards={totalCards}
            masteredCount={masteredCount}
         totalAchievedCorrectAnswers={totalAchievedCorrectAnswers}
         totalRequiredCorrectAnswers={totalRequiredCorrectAnswers}
         overallProgressPercent={overallProgressPercent}
         masteryProgressPercent={masteryProgressPercent}
         onResetProgress={resetDeckProgress}
         onPracticeDifficult={practiceDifficultCards}
         difficultCardsCount={difficultCardsCount}
         isDifficultModeCompletion={false}
      />
    )
  }

  // Scenario 2: Just completed a difficult card session
  if (!isLoading && isDifficultSessionComplete && deck) {
    console.log("Rendering completion screen: Difficult session complete.");
    return (
       <StudyCompletionScreen
         deckName={deck.name}
         totalCards={totalCards}
            masteredCount={masteredCount}
         totalAchievedCorrectAnswers={totalAchievedCorrectAnswers}
         totalRequiredCorrectAnswers={totalRequiredCorrectAnswers}
         overallProgressPercent={overallProgressPercent}
         masteryProgressPercent={masteryProgressPercent}
         onResetProgress={resetDeckProgress}
         onPracticeDifficult={practiceDifficultCards}
         difficultCardsCount={difficultCardsCount}
         isDifficultModeCompletion={true}
      />
    )
  }

  // --- Final Active Session Guard ---
  // If we reach here, isLoading is false, session is not complete.
  // We expect deck and currentFullCardData to be defined for the active view.
  // This guard handles unexpected states and satisfies TypeScript.
  if (!deck || !currentFullCardData) {
      console.error("StudyDeckPage: Reached final render block with null deck or card data. This shouldn't happen.");
       return (
       <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-destructive">Error: Cannot display current card data.</p>
       </div>
      );
  }

  // Now TypeScript knows deck and currentFullCardData are non-null
  return (
    <main className="container mx-auto px-4 py-8">
      <DeckHeader deckName={deck.name} onReset={resetDeckProgress} showReset={true} />
      <StudyProgress
        totalCorrect={totalAchievedCorrectAnswers}
        totalRequired={totalRequiredCorrectAnswers}
        overallPercent={overallProgressPercent}
        masteredCount={masteredCount}
        totalCards={totalCards}
        masteryPercent={masteryProgressPercent}
      />
      <StudyFlashcardView
        card={currentFullCardData}
        isFlipped={isFlipped}
        isTransitioning={isTransitioning}
        onFlip={flipCard} // Use action from hook
        // Pass the specific answer actions from hook
        onAnswer={(isCorrect) => isCorrect ? answerCardCorrect() : answerCardIncorrect()}
        settings={settings}
        cardProgressText={cardProgressText}
        currentCardIndex={currentCardIndex}
        totalStudyCards={studyCardsCount} // Use count from hook
        isDifficultMode={isDifficultMode}
      />
    </main>
  )
}
