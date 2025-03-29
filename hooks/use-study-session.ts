"use client"; // Hooks interacting with client-side state need this

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDecks } from "./use-decks";
import type { Deck, FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider"; // Assuming Settings type is exported
import { toast } from "sonner";
import {
  prepareStudyCards,
  prepareDifficultCards,
  calculateMasteredCount,
  calculateDifficultyScore,
  DECK_LOAD_RETRY_DELAY_MS,
  MAX_DECK_LOAD_RETRIES,
  DEFAULT_MASTERY_THRESHOLD,
  FLIP_ANIMATION_MIDPOINT_MS, // Needed for transition timing
} from "@/lib/study-utils";

interface UseStudySessionProps {
  deckId: string | undefined;
  settings: Settings | null;
}

// Define the shape of the object returned by the hook
interface StudySessionState {
  deck: Deck | null;
  currentStudyCard: FlashCard | undefined;
  isFlipped: boolean;
  isLoading: boolean;
  error: string | null;
  isTransitioning: boolean;
  totalCards: number;
  masteredCount: number;
  currentCardIndex: number;
  studyCardsCount: number;
  // Action Functions
  flipCard: () => void;
  markCorrect: () => void;
  markIncorrect: () => void;
  restartDifficult: () => void;
  resetProgress: () => Promise<void>;
}

export function useStudySession({
  deckId,
  settings,
}: UseStudySessionProps): StudySessionState {
  const { getDeck, updateDeck } = useDecks(); // Keep data fetching hooks here

  // --- State Migration --- 
  const [deck, setDeck] = useState<Deck | null>(null);
  const [studyCards, setStudyCards] = useState<FlashCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const retryCountRef = useRef(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For debounced saving

  // --- Derived State Migration ---
  const totalCards = useMemo(() => deck?.cards?.length ?? 0, [deck]);
  const masteredCount = useMemo(() => calculateMasteredCount(deck?.cards ?? [], settings), [deck, settings]);
  const currentStudyCard = useMemo(() => studyCards?.[currentCardIndex], [studyCards, currentCardIndex]);
  const studyCardsCount = useMemo(() => studyCards.length, [studyCards]);

  // --- Deck Loading Effect (Moved from component) ---
  useEffect(() => {
    let isMounted = true;
    let result: { data: Deck | null; error: Error | null } | null = null;

    const attemptLoad = async () => {
      if (!deckId) {
        console.warn("useStudySession: No deckId provided.");
        if (isMounted) {
          setError("No deck ID available.");
          setIsLoading(false);
        }
        return;
      }
      setIsLoading(true);
      setError(null);
      setDeck(null); // Reset deck state on new load attempt
      setStudyCards([]);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      console.log(`useStudySession: Attempting load for deck ${deckId}, Retry: ${retryCountRef.current}`);

      try {
        result = await getDeck(deckId);

        if (!isMounted) return;

        if (result.error) {
          console.error("useStudySession: Failed to load deck:", result.error);
          toast.error("Error Loading Deck", {
            description: result.error.message || "Could not load the requested deck.",
          });
          setError(result.error.message || "Could not load deck.");
          setDeck(null);
          setStudyCards([]);
        } else if (result.data) {
          console.log("useStudySession: Deck loaded successfully:", result.data.name);
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
            retryCountRef.current = 0; // Reset retry count on success
          }
        } else {
          // Handle case where data is null but no error (deck not found)
          if (retryCountRef.current < MAX_DECK_LOAD_RETRIES) {
            retryCountRef.current++;
            console.log(`useStudySession: Deck ${deckId} not found. Retrying...`);
            setTimeout(() => { if (isMounted) attemptLoad(); }, DECK_LOAD_RETRY_DELAY_MS);
            return; // Don't set loading false yet, we are retrying
          } else {
            console.error(`useStudySession: Deck ${deckId} not found after retries.`);
            toast.error("Deck Not Found", {
              description: "The requested deck could not be found.",
            });
            setError("Deck not found.");
            setDeck(null);
            setStudyCards([]);
          }
        }
      } catch (err) {
        console.error("useStudySession: Unexpected error during load:", err);
        toast.error("Loading Error", {
          description: err instanceof Error ? err.message : "An unexpected error occurred.",
        });
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
        setDeck(null);
        setStudyCards([]);
      } finally {
        if (isMounted && (result?.data || result?.error || retryCountRef.current >= MAX_DECK_LOAD_RETRIES)) {
          setIsLoading(false);
          console.log("useStudySession: Loading process finished.");
        }
      }
    };

    attemptLoad();

    return () => { isMounted = false; };
  }, [deckId, settings, getDeck]); // Include settings as dependency for prepareStudyCards

  // --- Action: Flip Card ---
  const flipCard = useCallback(() => {
    if (isTransitioning || !currentStudyCard) return;
    setIsFlipped((prev) => !prev);
  }, [isTransitioning, currentStudyCard]);

  // --- Action: Handle Answer (Correct/Incorrect) ---
  const handleAnswer = useCallback(async (isCorrect: boolean) => {
    if (isTransitioning || !currentStudyCard || !deck) return;

    setIsTransitioning(true);

    // 1. Update card statistics in local deck state
    let updatedCard: FlashCard | null = null;
    const updatedCards = deck.cards.map((card) => {
      if (card.id === currentStudyCard.id) {
        // Calculate updated counts and time
        const newCorrectCount = isCorrect ? (card.correctCount || 0) + 1 : (card.correctCount || 0);
        const newIncorrectCount = !isCorrect ? (card.incorrectCount || 0) + 1 : (card.incorrectCount || 0);
        const newAttemptCount = (card.attemptCount || 0) + 1;
        const newLastStudied = new Date().toISOString();

        // Create a temporary card object with updated stats to calculate the new score
        const tempUpdatedCard: FlashCard = {
          ...card,
          correctCount: newCorrectCount,
          incorrectCount: newIncorrectCount,
          attemptCount: newAttemptCount,
          lastStudied: newLastStudied, // Pass string here for score calc
        };
        const newDifficultyScore = calculateDifficultyScore(tempUpdatedCard);

        // Final updated card object
        updatedCard = {
          ...card,
          correctCount: newCorrectCount,
          incorrectCount: newIncorrectCount,
          attemptCount: newAttemptCount,
          lastStudied: newLastStudied,
          difficultyScore: newDifficultyScore, // Include the updated score
        };
        return updatedCard;
      }
      return card;
    });

    if (!updatedCard) { 
      console.error("useStudySession: Could not find card to update locally.");
      setIsTransitioning(false);
      return; 
    }

    const updatedDeck = { ...deck, cards: updatedCards };
    setDeck(updatedDeck); // Update state with the deck containing the fully updated card

    // 2. Debounce save operation (remains the same, using updatedDeck)
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      console.log("useStudySession: Saving updated deck...");
      const saveResult = await updateDeck(updatedDeck);
      if (saveResult.error) {
        console.error("useStudySession: Failed to save deck updates:", saveResult.error);
        toast.error("Save Error", { description: "Could not save study progress." });
      }
    }, 1500);

    // 3. Session Logic: Determine next card index correctly
    const masteryThreshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
    const cardJustMastered = isCorrect && (updatedCard.correctCount ?? 0) >= masteryThreshold;
    const shouldRemoveMastered = settings?.removeMasteredCards ?? false;

    let nextStudyCards = [...studyCards];
    let nextIndex = currentCardIndex;

    if (cardJustMastered && shouldRemoveMastered) {
      console.log(`useStudySession: Card ${currentStudyCard.id} mastered and will be removed.`);
      nextStudyCards = studyCards.filter(card => card.id !== currentStudyCard.id);
      nextIndex = Math.min(currentCardIndex, nextStudyCards.length - 1);
    } else {
      if (studyCards.length > 0) {
         nextIndex = (currentCardIndex + 1) % studyCards.length;
      }
    }

    // 4. Transition to next card state
    setTimeout(() => {
      if (cardJustMastered && shouldRemoveMastered) {
         setStudyCards(nextStudyCards); 
      }
      setCurrentCardIndex(nextIndex); 
      setIsFlipped(false);
      setIsTransitioning(false);
      console.log(`useStudySession: Moving to card index ${nextIndex} in study list of length ${nextStudyCards.length}`);
    }, FLIP_ANIMATION_MIDPOINT_MS); 

  }, [currentStudyCard, deck, isTransitioning, updateDeck, studyCards, settings, currentCardIndex]);

  const markCorrect = useCallback(() => handleAnswer(true), [handleAnswer]);
  const markIncorrect = useCallback(() => handleAnswer(false), [handleAnswer]);

  // --- Action: Restart with Difficult Cards ---
  const restartDifficult = useCallback(() => {
    if (!deck) return;

    const difficultCards = prepareDifficultCards(deck.cards, settings);
    if (difficultCards.length === 0) {
      toast.info("No difficult cards found to practice!");
      return;
    }

    console.log("useStudySession: Restarting with difficult cards.");
    setStudyCards(difficultCards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsTransitioning(false); // Ensure transition state is reset
    setError(null);
    
  }, [deck, settings]);

  // --- Action: Reset Progress for the Deck ---
  const resetProgress = useCallback(async () => {
    if (!deck) {
      toast.error("Cannot reset progress: Deck not loaded.");
      return;
    }

    console.log("useStudySession: Resetting progress for deck:", deck.name);
    const resetCards = deck.cards.map((card) => ({
      ...card,
      correctCount: 0,
      incorrectCount: 0,
      lastStudied: null, // Reset last studied time
      // Reset other stats if necessary (e.g., attemptCount, difficultyScore)
    }));

    const resetDeck: Deck = {
      ...deck,
      cards: resetCards,
    };

    // Optimistic UI update
    setDeck(resetDeck);
    // Re-prepare study cards based on the reset deck
    const initialStudyCards = prepareStudyCards(resetCards, settings);
    setStudyCards(initialStudyCards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setError(null);
    setIsTransitioning(false);

    // Persist the changes
    try {
      const result = await updateDeck(resetDeck);
      if (result.error) {
        toast.error("Error Resetting Progress", {
          description: result.error.message || "Could not save reset progress.",
        });
        // TODO: Consider reverting optimistic update on error
      } else {
        toast.success("Progress Reset", {
          description: `Progress for "${deck.name}" has been reset.`,
        });
      }
    } catch (err) {
      console.error("useStudySession: Unexpected error resetting progress:", err);
      toast.error("Error Resetting Progress", {
        description: "An unexpected error occurred while saving.",
      });
      // TODO: Consider reverting optimistic update
    }
  }, [deck, updateDeck, settings]);

  // --- Return Hook State and Actions ---
  return {
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
    // Actions
    flipCard,
    markCorrect,
    markIncorrect,
    restartDifficult,
    resetProgress,
  };
} 