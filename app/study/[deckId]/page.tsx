"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ThumbsUp, ThumbsDown } from "lucide-react" // Only icons used directly here

// UI Components (Assuming they are in standard UI folder)
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress" // Progress is used here too for loading/empty states

// Custom Hooks & Types
import { useDecks } from "@/hooks/use-decks"
import type { Deck, FlashCard } from "@/types/deck"
import { useTTS } from "@/hooks/use-tts"
import { useSettings } from "@/hooks/use-settings"
import { useToast } from "@/hooks/use-toast"

// Extracted Utils & Constants
import {
  prepareStudyCards,
  calculateMasteredCount,
  calculateDifficultyScore,
  MASTERY_THRESHOLD,
  TTS_DELAY_MS,
  DECK_LOAD_RETRY_DELAY_MS,
  MAX_DECK_LOAD_RETRIES,
  FLIP_ANIMATION_MIDPOINT_MS,
  FLIP_ANIMATION_DURATION_MS
} from "@/lib/study-utils";

// Extracted Study Components
import { DeckHeader } from "@/components/deck-header";
import { StudyProgress } from "@/components/study-progress";
import { DifficultyIndicator } from "@/components/difficulty-indicator"


// --- Component ---

export default function StudyDeckPage() {
  // --- Hooks ---
  const { deckId } = useParams<{ deckId: string }>()
  const router = useRouter()
  const { getDeck, updateDeck } = useDecks()
  const { settings } = useSettings()
  const { toast } = useToast()
  const { speak, setLanguage } = useTTS()

  // --- State ---
  const [deck, setDeck] = useState<Deck | null>(null)
  const [studyCards, setStudyCards] = useState<FlashCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // --- Refs ---
  const retryCountRef = useRef(0)
  const hasLoadedInitiallyRef = useRef(false)

  // --- Derived State ---
  const totalCards = useMemo(() => deck?.cards?.length ?? 0, [deck])
  const masteredCount = useMemo(() => calculateMasteredCount(deck?.cards ?? []), [deck]) // Using helper
  const currentStudyCard = useMemo(() => studyCards?.[currentCardIndex], [studyCards, currentCardIndex])
  const currentDeckCard = useMemo(() => deck?.cards.find(card => card.id === currentStudyCard?.id), [deck, currentStudyCard])
  const currentCardCorrectCount = useMemo(() => currentDeckCard?.correctCount || 0, [currentDeckCard])

  // Progress Calculations
  const totalRequiredCorrectAnswers = useMemo(() => totalCards * MASTERY_THRESHOLD, [totalCards])
  const totalAchievedCorrectAnswers = useMemo(() =>
    deck?.cards?.reduce((sum, card) => sum + (card.correctCount || 0), 0) ?? 0,
    [deck]
  )
  const overallProgressPercent = useMemo(() =>
    totalRequiredCorrectAnswers > 0
      ? Math.round((totalAchievedCorrectAnswers / totalRequiredCorrectAnswers) * 100)
      : 0,
    [totalAchievedCorrectAnswers, totalRequiredCorrectAnswers]
  )
  const masteryProgressPercent = useMemo(() =>
    totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0,
    [masteredCount, totalCards]
  )


  // --- Effects ---

  // Effect: Load deck data
  useEffect(() => {
    let isMounted = true
    const loadDeckData = async () => {
      // ... (Keep the existing loadDeckData logic from the previous refactor)
      // Important: Inside loadDeckData, use the imported helpers:
      // const initialStudyCards = prepareStudyCards(loadedDeck.cards);
      // const initialMasteredCount = calculateMasteredCount(loadedDeck.cards); // No longer needed here as masteredCount is derived state
      // ... rest of the logic ...

      if (!deckId || hasLoadedInitiallyRef.current) return

      setIsLoading(true)
      setError(null)
      retryCountRef.current = 0
      console.log("Attempting to load deck:", deckId)

      const attemptLoad = async () => {
        try {
          const loadedDeck = await getDeck(deckId)

          if (!isMounted) return // Component unmounted during fetch

          if (loadedDeck) {
            if (!Array.isArray(loadedDeck.cards)) {
              throw new Error("Invalid deck data: 'cards' is not an array.")
            }

            const initialStudyCards = prepareStudyCards(loadedDeck.cards); // Use helper

            if (isMounted) {
              setDeck(loadedDeck)
              setStudyCards(initialStudyCards)
              setCurrentCardIndex(0)
              setIsFlipped(false)
              setError(null)
              hasLoadedInitiallyRef.current = true // Mark initial load complete
              console.log("Deck loaded successfully:", loadedDeck.name)
            }
          } else {
            // Deck not found, attempt retry
            if (retryCountRef.current < MAX_DECK_LOAD_RETRIES) {
              retryCountRef.current++
              console.log(`Deck not found. Retrying (${retryCountRef.current}/${MAX_DECK_LOAD_RETRIES})...`)
              setTimeout(() => { if (isMounted) attemptLoad() }, DECK_LOAD_RETRY_DELAY_MS)
            } else {
              throw new Error(`Deck with ID "${deckId}" not found after ${MAX_DECK_LOAD_RETRIES} retries.`)
            }
          }
        } catch (err) {
          console.error("Error loading deck:", err)
          if (isMounted) {
            setError(err instanceof Error ? err.message : "An unknown error occurred while loading the deck.")
            setDeck(null) // Clear any potentially stale deck data
            setStudyCards([])
          }
        } finally {
          // Only set loading to false if loading finished (success or final error)
          if (isMounted && (hasLoadedInitiallyRef.current || error || retryCountRef.current >= MAX_DECK_LOAD_RETRIES)) {
            setIsLoading(false)
          }
        }
      }

      attemptLoad() // Start the loading process
    }

    loadDeckData()

    return () => {
      isMounted = false
      console.log("StudyDeckPage unmounting or deckId changed.")
    }
  }, [deckId, getDeck]) // Dependency: only re-run if deckId or getDeck changes


  // Effect: Speak question
  useEffect(() => {
    // ... (Keep the existing TTS effect logic from the previous refactor)
    if (isLoading || isFlipped || isTransitioning || !settings?.ttsEnabled || !currentStudyCard?.question || !deck) {
      return
    }

    const language = deck.isBilingual ? deck.questionLanguage : deck.language
    if (!language) {
      console.warn("No language configured for question TTS.")
      return
    }

    setLanguage(language) // Ensure TTS engine has the right language

    // Delay slightly to allow language setting to propagate
    const speakTimeoutId = setTimeout(() => {
      console.log("Speaking question:", currentStudyCard.question, "in", language)
      speak(currentStudyCard.question, language)
    }, TTS_DELAY_MS)

    return () => clearTimeout(speakTimeoutId) // Cleanup timeout on effect change

  }, [
    currentStudyCard, // Re-run when the card content changes
    isFlipped,        // Re-run when flip state changes (speak only when not flipped)
    isLoading,
    isTransitioning,
    settings?.ttsEnabled,
    deck,             // Need deck for language info
    setLanguage,
    speak
  ])


  // --- Callbacks ---

  // Callback: Handle flipping the card
  const handleFlip = useCallback(() => {
    // ... (Keep the existing handleFlip logic)
     if (isTransitioning || !currentStudyCard?.answer || !deck) return

    const willBeFlipped = !isFlipped
    setIsFlipped(willBeFlipped)

    // Speak answer *after* flipping to reveal it
    if (willBeFlipped && settings?.ttsEnabled) {
      const answerLanguage = deck.isBilingual ? deck.answerLanguage : deck.language
      if (!answerLanguage) {
        console.warn("No language configured for answer TTS.")
        return
      }

      setLanguage(answerLanguage) // Set language for the answer

      // Delay slightly for language setup and flip animation start
      const speakTimeoutId = setTimeout(() => {
        console.log("Speaking answer:", currentStudyCard.answer, "in", answerLanguage)
        speak(currentStudyCard.answer, answerLanguage)
      }, TTS_DELAY_MS)

      // No need for cleanup function here as it's a one-off action per flip
    }
  }, [isFlipped, isTransitioning, currentStudyCard, deck, settings?.ttsEnabled, speak, setLanguage])


  // Callback: Handle user answering correct/incorrect
  const handleAnswer = useCallback(async (correct: boolean) => {
    if (!deck || !currentStudyCard || isTransitioning) return

    setIsTransitioning(true)
    setIsFlipped(false) // Start flip-back animation

    // --- Wait for animation midpoint before updating card data ---
    await new Promise(resolve => setTimeout(resolve, FLIP_ANIMATION_MIDPOINT_MS))

    // --- Update Card and Deck State ---
    let nextStudyCards = [...studyCards]
    let nextCardIndex = currentCardIndex
    let cardJustMastered = false

    const updatedDeckCards = deck.cards.map(card => {
      if (card.id === currentStudyCard.id) {
        const oldCorrectCount = card.correctCount || 0
        const newCorrectCount = correct ? oldCorrectCount + 1 : oldCorrectCount
        const newIncorrectCount = !correct ? (card.incorrectCount || 0) + 1 : (card.incorrectCount || 0)
        const newAttemptCount = (card.attemptCount || 0) + 1

        cardJustMastered = newCorrectCount >= MASTERY_THRESHOLD && oldCorrectCount < MASTERY_THRESHOLD;

        const updatedCard = {
          ...card,
          correctCount: newCorrectCount,
          incorrectCount: newIncorrectCount,
          attemptCount: newAttemptCount,
          lastStudied: new Date().toISOString(),
        }

        // Calculate new difficulty score
        updatedCard.difficultyScore = calculateDifficultyScore(updatedCard)

        return updatedCard
      }
      return card
    })

    // Update the study cards with the new difficulty score
    nextStudyCards = nextStudyCards.map(card => {
      if (card.id === currentStudyCard.id) {
        const updatedDeckCard = updatedDeckCards.find(dc => dc.id === card.id)
        if (updatedDeckCard) {
          return {
            ...card,
            correctCount: updatedDeckCard.correctCount,
            incorrectCount: updatedDeckCard.incorrectCount,
            attemptCount: updatedDeckCard.attemptCount,
            lastStudied: updatedDeckCard.lastStudied,
            difficultyScore: updatedDeckCard.difficultyScore
          }
        }
      }
      return card
    })

    // --- Determine Next Card ---
    if (cardJustMastered) {
      console.log(`Card ${currentStudyCard.id} mastered!`)
      // Remove the just-mastered card from the active study set
      nextStudyCards = nextStudyCards.filter(card => card.id !== currentStudyCard.id)

      if (nextStudyCards.length === 0) {
        // Study session complete for now
        console.log("All available cards mastered in this session.")
        // No index change needed, component will re-render to completion state
      } else {
        // If the removed card was the last, loop back to the start
        nextCardIndex = currentCardIndex >= nextStudyCards.length ? 0 : currentCardIndex
      }
    } else {
      // Card not mastered, move to the next card in the current study set
      nextCardIndex = (currentCardIndex + 1) % nextStudyCards.length
    }

    // --- Prepare Updated Deck Object ---
    const newMasteredCount = calculateMasteredCount(updatedDeckCards);
    const newTotalCorrect = updatedDeckCards.reduce((sum, card) => sum + (card.correctCount || 0), 0)

    const updatedDeckData: Deck = {
      ...deck,
      cards: updatedDeckCards,
      progress: {
        ...deck.progress,
        correct: newMasteredCount,
      },
    }

    // --- Update State ---
    setDeck(updatedDeckData)
    setStudyCards(nextStudyCards)
    setCurrentCardIndex(nextCardIndex)

    // --- Wait for flip animation to complete ---
    await new Promise(resolve => setTimeout(resolve, FLIP_ANIMATION_DURATION_MS - FLIP_ANIMATION_MIDPOINT_MS))
    setIsTransitioning(false)

    // --- Persist Changes ---
    try {
      console.log("Saving updated deck progress...");
      await updateDeck(updatedDeckData)
      console.log("Deck progress saved.");
    } catch (err) {
      console.error("Error updating deck:", err)
      toast({
        title: "Error Saving Progress",
        description: "Could not save your latest progress. Please try again later.",
        variant: "destructive",
      })
    }

  }, [deck, studyCards, currentCardIndex, isTransitioning, updateDeck, toast])


  // Callback: Handle resetting progress for the deck
  const handleResetProgress = useCallback(async () => {
    if (!deck) return

    console.log("Resetting progress for deck:", deck.name)
    const resetCards = deck.cards.map((card) => ({
      ...card,
      correctCount: 0,
      incorrectCount: 0,
      attemptCount: 0,
      lastStudied: null,
      difficultyScore: 0,
    }))

    const resetDeck: Deck = {
      ...deck,
      cards: resetCards,
      progress: {
        ...deck.progress,
        correct: 0, // Reset mastered count
      },
    }

    try {
      await updateDeck(resetDeck)

      // Reset local state to reflect the change
      setDeck(resetDeck)
      setStudyCards(prepareStudyCards(resetCards)) // Use helper
      setCurrentCardIndex(0)
      setIsFlipped(false)
      setError(null) // Clear any previous errors

      toast({
        title: "Progress Reset",
        description: `Progress for "${deck.name}" has been reset.`,
      })
    } catch (err) {
      console.error("Error resetting progress:", err)
      toast({
        title: "Error Resetting Progress",
        description: "Could not reset progress. Please try again later.",
        variant: "destructive",
      })
    }
  }, [deck, updateDeck, toast])


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

  // Error State
  if (error && !deck) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold text-destructive mb-4">Error Loading Deck</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/")}><ArrowLeft className="mr-2 h-4 w-4"/> Return to Home</Button>
      </div>
    )
  }

  // Deck Not Found State
  if (!deck) {
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
  if (totalCards === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        {/* Use Extracted Component */}
        <DeckHeader deckName={deck.name} onReset={handleResetProgress} showReset={false} />
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

  // All Cards Mastered State
  if (studyCards.length === 0 && totalCards > 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        {/* Use Extracted Components */}
        <DeckHeader deckName={deck.name} onReset={handleResetProgress} showReset={true} />
        <StudyProgress
            totalCorrect={totalAchievedCorrectAnswers}
            totalRequired={totalRequiredCorrectAnswers}
            overallPercent={overallProgressPercent}
            masteredCount={masteredCount}
            totalCards={totalCards}
            masteryPercent={masteryProgressPercent}
        />
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="flex flex-col items-center justify-center p-6 py-10 text-center">
            <h2 className="text-xl font-semibold mb-2">Congratulations! 🎉</h2>
            <p className="text-muted-foreground mb-6">
              You've mastered all {totalCards} cards in this deck!
            </p>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <Button variant="outline" onClick={handleResetProgress}>
                {/* RotateCcw is handled within DeckHeader, showing different button here */}
                Study Again
              </Button>
              <Link href="/" passHref>
                <Button><ArrowLeft className="mr-2 h-4 w-4"/> Back to Decks</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  // Active Studying State
  if (!currentStudyCard) {
     return (
       <div className="container mx-auto px-4 py-8 text-center">
         <p className="text-muted-foreground">Error: Cannot display current card.</p>
       </div>
     )
  }

  const remainingCount = MASTERY_THRESHOLD - currentCardCorrectCount;
  const cardProgressText = `${currentCardCorrectCount} / ${MASTERY_THRESHOLD} correct ${
    remainingCount > 0 ? `(${remainingCount} more)` : '(Mastered!)'
  }`;

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Use Extracted Components */}
      <DeckHeader deckName={deck.name} onReset={handleResetProgress} showReset={true} />
      <StudyProgress
        totalCorrect={totalAchievedCorrectAnswers}
        totalRequired={totalRequiredCorrectAnswers}
        overallPercent={overallProgressPercent}
        masteredCount={masteredCount}
        totalCards={totalCards}
        masteryPercent={masteryProgressPercent}
      />

      {/* Flashcard Section (Remains largely the same) */}
      <div className="max-w-2xl mx-auto">
        <div
          className={`flip-card ${isFlipped ? "flipped" : ""} w-full h-80 cursor-pointer`}
          onClick={handleFlip}
          role="button"
          aria-label={isFlipped ? "Flip to question" : "Flip to answer"}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') handleFlip() }}
        >
          <div className="flip-card-inner relative w-full h-full">
            {/* Front */}
            <div className="flip-card-front absolute w-full h-full">
              <Card className="w-full h-full flex flex-col">
                <CardHeader className="text-center text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <div>Card {currentCardIndex + 1} of {studyCards.length} (in rotation)</div>
                    {settings?.showDifficulty && (
                      <DifficultyIndicator 
                        difficultyScore={currentStudyCard.difficultyScore ?? null} 
                      />
                    )}
                  </div>
                  <div className="text-xs font-medium">{cardProgressText}</div>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
                  <p className="text-xl md:text-2xl">{currentStudyCard.question}</p>
                </CardContent>
                <CardFooter className="justify-center text-sm text-muted-foreground">
                  Click card to reveal answer
                </CardFooter>
              </Card>
            </div>
            {/* Back */}
            <div className="flip-card-back absolute w-full h-full">
              <Card className="w-full h-full flex flex-col">
                <CardHeader className="text-center text-sm text-muted-foreground">
                  <div>Answer</div>
                  <div className="text-xs font-medium">{cardProgressText}</div>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
                  <p className="text-xl md:text-2xl">{currentStudyCard.answer}</p>
                </CardContent>
                <CardFooter className="justify-center pt-4 pb-4 space-x-4">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 active:scale-95 transition-all duration-150"
                    onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}
                    disabled={isTransitioning}
                    aria-label="Mark as incorrect"
                  >
                    <ThumbsDown className="mr-2 h-4 w-4" /> Incorrect
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-green-500 text-green-700 hover:bg-green-500/10 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 active:scale-95 transition-all duration-150"
                    onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}
                    disabled={isTransitioning}
                    aria-label="Mark as correct"
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" /> Correct
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}