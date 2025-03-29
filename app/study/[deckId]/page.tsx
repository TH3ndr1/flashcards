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
import { useSettings } from "@/providers/settings-provider"
import { toast } from "sonner"

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
import { StudyCompletionScreen } from '@/components/study-completion-screen'; // Import the component
import { StudyFlashcardView } from '@/components/study-flashcard-view'; // Import the new component

// --- Component ---

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
  const { getDeck, updateDeck, loading: useDecksLoading } = useDecks()
  // --- Settings Hook ---
  const { settings } = useSettings()
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


  // Progress Calculations (MUST be defined before use in handleAnswer and completion screen)
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

  // Calculate difficult cards count (Moved Higher, needed for completion screen)
  const difficultCardsCount = useMemo(() => {
    if (!deck?.cards) return 0;
    // Use EASY_CUTOFF from DifficultyIndicator imports
    return deck.cards.filter(card => (card.difficultyScore ?? 0) >= EASY_CUTOFF).length;
  }, [deck?.cards]);

  // --- 2. Calculate Font Class ---
  // Ensure settings.cardFont is the correct key for your font preference ('default', 'opendyslexic', 'atkinson')
  // const fontClass = useMemo(() => getFontClass(settings?.cardFont), [settings?.cardFont]);


  // --- Effects ---
  // ... (rest of effects remain the same)
    // Effect: Load deck data
  useEffect(() => {
    let isMounted = true
    let result: { data: Deck | null; error: Error | null } | null = null;

    const attemptLoad = async () => {
      // --- Ensure useDecks has finished its initial load AND we have a deckId ---
      if (useDecksLoading || !deckId) {
        console.log("Waiting for useDecks to finish loading or deckId to be available.", { useDecksLoading, hasDeckId: !!deckId });
        // Set page loading to true while waiting for useDecks
        if (useDecksLoading && isMounted) {
           setIsLoading(true);
           setError(null); // Clear previous errors while waiting
        } else if (!deckId && isMounted) {
           console.error("No deck ID provided.");
           setError("No deck ID found in URL.");
           setIsLoading(false); // No deckId, stop loading
        }
        return;
      }
      // --- End Guard Clause ---

      setIsLoading(true); // Start page-specific loading
      setError(null);
      console.log("Attempting to load deck:", deckId, `Retry: ${retryCountRef.current}`);

      try {
        result = await getDeck(deckId); // getDeck should now be safe to call

        if (!isMounted) return;

        if (result.error) {
          console.error("Failed to load deck:", result.error);
          toast.error("Error Loading Deck", {
            description: result.error.message || "Could not load the requested deck.",
          });
          setDeck(null);
          setStudyCards([]);
          setError(result.error.message || "Could not load deck.");
        } else if (result.data) {
          console.log("Deck loaded successfully:", result.data.name);
          if (!Array.isArray(result.data.cards)) {
             throw new Error("Invalid deck data: 'cards' is not an array.");
          }
          const initialStudyCards = prepareStudyCards(result.data.cards, settings);
          if (isMounted) {
            setDeck(result.data);
            setStudyCards(initialStudyCards);
            setCurrentCardIndex(0);
            setIsFlipped(false);
            setError(null);
            retryCountRef.current = 0;
          }
        } else {
          // Handle deck not found case (result.data is null, no error)
          if (retryCountRef.current < MAX_DECK_LOAD_RETRIES) {
            retryCountRef.current++;
            console.log(`Deck ${deckId} not found or not ready. Retrying (${retryCountRef.current}/${MAX_DECK_LOAD_RETRIES})...`);
            setTimeout(() => { if (isMounted) attemptLoad(); }, DECK_LOAD_RETRY_DELAY_MS);
            return; // Don't set loading false yet
          } else {
             console.error(`Deck with ID \"${deckId}\" not found after ${MAX_DECK_LOAD_RETRIES} retries.`);
             if (isMounted) {
                toast.error("Deck Not Found", {
                   description: "The requested deck could not be found.",
                });
                setDeck(null);
                setStudyCards([]);
                setError("Deck not found.");
             }
          }
        }
      } catch (err) {
        console.error("Unexpected error during deck loading sequence:", err);
        if (isMounted) {
            toast.error("Loading Error", {
                description: err instanceof Error ? err.message : "An unexpected error occurred.",
            });
            setDeck(null);
            setStudyCards([]);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        }
      } finally {
        // Only set page loading false if the operation completed (success, final error, max retries)
        if (isMounted && (result?.data || result?.error || retryCountRef.current >= MAX_DECK_LOAD_RETRIES)) {
          setIsLoading(false);
          console.log("Deck loading process finished (success, final error, or max retries).")
        }
      }
    };

    // --- Call attemptLoad directly - the guard clause handles the waiting ---
    attemptLoad();

    return () => { isMounted = false; console.log("StudyDeckPage unmounting or dependencies changed."); };
    // --- Add useDecksLoading to dependency array ---
  }, [deckId, getDeck, settings, useDecksLoading]);


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
  const handleAnswer = useCallback(
    async (isCorrect: boolean | null) => {
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
          const updatedCorrectCount = originalCard.correctCount + (isCorrect ? 1 : 0);
          const updatedIncorrectCount = originalCard.incorrectCount + (isCorrect ? 0 : 1);
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
             toast.error("Update Error", { description: "Could not save study progress." });
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
    },
    [
      deck,
      currentStudyCard,
      currentCardIndex,
      studyCards,
      updateDeck,
      toast,
      settings,
      isTransitioning,
      masteryThreshold
    ]
  );


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

      toast.success("Progress Reset", {
        description: `Progress for "${deck.name}" has been reset.`,
      });
    } catch (err) {
      console.error("Error resetting progress:", err)
      toast.error("Error Resetting Progress", {
        description: "Could not reset progress. Please try again later.",
      });
    }
  }, [deck, updateDeck, toast, settings])

  // Callback: Start practicing only difficult cards (Moved Higher, needed for completion screen)
  const handlePracticeDifficult = useCallback(() => {
      const difficultCards = deck?.cards.filter(card => (card.difficultyScore ?? 0) >= EASY_CUTOFF);
      if (!deck || !difficultCards || difficultCards.length === 0) {
        toast.info("No Difficult Cards", { description: "There are no cards marked as difficult to practice." });
        return;
      }

      // Prepare difficult cards for study using the utility function
      const difficultStudyCards = prepareDifficultCards(difficultCards);
      console.log("Difficult study cards prepared:", difficultStudyCards);

      if (difficultStudyCards.length === 0) {
        console.error("No study cards were prepared from difficult cards list.");
        toast.error("Preparation Error", { description: "Could not prepare difficult cards for studying." });
        return;
      }

      // Reset statistics ONLY for the difficult cards being practiced
      const updatedCards = deck.cards.map(card => {
        if ((card.difficultyScore ?? 0) >= EASY_CUTOFF) {
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
          studyingDifficult: true, // Mark that we are now studying difficult cards
        },
      };

      // Update state optimistically
      setDeck(updatedDeck);
      setStudyCards(difficultStudyCards);
      setCurrentCardIndex(0);
      setIsFlipped(false);

      // Persist the deck changes (reset stats for difficult cards, set flag)
      updateDeck(updatedDeck).then(result => {
         if (result.error) {
            console.error("Error updating deck state for difficult practice:", result.error);
            toast.error("Error Starting Difficult Practice", {
                description: `Failed to save state: ${result.error.message}`,
            });
            // Consider reverting optimistic update here if needed
         }
      }).catch(err => {
        console.error("Unexpected error persisting deck state for difficult practice:", err);
        toast.error("Error Starting Difficult Practice", {
            description: "An unexpected error occurred while saving state.",
        });
      });

      // Show feedback to user
      toast.info("Practicing Difficult Cards", {
        description: `Starting practice with ${difficultCards.length} difficult ${difficultCards.length === 1 ? 'card' : 'cards'}.`,
      });
  }, [deck, updateDeck, settings]);


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
    const isDifficultModeCompletion = deck.progress?.studyingDifficult ?? false;

    return (
       <StudyCompletionScreen
         deckName={deck.name}
         totalCards={totalCards}
         masteredCount={masteredCount}
         totalAchievedCorrectAnswers={totalAchievedCorrectAnswers}
         totalRequiredCorrectAnswers={totalRequiredCorrectAnswers}
         overallProgressPercent={overallProgressPercent}
         masteryProgressPercent={masteryProgressPercent}
         onResetProgress={handleResetProgress} // Pass the existing callback
         onPracticeDifficult={handlePracticeDifficult} // Pass the new callback
         difficultCardsCount={difficultCardsCount} // Pass the calculated count
         isDifficultModeCompletion={isDifficultModeCompletion}
       />
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

  // --- Card progress text calculation (remains the same) ---
  const cardProgressText = `${currentCardCorrectCount} / ${masteryThreshold} correct${
    currentCardCorrectCount >= masteryThreshold ? ' (Mastered!)' : ''
  }`;
  // --- End card progress text calculation ---

  // --- Determine if in difficult mode (for prop) ---
  const isDifficultMode = deck?.progress?.studyingDifficult ?? false;
  // ---

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Header and Progress (remain the same) */}
      <DeckHeader deckName={deck.name} onReset={handleResetProgress} showReset={true} />
      <StudyProgress
        totalCorrect={totalAchievedCorrectAnswers}
        totalRequired={totalRequiredCorrectAnswers}
        overallPercent={overallProgressPercent}
        masteredCount={masteredCount}
        totalCards={totalCards}
        masteryPercent={masteryProgressPercent}
      />

      {/* --- Use the Extracted Flashcard Component --- */}
      <StudyFlashcardView
        card={currentStudyCard} // Pass the current card
        isFlipped={isFlipped}
        isTransitioning={isTransitioning}
        onFlip={handleFlip}
        onAnswer={handleAnswer} // Pass the correct handleAnswer callback
        settings={settings}
        cardProgressText={cardProgressText}
        currentCardIndex={currentCardIndex}
        totalStudyCards={studyCards.length} // Pass the length of the current study set
        isDifficultMode={isDifficultMode}
        // fontClass={fontClass} // Pass font class if needed
      />
      {/* --- End Extracted Flashcard Component Usage --- */}
    </main>
  )
}