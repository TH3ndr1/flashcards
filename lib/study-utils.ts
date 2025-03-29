// src/lib/study-utils.ts
import type { FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider";
import type { Deck } from "@/types/deck";

// --- Constants ---
// Default value, but actual threshold comes from settings
export const DEFAULT_MASTERY_THRESHOLD = 3;
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
 * Calculates a difficulty score for a flashcard based on performance metrics
 * Score ranges from 0 to 1, where higher scores indicate greater difficulty
 * Returns 0 if the card has been attempted less than 2 times
 */
export const calculateDifficultyScore = (card: FlashCard): number => {
  // Return 0 if card has less than 2 attempts
  if (!card.attemptCount || card.attemptCount < 2) {
    return 0;
  }

  let score = 0;

  // --- Factor 1: Incorrectness Ratio ---
  const incorrectRatio = card.incorrectCount / card.attemptCount;
  score += DIFFICULTY_WEIGHTS.INCORRECT_RATIO * incorrectRatio;

  // --- Factor 2: Number of Attempts (Normalized) ---
  const attemptsFactor = card.attemptCount / (card.attemptCount + ATTEMPTS_NORMALIZATION_FACTOR);
  score += DIFFICULTY_WEIGHTS.ATTEMPTS * attemptsFactor;

  // --- Factor 3: Forgetfulness (Time Since Last Review) ---
  if (card.lastStudied) {
    const lastStudiedDate = new Date(card.lastStudied);
    const now = new Date();
    const daysSinceReview = (now.getTime() - lastStudiedDate.getTime()) / (1000 * 60 * 60 * 24);
    const forgetfulnessFactor = Math.min(1.0, daysSinceReview / DAYS_FOR_MAX_FORGETFULNESS);
    score += DIFFICULTY_WEIGHTS.FORGETFULNESS * forgetfulnessFactor;
  } else {
    // Card never reviewed - give it a moderate forgetfulness boost
    score += DIFFICULTY_WEIGHTS.FORGETFULNESS * 0.5;
  }

  return Math.min(1, Math.max(0, score)); // Ensure score is between 0 and 1
};

/**
 * @returns {FlashCard[]} An array of flashcards considered difficult, sorted by difficulty.
 */
export const prepareDifficultCards = (cards: FlashCard[]): FlashCard[] => {
  if (!Array.isArray(cards)) return [];

  // 1. Filter cards that meet the difficulty threshold
  const difficultCards = cards.filter(card => (card.difficultyScore || 0) >= DIFFICULTY_THRESHOLD);

  if (difficultCards.length === 0) {
    return []; // Return early if no cards meet the threshold
  }

  // 2. Assign weights based on score for sorting
  const weightedCards = difficultCards.map((card) => {
    const difficultyWeight = card.difficultyScore || 0; // Already filtered, so score >= threshold
    return { card, weight: difficultyWeight };
  });

  // 3. Sort the filtered cards by difficulty weight (descending), with slight randomization
  weightedCards.sort((a, b) => {
    const weightDiff = b.weight - a.weight;
    // If weights are close, introduce random shuffling
    if (Math.abs(weightDiff) < 0.1) {
      return Math.random() - 0.5;
    }
    return weightDiff;
  });

  const result = weightedCards.map((wc) => wc.card);
  return result;
};

/**
 * Calculates updated statistics for a flashcard after an answer.
 * @param card The original card data.
 * @param isCorrect Whether the answer was correct.
 * @returns A new FlashCard object with updated statistics.
 */
export const updateCardStats = (card: FlashCard, isCorrect: boolean): FlashCard => {
  const newCorrectCount = isCorrect ? (card.correctCount || 0) + 1 : (card.correctCount || 0);
  const newIncorrectCount = !isCorrect ? (card.incorrectCount || 0) + 1 : (card.incorrectCount || 0);
  const newAttemptCount = (card.attemptCount || 0) + 1;
  const now = new Date();

  // Create a temporary card object with updated stats to calculate the new score
  const tempUpdatedCard: FlashCard = {
    ...card,
    correctCount: newCorrectCount,
    incorrectCount: newIncorrectCount,
    attemptCount: newAttemptCount,
    lastStudied: now,
  };
  const newDifficultyScore = calculateDifficultyScore(tempUpdatedCard);

  return {
    ...card,
    correctCount: newCorrectCount,
    incorrectCount: newIncorrectCount,
    attemptCount: newAttemptCount,
    lastStudied: now,
    difficultyScore: newDifficultyScore,
  };
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
    progress: { ...deck.progress, studyingDifficult: false }, // Ensure difficult mode flag is reset
  };

  // Re-prepare study cards based on the newly reset deck data
  const initialStudyCards = prepareStudyCards(resetCards, settings);

  return { resetDeck, initialStudyCards };
};

/**
 * Creates the necessary state components for starting a difficult card study session.
 * Identifies difficult cards, resets their progress *within the returned state*,
 * and marks the deck state for difficult mode.
 * Does not perform side effects (like saving).
 *
 * @param deck The current deck object.
 * @returns An object containing the deck updated for difficult mode (with partial resets)
 *          and the list of difficult cards to study.
 *          Returns null if no difficult cards are found.
 */
export const createDifficultSessionState = (
  deck: Deck
): { updatedDeck: Deck; difficultCardsToStudy: FlashCard[] } | null => {
  const difficultCards = prepareDifficultCards(deck.cards);
  if (difficultCards.length === 0) {
    console.log("study-utils: No difficult cards found to create session state.");
    return null; // Indicate no session could be started
  }

  console.log(`study-utils: Preparing difficult session state with ${difficultCards.length} cards.`);

  // Create a map for quick lookup of difficult card IDs
  const difficultCardIds = new Set(difficultCards.map(card => card.id));

  // Create a new array of cards where only the difficult ones have their progress reset
  const partiallyResetCards = deck.cards.map(card => {
    if (difficultCardIds.has(card.id)) {
      return {
        ...card,
        correctCount: 0,
        incorrectCount: 0,
        lastStudied: null, // Also reset lastStudied for score calculation consistency
        attemptCount: 0,
        difficultyScore: 0, // Reset score to ensure they aren't immediately filtered
      };
    }
    return card; // Keep non-difficult cards unchanged
  });

  // Create the updated deck state, marking it for difficult mode
  const updatedDeck: Deck = {
    ...deck,
    cards: partiallyResetCards, // Use the list with difficult cards reset
    progress: { ...deck.progress, studyingDifficult: true },
  };

  // The list of cards to actually cycle through in the UI is the original difficult cards list
  // The main deck state holds the *reset* progress for lookup when answering.
  return { updatedDeck, difficultCardsToStudy: difficultCards };
};