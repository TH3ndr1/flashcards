"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

// Custom Hooks & Types
import { useDecks } from "@/hooks/use-decks"
import type { Deck, FlashCard } from "@/types/deck"
import { useTTS } from "@/hooks/use-tts"
import { useSettings } from "@/hooks/use-settings" // Assumed settings hook
import { useToast } from "@/hooks/use-toast"

// --- 1. Import getFontClass ---
import { getFontClass } from "@/lib/fonts";
// ---

// Extracted Utils & Constants
import {
  DEFAULT_MASTERY_THRESHOLD,
  prepareStudyCards,
  prepareDifficultCards,
  calculateMasteredCount,
  calculateDifficultyScore,
  TTS_DELAY_MS,
  DECK_LOAD_RETRY_DELAY_MS,
  MAX_DECK_LOAD_RETRIES,
  FLIP_ANIMATION_MIDPOINT_MS,
  // FLIP_ANIMATION_DURATION_MS, // Not used directly?
} from "@/lib/study-utils";

// Extracted Study Components
import { DeckHeader } from "@/components/deck-header";
import { StudyProgress } from "@/components/study-progress";
import { DifficultyIndicator, EASY_CUTOFF} from "@/components/difficulty-indicator"

// --- Component ---

export default function StudyDeckPage() {
  // --- Hooks ---
  const { deckId } = useParams<{ deckId: string }>()
  const router = useRouter()
  const { getDeck, updateDeck } = useDecks()
  // --- Settings Hook ---
  const { settings } = useSettings() // Make sure 'settings' object contains the font preference, e.g., settings.cardFont
  const { toast } = useToast()
  const { speak, setLanguage } = useTTS()

  // --- State ---
  // ... (rest of state remains the same)
  const [deck, setDeck] = useState<Deck | null>(null)
  const [studyCards, setStudyCards] = useState<FlashCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)


  // --- Refs ---
  // ... (rest of refs remain the same)
  const retryCountRef = useRef(0)
  const hasLoadedInitiallyRef = useRef(false)


  // --- Derived State ---
  // ... (rest of derived state remains the same)
  const totalCards = useMemo(() => deck?.cards?.length ?? 0, [deck])
  const masteredCount = useMemo(() => calculateMasteredCount(deck?.cards ?? [], settings), [deck, settings])
  const currentStudyCard = useMemo(() => studyCards?.[currentCardIndex], [studyCards, currentCardIndex])
  const currentDeckCard = useMemo(() => deck?.cards.find(card => card.id === currentStudyCard?.id), [deck, currentStudyCard])
  const currentCardCorrectCount = useMemo(() => currentDeckCard?.correctCount || 0, [currentDeckCard])


  // --- 2. Calculate Font Class ---
  // Ensure settings.cardFont is the correct key for your font preference ('default', 'opendyslexic', 'atkinson')
  const fontClass = useMemo(() => getFontClass(settings?.cardFont), [settings?.cardFont]);


  // Progress Calculations
  // ... (rest of calculations remain the same)
   const masteryThreshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
   const totalRequiredCorrectAnswers = useMemo(() => totalCards * masteryThreshold, [totalCards, masteryThreshold]);
   const totalAchievedCorrectAnswers = useMemo(() =>
     deck?.cards?.reduce((sum, card) => sum + (card.correctCount || 0), 0) ?? 0,
     [deck]
   );
   const overallProgressPercent = useMemo(() =>
     totalRequiredCorrectAnswers > 0
       ? Math.round((totalAchievedCorrectAnswers / totalRequiredCorrectAnswers) * 100)
       : 0,
     [totalAchievedCorrectAnswers, totalRequiredCorrectAnswers]
   );
   const masteryProgressPercent = useMemo(() =>
     totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0,
     [masteredCount, totalCards]
   );


  // --- Effects ---
  // ... (rest of effects remain the same)
    // Effect: Load deck data
  useEffect(() => {
    let isMounted = true
    const loadDeckData = async () => {
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

            const initialStudyCards = prepareStudyCards(loadedDeck.cards, settings)

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
  }, [deckId, getDeck, settings]) // Dependency: only re-run if deckId or getDeck changes


  // Effect: Speak question
  useEffect(() => {
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
  // ... (rest of callbacks remain the same)
  // Callback: Handle flipping the card
  const handleFlip = useCallback(() => {
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
    if (!deck || !currentStudyCard || isTransitioning) return;

    setIsTransitioning(true);
    setIsFlipped(false); // Start flip-back animation

    // --- Wait for animation midpoint before updating card data ---
    setTimeout(async () => {
      if (!isMountedRef.current || !deck || !currentStudyCard) return;

      try {
        // Steps 1-5: Find original card, calculate stats, create updatedCard with new score
        const cardIndexInDeck = deck.cards.findIndex((c) => c.id === currentStudyCard.id);
        if (cardIndexInDeck === -1) {
          console.error("Card not found in deck state during update.");
          if (isMountedRef.current) setIsTransitioning(false);
          return;
        }
        const originalCard = deck.cards[cardIndexInDeck];
        const oldCorrectCount = originalCard.correctCount;
        const updatedCorrectCount = originalCard.correctCount + (correct ? 1 : 0);
        const updatedIncorrectCount = originalCard.incorrectCount + (correct ? 0 : 1);
        const updatedAttemptCount = originalCard.attemptCount + 1;
        const updatedLastStudied = new Date();
        let updatedCard: FlashCard = {
          ...originalCard,
          correctCount: updatedCorrectCount,
          incorrectCount: updatedIncorrectCount,
          attemptCount: updatedAttemptCount,
          lastStudied: updatedLastStudied,
          difficultyScore: originalCard.difficultyScore,
        };
        const updatedDifficultyScore = calculateDifficultyScore(updatedCard);
        updatedCard.difficultyScore = updatedDifficultyScore;

        // 6. Create the new deck object for main state and persistence
        const newDeckCards = [...deck.cards];
        newDeckCards[cardIndexInDeck] = updatedCard;
        const updatedDeckData: Deck = { ...deck, cards: newDeckCards };

        // 7. Update main deck state immediately
        setDeck(updatedDeckData);
        
        // --- 8. Update studyCards state immediately with the updated card --- 
        const cardIndexInStudySet = studyCards.findIndex(c => c.id === currentStudyCard.id);
        let updatedStudyCards = [...studyCards];
        if (cardIndexInStudySet !== -1) {
            updatedStudyCards[cardIndexInStudySet] = updatedCard; // Replace with the card having the new score
            if (isMountedRef.current) setStudyCards(updatedStudyCards);
        } else {
            console.warn("Current study card not found in studyCards state array during update.");
            // Potentially skip session logic or handle error, for now we proceed cautiously
        }
        // --- End update studyCards ---

        // 9. Persist changes via the hook
        await updateDeck(updatedDeckData);
        console.log("Deck update persisted for card:", updatedCard.id);

        // 10. Session Logic (now operates on updatedStudyCards implicitly via state or use it directly)
        let nextStudyCardsForFiltering = updatedStudyCards; // Use the state we just set
        let nextCardIndex = currentCardIndex;
        const cardJustMastered = updatedCorrectCount >= masteryThreshold && oldCorrectCount < masteryThreshold;

        if (cardJustMastered) {
            console.log(`Card ${currentStudyCard.id} mastered! Removing from current session.`);
            // Filter the updated set
            nextStudyCardsForFiltering = updatedStudyCards.filter(card => card.id !== currentStudyCard.id);

            if (nextStudyCardsForFiltering.length === 0) {
              console.log("All available cards mastered in this session.");
              if (isMountedRef.current) setStudyCards([]); // Trigger completion state
            } else {
              nextCardIndex = Math.min(currentCardIndex, nextStudyCardsForFiltering.length - 1);
              if (isMountedRef.current) {
                setStudyCards(nextStudyCardsForFiltering); // Update state with the filtered list
                setCurrentCardIndex(nextCardIndex);
              }
            }
        } else {
            // Card not mastered, move to next using the length of the *current* (potentially updated) study set
            if (updatedStudyCards.length > 0) { 
                 nextCardIndex = (currentCardIndex + 1) % updatedStudyCards.length;
                 if (isMountedRef.current) setCurrentCardIndex(nextCardIndex);
            } else {
                 console.warn("Attempting to move to next card, but studyCards is empty after update.");
                 if (isMountedRef.current) {
                     setStudyCards([]);
                     setCurrentCardIndex(0);
                 }
            }
        }

      } catch (err) { 
         console.error("Error updating deck after answer:", err);
         if (isMountedRef.current) {
           toast({ title: "Update Error", description: "Could not save study progress.", variant: "destructive" });
         }
      } finally {
         if (isMountedRef.current) {
             setIsTransitioning(false);
         }
      }
    }, FLIP_ANIMATION_MIDPOINT_MS);

    // Cleanup function ...
    const isMountedRef = { current: true };
    return () => { isMountedRef.current = false; };
  }, [deck, currentStudyCard, currentCardIndex, studyCards, updateDeck, toast, settings, isTransitioning, masteryThreshold]);


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
      difficultyScore: 0, // Reset difficulty score
    }))

    const resetDeck: Deck = {
      ...deck,
      cards: resetCards,
    }

    try {
      await updateDeck(resetDeck)

      // Reset local state to reflect the change
      setDeck(resetDeck)
      setStudyCards(prepareStudyCards(resetCards, settings))
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
  }, [deck, updateDeck, toast, settings])


  // --- Render Logic ---

  // Loading State
  if (isLoading) {
    // ... (loading state remains the same)
     return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-4 text-muted-foreground">Loading Deck...</span>
      </div>
    )
  }

  // Error State
  if (error && !deck) {
    // ... (error state remains the same)
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
    // ... (deck not found state remains the same)
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
    // ... (empty deck state remains the same)
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

  // All Cards Mastered State or Difficult Cards Completed State
  if (studyCards.length === 0 && totalCards > 0) {
     // ... (all cards mastered state remains the same)

       // If we were studying difficult cards, show the difficult cards completion screen
    if (deck.progress?.studyingDifficult) {
      // Check if there are still difficult cards after this session
      const remainingDifficultCards = deck.cards.filter(card => (card.difficultyScore ?? 0) >= EASY_CUTOFF);
      const remainingDifficultCount = remainingDifficultCards.length;

      const handlePracticeDifficult = () => {
        if (remainingDifficultCount === 0) return;

        // Prepare difficult cards for study using the new function
        const difficultStudyCards = prepareDifficultCards(remainingDifficultCards);
        console.log("Difficult study cards prepared:", difficultStudyCards);

        if (difficultStudyCards.length === 0) {
          console.error("No study cards were prepared");
          return;
        }

        // Reset statistics for difficult cards and update the deck
        const updatedCards = deck.cards.map(card => {
          if ((card.difficultyScore ?? 0) >= EASY_CUTOFF) {
            // Reset stats only for difficult cards
            return {
              ...card,
              correctCount: 0,
              incorrectCount: 0,
              attemptCount: 0,
              lastStudied: null,
            };
          }
          return card;
        });

        const updatedDeck = {
          ...deck,
          cards: updatedCards,
          progress: {
            ...deck.progress,
            studyingDifficult: true,
          },
        };

        // Update all necessary state and persist changes
        setDeck(updatedDeck);
        setStudyCards(difficultStudyCards);
        setCurrentCardIndex(0);
        setIsFlipped(false);

        // Persist the changes to storage
        updateDeck(updatedDeck).catch(err => {
          console.error("Error updating deck:", err);
          toast({
            title: "Error Starting Difficult Practice",
            description: "Could not save deck state. Please try again.",
            variant: "destructive",
          });
        });

        // Show feedback to user
        toast({
          title: "Practicing Difficult Cards",
          description: `Starting practice with ${remainingDifficultCount} difficult ${remainingDifficultCount === 1 ? 'card' : 'cards'}.`,
        });
      };

      return (
        <main className="container mx-auto px-4 py-8">
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
              <h2 className="text-xl font-semibold mb-2">Well Done! 🍪</h2>
              <p className="text-muted-foreground mb-6">
                {remainingDifficultCount > 0
                  ? `You've mastered this set of difficult cards! However, there are still ${remainingDifficultCount} difficult ${remainingDifficultCount === 1 ? 'card' : 'cards'} to practice.`
                  : "You've mastered all the difficult cards! Each card has been answered correctly 3 times."}
              </p>
              <div className="flex flex-col gap-3 w-full max-w-sm">
                {remainingDifficultCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={handlePracticeDifficult}
                    className="w-full border-amber-500 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    Practice {remainingDifficultCount} Remaining Difficult {remainingDifficultCount === 1 ? 'Card' : 'Cards'} 🍪
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleResetProgress}
                  className="w-full"
                >
                  Practice All Cards
                </Button>
                <Link href="/" passHref className="w-full">
                  <Button className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4"/> Back to Decks
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      );
    }

    // Regular completion screen for all cards mastered
    // Calculate number of difficult cards
    const difficultCards = deck.cards.filter(card => (card.difficultyScore ?? 0) >= EASY_CUTOFF);
    const difficultCardsCount = difficultCards.length;

    const handlePracticeDifficult = () => {
      if (difficultCardsCount === 0) return;

      // Prepare difficult cards for study using the new function
      const difficultStudyCards = prepareDifficultCards(difficultCards);
      console.log("Difficult study cards prepared:", difficultStudyCards);

      if (difficultStudyCards.length === 0) {
        console.error("No study cards were prepared");
        return;
      }

      // Reset statistics for difficult cards and update the deck
      const updatedCards = deck.cards.map(card => {
        if ((card.difficultyScore ?? 0) >= EASY_CUTOFF) {
          // Reset stats only for difficult cards
          return {
            ...card,
            correctCount: 0,
            incorrectCount: 0,
            attemptCount: 0,
            lastStudied: null,
          };
        }
        return card;
      });

      const updatedDeck = {
        ...deck,
        cards: updatedCards,
        progress: {
          ...deck.progress,
          studyingDifficult: true,
        },
      };

      // Update all necessary state and persist changes
      setDeck(updatedDeck);
      setStudyCards(difficultStudyCards);
      setCurrentCardIndex(0);
      setIsFlipped(false);

      // Persist the changes to storage
      updateDeck(updatedDeck).catch(err => {
        console.error("Error updating deck:", err);
        toast({
          title: "Error Starting Difficult Practice",
          description: "Could not save deck state. Please try again.",
          variant: "destructive",
        });
      });

      // Show feedback to user
      toast({
        title: "Practicing Difficult Cards",
        description: `Starting practice with ${difficultCardsCount} difficult ${difficultCardsCount === 1 ? 'card' : 'cards'}.`,
      });
    };

    return (
      <main className="container mx-auto px-4 py-8">
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
            <div className="flex flex-col gap-3 w-full max-w-sm">
              <Button
                variant="outline"
                onClick={handleResetProgress}
                className="w-full"
              >
                Practice All Cards
              </Button>
              {difficultCardsCount > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePracticeDifficult}
                  className="w-full border-amber-500 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  Practice {difficultCardsCount} Difficult {difficultCardsCount === 1 ? 'Card' : 'Cards'} 🍪
                </Button>
              )}
              <Link href="/" passHref className="w-full">
                <Button className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4"/> Back to Decks
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    )

  }

  // Active Studying State
  if (!currentStudyCard) {
     // ... (active studying state error remains the same)
       return (
       <div className="container mx-auto px-4 py-8 text-center">
         <p className="text-muted-foreground">Error: Cannot display current card.</p>
       </div>
     )
  }

  // ... (card progress text calculation remains the same)
  const remainingCount = masteryThreshold - currentCardCorrectCount;
  const cardProgressText = `${currentCardCorrectCount} / ${masteryThreshold} correct${
    currentCardCorrectCount >= masteryThreshold ? ' (Mastered!)' : ''
  }`;


  return (
    <main className="container mx-auto px-4 py-8">
      {/* Use Extracted Components */}
      {/* ... (Header and Progress remain the same) */}
      <DeckHeader deckName={deck.name} onReset={handleResetProgress} showReset={true} />
      <StudyProgress
        totalCorrect={totalAchievedCorrectAnswers}
        totalRequired={totalRequiredCorrectAnswers}
        overallPercent={overallProgressPercent}
        masteredCount={masteredCount}
        totalCards={totalCards}
        masteryPercent={masteryProgressPercent}
      />


      {/* Flashcard Section */}
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
              {/* --- 3. Apply fontClass to Card --- */}
              <Card className={cn(
                "w-full h-full flex flex-col",
                deck.progress?.studyingDifficult && "border-amber-500",
                fontClass // Apply the dynamic font class here
              )}>
                <CardHeader className="text-center text-sm text-muted-foreground bg-muted/50 border-b py-3">
                  {/* ... (CardHeader content remains the same) */}
                   <div className="flex justify-between items-center">
                    <div className="text-xs font-medium">Card {currentCardIndex + 1} of {studyCards.length}</div>
                    <div className="text-xs font-medium">{cardProgressText}</div>
                    {settings?.showDifficulty && (
                      <DifficultyIndicator
                        difficultyScore={currentStudyCard.difficultyScore ?? null}
                      />
                    )}
                  </div>
                </CardHeader>
                {/* The <p> tag below will inherit the font from the parent Card */}
                <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
                  <p className="text-xl md:text-2xl">{currentStudyCard.question}</p>
                </CardContent>
                <CardFooter className="justify-center text-sm text-muted-foreground bg-muted/50 border-t py-3 min-h-[52px]">
                  Click card to reveal answer
                </CardFooter>
              </Card>
            </div>
            {/* Back */}
            <div className="flip-card-back absolute w-full h-full">
              {/* --- 3. Apply fontClass to Card --- */}
              <Card className={cn(
                "w-full h-full flex flex-col",
                deck.progress?.studyingDifficult && "border-amber-500",
                fontClass // Apply the dynamic font class here
              )}>
                <CardHeader className="text-center text-sm text-muted-foreground bg-muted/50 border-b py-3">
                  {/* ... (CardHeader content remains the same) */}
                    <div className="flex justify-between items-center">
                    <div className="text-xs font-medium">Card {currentCardIndex + 1} of {studyCards.length}</div>
                    <div className="text-xs font-medium">{cardProgressText}</div>
                    {settings?.showDifficulty && (
                      <DifficultyIndicator
                        difficultyScore={currentStudyCard.difficultyScore ?? null}
                      />
                    )}
                  </div>
                </CardHeader>
                 {/* The <p> tag below will inherit the font from the parent Card */}
                <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
                  <p className="text-xl md:text-2xl">{currentStudyCard.answer}</p>
                </CardContent>
                <CardFooter className="text-center text-sm text-muted-foreground bg-muted/50 border-t py-3 space-x-4">
                  {/* ... (CardFooter buttons remain the same) */}
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