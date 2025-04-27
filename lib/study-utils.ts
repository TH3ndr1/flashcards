// src/lib/study-utils.ts
import type { FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider";
import type { Deck } from "@/types/deck";

// --- Constants ---
// Default value, but actual threshold comes from settings
export const DEFAULT_MASTERY_THRESHOLD = 3;
export const STUDY_SAVE_DEBOUNCE_MS = 2000; // Debounce delay for saving study progress
export const TTS_DELAY_MS = 100;
export const DECK_LOAD_RETRY_DELAY_MS = 500;
export const MAX_DECK_LOAD_RETRIES = 5;
export const FLIP_ANIMATION_MIDPOINT_MS = 150;
export const FLIP_ANIMATION_DURATION_MS = 300; // Should match your CSS flip animation duration

// --- Difficulty Score Constants ---
export const DIFFICULTY_WEIGHTS = {
  INCORRECT_RATIO: 0.8,  // Heaviest weight on failure rate
  ATTEMPTS: 0.1,         // Some weight for exposure/effort
  FORGETFULNESS: 0.1     // Weight for time decay
} as const;

export const DAYS_FOR_MAX_FORGETFULNESS = 5; // Time window for forgetting
export const ATTEMPTS_NORMALIZATION_FACTOR = 5; // Constant C for attempt normalization

export const DIFFICULTY_THRESHOLD = 0.55; // Score above which a card is considered difficult

// --- Helper Functions ---

/**
 * Prepares cards for a study session, excluding mastered cards and applying weighted randomization.
 */
export const prepareStudyCards = (cards: FlashCard[], settings?: Settings | null): FlashCard[] => {
  if (!Array.isArray(cards)) return [];

  const threshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;

  const availableCards = cards.filter(
    (card) => card && (card.correctCount || 0) < threshold
  );

  if (availableCards.length === 0) return [];

  // Weight cards: less known cards (lower correctRatio) get higher weight
  const weightedCards = availableCards.map((card) => {
    const correct = card.correctCount || 0;
    const incorrect = card.incorrectCount || 0;
    // Add 1 to denominator to avoid division by zero and give unstudied cards a weight
    const correctRatio = correct / (correct + incorrect + 1);
    // Higher weight for lower correctRatio
    const weight = 1 - correctRatio;
    return { card, weight };
  });

  // Sort by weight (descending), adding randomness for similar weights
  weightedCards.sort((a, b) => {
    const weightDiff = b.weight - a.weight;
    // If weights are close, introduce random shuffling
    if (Math.abs(weightDiff) < 0.2) {
      return Math.random() - 0.5;
    }
    return weightDiff;
  });

  return weightedCards.map((wc) => wc.card);
};

/**
 * Calculates the mastery count for a given set of cards.
 */
export const calculateMasteredCount = (cards: FlashCard[], settings?: Settings | null): number => {
  if (!Array.isArray(cards)) return 0;
  const threshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
  return cards.filter((card) => card && (card.correctCount || 0) >= threshold).length;
};



/**
 * Determines the next state of the study session (next card index and updated study card list).
 *
 * @param currentStudyCards The current array of cards being studied.
 * @param currentCardIndex The index of the card just answered.
 * @param answeredCard The card that was just answered, with its *updated* statistics.
 * @param masteryThreshold The number of correct answers required for mastery.
 * @returns An object containing the next study cards array and the next card index.
 */
export const determineNextCardState = (
  currentStudyCards: FlashCard[],
  currentCardIndex: number,
  answeredCard: FlashCard,
  masteryThreshold: number
): { nextStudyCards: FlashCard[]; nextIndex: number; cardJustMastered: boolean } => {
  let nextStudyCards = [...currentStudyCards];
  let nextIndex = currentCardIndex;
  let cardJustMastered = false;

  // Check if the *updated* answered card meets the mastery threshold
  if (answeredCard.correctCount >= masteryThreshold) {
    cardJustMastered = true;
    console.log(`study-utils: Card ${answeredCard.id} mastered and will be removed.`);
    // Filter based on the ID of the card that was just answered
    nextStudyCards = currentStudyCards.filter(card => card.id !== answeredCard.id);
    // Adjust index: stay at current index if it's still valid, otherwise wrap or go to 0
    nextIndex = Math.min(currentCardIndex, nextStudyCards.length - 1);
    if (nextIndex < 0) nextIndex = 0; // Handle empty list case
  } else {
    // Standard progression: Move to the next card, wrapping around
    if (currentStudyCards.length > 0) {
      // Ensure the calculation only happens if there are cards to cycle through
      // Use the length of the *original* list before potential filtering
      nextIndex = (currentCardIndex + 1) % currentStudyCards.length;
    }
    // If the list became empty *before* this answer (shouldn't normally happen here, but safety check)
    if (nextStudyCards.length === 0) {
        nextIndex = 0;
    }

  }

  return { nextStudyCards, nextIndex, cardJustMastered };
};

/**
 * Creates the necessary state components for resetting a deck's progress.
 * Does not perform side effects (like saving).
 *
 * @param deck The current deck object.
 * @param settings User settings (needed for prepareStudyCards).
 * @returns An object containing the deck with reset progress and the initial study cards list.
 */
export const createResetDeckState = (deck: Deck, settings: Settings | null): { resetDeck: Deck; initialStudyCards: FlashCard[] } => {
  console.log("study-utils: Preparing reset state for deck:", deck.name);

  const resetCards = deck.cards.map((card) => ({
    ...card,
    correctCount: 0,
    incorrectCount: 0,
    lastStudied: null,
    attemptCount: 0,
    difficultyScore: 0,
  }));

  const resetDeck: Deck = {
    ...deck,
    cards: resetCards,
    progress: { ...deck.progress}, // Ensure difficult mode flag is reset
  };

  // Re-prepare study cards based on the newly reset deck data
  const initialStudyCards = prepareStudyCards(resetCards, settings);

  return { resetDeck, initialStudyCards };
};
