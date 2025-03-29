"use client"; // Hooks interacting with client-side state need this

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDecks } from "./use-decks";
import { useTTS } from "./use-tts";
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
  TTS_DELAY_MS, // Needed for TTS timing
} from "@/lib/study-utils";

/**
 * Props for the useStudySession hook.
 */
interface UseStudySessionProps {
  /** The ID of the deck to study. */
  deckId: string | undefined;
  /** User settings that affect the study session (e.g., mastery threshold, TTS). */
  settings: Settings | null;
}

/**
 * The state and actions returned by the useStudySession hook.
 */
interface StudySessionState {
  // Core State
  deck: Deck | null;
  currentStudyCard: FlashCard | undefined;
  isFlipped: boolean;
  isLoading: boolean;
  error: string | null;
  isTransitioning: boolean;
  isFullDeckMastered: boolean;
  isDifficultSessionComplete: boolean;

  // Derived Information
  totalCards: number;
  masteredCount: number;
  currentCardIndex: number; // Index within the current studyCards array
  studyCardsCount: number; // Count of cards currently in the study session
  overallProgressPercent: number;
  masteryProgressPercent: number;
  totalAchievedCorrectAnswers: number;
  totalRequiredCorrectAnswers: number;
  difficultCardsCount: number;
  isDifficultMode: boolean;
  cardProgressText: string;

  // Action Functions
  /** Flips the current card between question and answer. */
  flipCard: () => void;
  /** Marks the current card as correct and moves to the next. */
  answerCardCorrect: () => void;
  /** Marks the current card as incorrect and moves to the next. */
  answerCardIncorrect: () => void;
  /** Restarts the study session focusing only on difficult cards. */
  practiceDifficultCards: () => void;
  /** Resets all progress statistics for the current deck. */
  resetDeckProgress: () => Promise<void>;
}

/**
 * Custom hook to manage the state and logic for a flashcard study session.
 * Encapsulates deck loading, card progression, state updates, TTS, and persistence logic.
 *
 * @param deckId The ID of the deck to study.
 * @param settings User settings affecting the session.
 * @returns {StudySessionState} An object containing the session state and action functions.
 */
export function useStudySession({
  deckId,
  settings,
}: UseStudySessionProps): StudySessionState {
  const { getDeck, updateDeck, loading: useDecksLoading } = useDecks();
  const { speak, setLanguage } = useTTS();

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
  const isMountedRef = useRef(true);

  // --- Derived State Migration ---
  const totalCards = useMemo(() => deck?.cards?.length ?? 0, [deck]);
  const masteredCount = useMemo(() => calculateMasteredCount(deck?.cards ?? [], settings), [deck, settings]);
  const currentStudyCard = useMemo(() => studyCards?.[currentCardIndex], [studyCards, currentCardIndex]);
  const studyCardsCount = useMemo(() => studyCards.length, [studyCards]);
  const currentDeckCard = useMemo(() => deck?.cards.find(card => card.id === currentStudyCard?.id), [deck, currentStudyCard]);
  const currentCardCorrectCount = useMemo(() => currentDeckCard?.correctCount || 0, [currentDeckCard]);
  const masteryThreshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
  const totalRequiredCorrectAnswers = useMemo(() => totalCards * masteryThreshold, [totalCards, masteryThreshold]);
  const totalAchievedCorrectAnswers = useMemo(() => deck?.cards?.reduce((sum, card) => sum + (card.correctCount || 0), 0) ?? 0, [deck]);
  const overallProgressPercent = useMemo(() => totalRequiredCorrectAnswers > 0 ? Math.round((totalAchievedCorrectAnswers / totalRequiredCorrectAnswers) * 100) : 0, [totalAchievedCorrectAnswers, totalRequiredCorrectAnswers]);
  const masteryProgressPercent = useMemo(() => totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0, [masteredCount, totalCards]);
  const difficultCardsCount = useMemo(() => {
    if (!deck?.cards) return 0;
    // Rely on the same logic used for practicing them
    return prepareDifficultCards(deck.cards).length;
  }, [deck?.cards]);
  const isDifficultMode = useMemo(() => deck?.progress?.studyingDifficult ?? false, [deck]);
  const cardProgressText = useMemo(() => `${currentCardCorrectCount} / ${masteryThreshold} correct${currentCardCorrectCount >= masteryThreshold ? ' (Mastered!)' : ''}`, [currentCardCorrectCount, masteryThreshold]);
  const isFullDeckMastered = useMemo(() => {
    return !isLoading && totalCards > 0 && masteredCount >= totalCards;
  }, [isLoading, totalCards, masteredCount]);
  const isDifficultSessionComplete = useMemo(() => {
    if (!isDifficultMode || !deck || studyCards.length === 0) {
      return false; // Not in difficult mode or no cards to check
    }
    // Check if *every* card currently in the study list meets mastery in the main deck state
    return studyCards.every(studyCard => {
      const mainCardData = deck.cards.find(card => card.id === studyCard.id);
      // Ensure card exists and its correct count meets the threshold
      return mainCardData && (mainCardData.correctCount || 0) >= masteryThreshold;
    });
  }, [isDifficultMode, deck, studyCards, masteryThreshold]);

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
      // --- Crucial Check: Wait for useDecks (and thus Supabase client) to be ready --- 
      if (useDecksLoading) {
        console.log("useStudySession: Waiting for useDecks to finish loading...");
        // We don't set isLoading to false here, just wait for the next effect run
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
  }, [deckId, settings, getDeck, useDecksLoading]);

  // --- TTS Effects ---
  // Effect: Speak question
  useEffect(() => {
    // ... speak question logic placeholder ...
    console.log("Placeholder: TTS effect runs");
  }, [currentStudyCard, isFlipped, isLoading, isTransitioning, settings?.ttsEnabled, deck, setLanguage, speak]);

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

        // Create a temporary card object with updated stats to calculate the new score
        const tempUpdatedCard: FlashCard = {
          ...card,
          correctCount: newCorrectCount,
          incorrectCount: newIncorrectCount,
          attemptCount: newAttemptCount,
          lastStudied: new Date(), // Use Date object for score calc
        };
        const newDifficultyScore = calculateDifficultyScore(tempUpdatedCard);

        // Final updated card object
        updatedCard = {
          ...card,
          correctCount: newCorrectCount,
          incorrectCount: newIncorrectCount,
          attemptCount: newAttemptCount,
          lastStudied: new Date(), // Use Date object
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
      // --- Modification START ---
      // Create a version of the deck specifically for saving,
      // ensuring studyingDifficult is NOT persisted as true.
      // Revert: Save the actual updatedDeck state, including studyingDifficult status
      const saveResult = await updateDeck(updatedDeck); // Use the actual updatedDeck
      // --- Modification END ---
      if (saveResult.error) {
        console.error("useStudySession: Failed to save deck updates:", saveResult.error);
        toast.error("Save Error", { description: "Could not save study progress." });
      }
    }, 1500);

    // 3. Session Logic: Determine next card index correctly
    const shouldRemoveMastered = settings?.removeMasteredCards ?? false;

    let nextStudyCards = [...studyCards];
    let nextIndex = currentCardIndex;
    let cardJustMastered = false; // Flag to track if the current action mastered the card

    // Check if the *updated* card meets the mastery threshold
    if (updatedCard && (updatedCard as FlashCard).correctCount >= masteryThreshold) {
      cardJustMastered = true;
    }

    if (shouldRemoveMastered && cardJustMastered) {
      console.log(`useStudySession: Card ${currentStudyCard.id} mastered and will be removed.`);
      // Filter based on the ID of the card that was just answered
      nextStudyCards = studyCards.filter(card => card.id !== currentStudyCard.id);
      // Adjust index: stay at current index if it's still valid, otherwise wrap or go to 0
      nextIndex = Math.min(currentCardIndex, nextStudyCards.length - 1); // If cards removed, index might need adjustment
      if (nextIndex < 0) nextIndex = 0; // Handle empty list case
    } else {
      // Standard progression: Move to the next card, wrapping around
      if (studyCards.length > 0) {
         nextIndex = (currentCardIndex + 1) % studyCards.length;
      }
    }

    // 4. Transition to next card state
    setTimeout(() => {
      // Only update studyCards state if a card was actually removed
      if (shouldRemoveMastered && cardJustMastered) {
         setStudyCards(nextStudyCards);
      }
      setCurrentCardIndex(nextIndex);
      setIsFlipped(false);
      setIsTransitioning(false);
      console.log(`useStudySession: Moving to card index ${nextIndex} in study list of length ${nextStudyCards.length}`);
    }, FLIP_ANIMATION_MIDPOINT_MS);

  }, [currentStudyCard, deck, isTransitioning, updateDeck, studyCards, settings, currentCardIndex]);

  const answerCardCorrect = useCallback(() => handleAnswer(true), [handleAnswer]);
  const answerCardIncorrect = useCallback(() => handleAnswer(false), [handleAnswer]);

  // --- Action: Reset Progress for the Deck ---
  const resetDeckProgress = useCallback(async () => {
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
      attemptCount: 0, // Reset attempt count
      difficultyScore: 0, // Reset difficulty score to initial/neutral
    }));

    const resetDeck: Deck = {
      ...deck,
      cards: resetCards,
      progress: { ...deck.progress, studyingDifficult: false } // Ensure difficult mode is reset
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
  }, [deck, updateDeck, settings, setDeck]); // Added setDeck dependency

  // --- Action: Restart with Difficult Cards ---
  const practiceDifficultCards = useCallback(() => {
    if (!deck) return;

    const difficultCards = prepareDifficultCards(deck.cards);
    if (difficultCards.length === 0) {
      toast.info("No difficult cards found to practice!");
      return;
    }

    // --- Reset progress ONLY for the difficult cards --- 
    const difficultCardIds = new Set(difficultCards.map(card => card.id));
    const partiallyResetCards = deck.cards.map(card => {
      if (difficultCardIds.has(card.id)) {
        // Reset progress for this difficult card
        return {
          ...card,
          correctCount: 0,
          incorrectCount: 0,
          lastStudied: null,
          attemptCount: 0,
          difficultyScore: 0, // Reset score as well
        };
      }
      return card; // Keep non-difficult cards as they are
    });

    // Explicitly mark the deck state as studying difficult cards
    // Use the partially reset card list for the main deck state update
    const updatedDeck = {
      ...deck,
      cards: partiallyResetCards, // Use the cards with difficult ones reset
      progress: { ...deck.progress, studyingDifficult: true }
    };

    console.log("useStudySession: Restarting with difficult cards.");
    setDeck(updatedDeck); // Update the main deck state to reflect difficult mode & reset progress
    // Set the studyCards state with the list of difficult cards (before reset)
    // The view will get the actual card data (with reset progress) via currentFullCardData lookup
    setStudyCards(difficultCards); 
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsTransitioning(false); // Ensure transition state is reset
    setError(null);
    
    // Note: We are NOT persisting the studyingDifficult flag here, treating it as session-only.
    // If persistence is desired, an updateDeck call could be added.

  }, [deck, setDeck, settings]); // Add settings dependency for prepareStudyCards consistency

  // --- Return Hook State and Actions ---
  return {
    deck,
    currentStudyCard,
    isFlipped,
    isLoading,
    error,
    isTransitioning,
    isFullDeckMastered,
    isDifficultSessionComplete,
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
    // Actions
    flipCard,
    answerCardCorrect,
    answerCardIncorrect,
    practiceDifficultCards,
    resetDeckProgress,
  };
} 