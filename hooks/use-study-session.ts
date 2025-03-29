"use client"; // Hooks interacting with client-side state need this

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDecks } from "./use-decks";
// import { useTTS } from "./use-tts"; // No longer needed directly here
import { useDeckLoader } from "./useDeckLoader";
import { useStudyTTS } from "./useStudyTTS"; // <-- ADDED useStudyTTS import
import type { Deck, FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider"; // Assuming Settings type is exported
import { toast } from "sonner";
import {
  prepareStudyCards,
  calculateMasteredCount,
  DEFAULT_MASTERY_THRESHOLD,
  FLIP_ANIMATION_MIDPOINT_MS,
  // TTS_DELAY_MS, // Moved to useStudyTTS
  updateCardStats,
  determineNextCardState,
  createResetDeckState,
  createDifficultSessionState,
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
  const { updateDeck } = useDecks();
  // const { speak, setLanguage } = useTTS(); // REMOVED
  const { loadedDeck, isLoadingDeck, deckLoadError } = useDeckLoader(deckId);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [studyCards, setStudyCards] = useState<FlashCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (loadedDeck) {
      console.log("useStudySession: Initializing session with loaded deck:", loadedDeck.name);
      const initialStudyCards = prepareStudyCards(loadedDeck.cards, settings);
      setDeck(loadedDeck);
      setStudyCards(initialStudyCards);
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setIsTransitioning(false);
    } else {
      console.log("useStudySession: Resetting session state due to missing loadedDeck.");
      setDeck(null);
      setStudyCards([]);
      setCurrentCardIndex(0);
      setIsFlipped(false);
    }
  }, [loadedDeck]);

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
    const { prepareDifficultCards } = require('@/lib/study-utils');
    return prepareDifficultCards(deck.cards).length;
  }, [deck?.cards]);
  const isDifficultMode = useMemo(() => deck?.progress?.studyingDifficult ?? false, [deck]);
  const cardProgressText = useMemo(() => `${currentCardCorrectCount} / ${masteryThreshold} correct${currentCardCorrectCount >= masteryThreshold ? ' (Mastered!)' : ''}`, [currentCardCorrectCount, masteryThreshold]);
  const isFullDeckMastered = useMemo(() => {
    return !isLoadingDeck && totalCards > 0 && masteredCount >= totalCards;
  }, [isLoadingDeck, totalCards, masteredCount]);
  const isDifficultSessionComplete = useMemo(() => {
    if (!isDifficultMode || !deck) {
      return false;
    }
    if (studyCards.length === 0) {
      console.log("[useStudySession] isDifficultSessionComplete: TRUE (studyCards empty)");
      return true;
    }
    const allRemainingMastered = studyCards.every(studyCard => {
      const mainCardData = deck.cards.find(card => card.id === studyCard.id);
      return mainCardData && (mainCardData.correctCount || 0) >= masteryThreshold;
    });
    console.log(`[useStudySession] isDifficultSessionComplete: ${allRemainingMastered} (checked ${studyCards.length} cards)`);
    return allRemainingMastered;
  }, [isDifficultMode, deck, studyCards, masteryThreshold]);

  useStudyTTS({
    isEnabled: settings?.ttsEnabled,
    isLoading: isLoadingDeck, // Pass loading state from deck loader
    isTransitioning,
    currentStudyCard,
    deck,
    isFlipped,
  });

  const flipCard = useCallback(() => {
    if (isTransitioning || !currentStudyCard) return;
    setIsFlipped((prev) => !prev);
  }, [isTransitioning, currentStudyCard]);

  const handleAnswer = useCallback(async (isCorrect: boolean) => {
    if (isTransitioning || !currentStudyCard || !deck) return;
    setIsTransitioning(true);
    let updatedCard: FlashCard | null = null;
    const updatedCards = deck.cards.map((card) => {
      if (card.id === currentStudyCard.id) {
        updatedCard = updateCardStats(card, isCorrect);
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
    setDeck(updatedDeck);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      console.log("useStudySession: Saving updated deck...");
      const saveResult = await updateDeck(updatedDeck);
      if (saveResult.error) {
        console.error("useStudySession: Failed to save deck updates:", saveResult.error);
        toast.error("Save Error", { description: "Could not save study progress." });
      }
    }, 1500);

    const { nextStudyCards, nextIndex, cardJustMastered } = determineNextCardState(
      studyCards,
      currentCardIndex,
      updatedCard,
      masteryThreshold
    );

    setTimeout(() => {
      if (cardJustMastered) {
        setStudyCards(nextStudyCards);
      }
      setCurrentCardIndex(nextIndex);
      setIsFlipped(false);
      setIsTransitioning(false);
      console.log(`useStudySession: Moving to card index ${nextIndex} in study list of length ${nextStudyCards.length}`);
    }, FLIP_ANIMATION_MIDPOINT_MS);
  }, [currentStudyCard, deck, isTransitioning, updateDeck, studyCards, settings, currentCardIndex, masteryThreshold]);

  const answerCardCorrect = useCallback(() => handleAnswer(true), [handleAnswer]);
  const answerCardIncorrect = useCallback(() => handleAnswer(false), [handleAnswer]);

  const resetDeckProgress = useCallback(async () => {
    if (!deck) {
      toast.error("Cannot reset progress: Deck not loaded or session not initialized.");
      return;
    }
    const { resetDeck, initialStudyCards } = createResetDeckState(deck, settings);
    console.log("useStudySession: Applying reset state for deck:", deck.name);
    setDeck(resetDeck);
    setStudyCards(initialStudyCards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsTransitioning(false);
    try {
      const result = await updateDeck(resetDeck);
      if (result.error) {
        toast.error("Error Resetting Progress", { description: result.error.message || "Could not save reset progress." });
      } else {
        toast.success("Progress Reset", { description: `Progress for "${deck.name}" has been reset.` });
      }
    } catch (err) {
      console.error("useStudySession: Unexpected error resetting progress:", err);
      toast.error("Error Resetting Progress", { description: "An unexpected error occurred while saving." });
    }
  }, [deck, updateDeck, settings, setDeck]);

  const practiceDifficultCards = useCallback(() => {
    if (!deck) {
      toast.error("Cannot practice difficult cards: Deck not loaded or session not initialized.");
      return;
    }
    const difficultSessionState = createDifficultSessionState(deck);
    if (!difficultSessionState) {
      toast.info("No difficult cards found to practice!");
      return;
    }
    const { updatedDeck, difficultCardsToStudy } = difficultSessionState;
    console.log("useStudySession: Applying difficult session state.");
    setDeck(updatedDeck);
    setStudyCards(difficultCardsToStudy);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsTransitioning(false);
  }, [deck, setDeck]);

  return {
    deck,
    currentStudyCard,
    isFlipped,
    isLoading: isLoadingDeck,
    error: deckLoadError,
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
    flipCard,
    answerCardCorrect,
    answerCardIncorrect,
    practiceDifficultCards,
    resetDeckProgress,
  };
} 