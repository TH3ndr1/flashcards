// src/lib/study-utils.ts
import type { FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider";
import type { Deck, Card, StudyProgress, StudySettings, CardGroups } from "@/types/deck";

// --- Constants ---
/** Default mastery threshold when settings are not available */
export const DEFAULT_MASTERY_THRESHOLD = 3;
/** Debounce delay (in ms) for saving study progress */
export const STUDY_SAVE_DEBOUNCE_MS = 2000;
/** Delay (in ms) before triggering text-to-speech */
export const TTS_DELAY_MS = 100;
/** Delay (in ms) between deck load retries */
export const DECK_LOAD_RETRY_DELAY_MS = 500;
/** Maximum number of deck load retry attempts */
export const MAX_DECK_LOAD_RETRIES = 5;
/** Midpoint (in ms) of the card flip animation */
export const FLIP_ANIMATION_MIDPOINT_MS = 150;
/** Total duration (in ms) of the card flip animation - should match CSS */
export const FLIP_ANIMATION_DURATION_MS = 300;

// --- Difficulty Score Constants ---
/** Weights used in difficulty score calculation */
export const DIFFICULTY_WEIGHTS = {
  INCORRECT_RATIO: 0.8,  // Heaviest weight on failure rate
  ATTEMPTS: 0.1,         // Some weight for exposure/effort
  FORGETFULNESS: 0.1     // Weight for time decay
} as const;

/** Number of days after which a card reaches maximum forgetfulness score */
export const DAYS_FOR_MAX_FORGETFULNESS = 5;
/** Normalization factor for attempt count in difficulty calculation */
export const ATTEMPTS_NORMALIZATION_FACTOR = 5;

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
 * Creates a new study session state with reset statistics.
 * 
 * @param deck - The deck to reset the study session for
 * @param settings - Study settings to apply
 * @returns Object containing the updated deck and cards to study
 * 
 * @example
 * ```typescript
 * const { updatedDeck, cardsToStudy } = createResetDeckState(deck, settings);
 * // Begin new study session with reset stats...
 * ```
 */
export function createResetDeckState(
  deck: Deck,
  settings: StudySettings
): { updatedDeck: Deck; cardsToStudy: FlashCard[] } {
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

  return { resetDeck, cardsToStudy: initialStudyCards };
}

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

/**
 * Determines if a card is due for review.
 * 
 * @param {Object} params - Card due check parameters
 * @param {Card} params.card - The card to check
 * @param {Date} [params.now] - The current date (defaults to now)
 * @returns {boolean} True if the card is due for review
 */
export function isCardDue({
  card,
  now = new Date(),
}: {
  card: Card;
  now?: Date;
}): boolean {
  // Implementation goes here
}

/**
 * Shuffles an array of cards using the Fisher-Yates algorithm.
 * 
 * @param {Card[]} cards - The array of cards to shuffle
 * @returns {Card[]} A new array containing the shuffled cards
 */
export function shuffleCards(cards: Card[]): Card[] {
  // Implementation goes here
}

/**
 * Calculates the estimated time remaining in a study session.
 * 
 * @param {Object} params - Time estimation parameters
 * @param {Card[]} params.remainingCards - Cards left to review
 * @param {number} params.averageTimePerCard - Average time spent per card in milliseconds
 * @returns {number} Estimated time remaining in milliseconds
 */
export function calculateEstimatedTimeRemaining({
  remainingCards,
  averageTimePerCard,
}: {
  remainingCards: Card[];
  averageTimePerCard: number;
}): number {
  // Implementation goes here
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * 
 * @param {number} durationMs - Duration in milliseconds
 * @returns {string} Formatted duration string (e.g., "5 min")
 */
export function formatDuration(durationMs: number): string {
  // Implementation goes here
}

/**
 * Checks if a study session should be completed based on progress and settings.
 * 
 * @param {Object} params - Session completion check parameters
 * @param {StudyProgress} params.progress - Current study progress
 * @param {StudySettings} params.settings - Study session settings
 * @returns {boolean} True if the session should be completed
 */
export function shouldCompleteSession({
  progress,
  settings,
}: {
  progress: StudyProgress;
  settings: StudySettings;
}): boolean {
  // Implementation goes here
}

/**
 * Calculates the success rate for a set of cards.
 * 
 * @param {Card[]} cards - The cards to analyze
 * @returns {number} Success rate as a percentage (0-100)
 */
export function calculateSuccessRate(cards: Card[]): number {
  // Implementation goes here
}

/**
 * Groups cards by their status (new, learning, review).
 * 
 * @param {Card[]} cards - The cards to group
 * @returns {CardGroups} Object containing arrays of cards grouped by status
 */
export function groupCardsByStatus(cards: Card[]): CardGroups {
  // Implementation goes here
}

/**
 * Updates the study state after a card has been reviewed.
 * 
 * @param params - Object containing current state and review information
 * @param params.currentState - Current study session state
 * @param params.cardId - ID of the card being reviewed
 * @param params.isCorrect - Whether the review was correct
 * @param params.settings - Study settings to apply
 * @returns Updated study session state
 * 
 * @example
 * ```typescript
 * const newState = updateStudyState({
 *   currentState,
 *   cardId: "card-123",
 *   isCorrect: true,
 *   settings
 * });
 * ```
 */
export function updateStudyState({
  currentState,
  cardId,
  isCorrect,
  settings,
}: {
  currentState: StudyProgress;
  cardId: string;
  isCorrect: boolean;
  settings: StudySettings;
}): StudyProgress {
  // Implementation goes here
}

/**
 * Calculates the next review date for a card based on its performance and settings.
 * 
 * @param params - Object containing card information and settings
 * @param params.card - The card to calculate next review for
 * @param params.isCorrect - Whether the current review was correct
 * @param params.settings - Study settings to apply
 * @returns Date object representing the next review date
 * 
 * @example
 * ```typescript
 * const nextReview = calculateNextReviewDate({
 *   card,
 *   isCorrect: true,
 *   settings
 * });
 * ```
 */
export function calculateNextReviewDate({
  card,
  isCorrect,
  settings,
}: {
  card: Card;
  isCorrect: boolean;
  settings: StudySettings;
}): Date {
  // Implementation goes here
}

/**
 * Determines if a study session has reached its daily limits based on settings.
 * 
 * @param params - Object containing progress and settings
 * @param params.progress - Current study progress
 * @param params.settings - Study settings containing daily limits
 * @returns True if daily limits have been reached, false otherwise
 * 
 * @example
 * ```typescript
 * const limitReached = hasReachedDailyLimits({
 *   progress: currentProgress,
 *   settings: studySettings
 * });
 * ```
 */
export function hasReachedDailyLimits({
  progress,
  settings,
}: {
  progress: StudyProgress;
  settings: StudySettings;
}): boolean {
  // Implementation goes here
}

/**
 * Prepares a subset of cards for study based on due dates and settings.
 * 
 * @param params - Object containing cards and settings
 * @param params.cards - Array of all available cards
 * @param params.settings - Study settings to apply
 * @param params.now - Optional current date (defaults to current time)
 * @returns Array of cards prepared for study
 * 
 * @example
 * ```typescript
 * const cardsForStudy = prepareStudyCards({
 *   cards: deckCards,
 *   settings: studySettings
 * });
 * ```
 */
export function prepareStudyCards({
  cards,
  settings,
  now = new Date(),
}: {
  cards: Card[];
  settings: StudySettings;
  now?: Date;
}): Card[] {
  // Implementation goes here
}

/**
 * Calculates the mastery level of a card based on its review history.
 * 
 * @param card - The card to calculate mastery for
 * @param settings - Study settings containing mastery thresholds
 * @returns Number between 0 and 1 representing mastery level
 * 
 * @example
 * ```typescript
 * const mastery = calculateCardMastery(card, settings);
 * console.log(`Card mastery: ${mastery * 100}%`);
 * ```
 */
export function calculateCardMastery(card: Card, settings: StudySettings): number {
// ... existing code ...
}

/**
 * Filters and sorts cards that are ready for review.
 * 
 * @param cards - Array of cards to filter
 * @param now - Optional current date (defaults to current time)
 * @returns Array of cards that are due for review, sorted by priority
 * 
 * @example
 * ```typescript
 * const dueCards = getDueCards(deckCards);
 * console.log(`${dueCards.length} cards due for review`);
 * ```
 */
export function getDueCards(cards: Card[], now = new Date()): Card[] {
// ... existing code ...
}

/**
 * Calculates study statistics for a set of cards.
 * 
 * @param cards - Array of cards to analyze
 * @returns Object containing various statistics (retention rate, average time, etc.)
 * 
 * @example
 * ```typescript
 * const stats = calculateStudyStats(completedCards);
 * console.log(`Retention rate: ${stats.retentionRate}%`);
 * ```
 */
export function calculateStudyStats(cards: Card[]): StudyStats {
// ... existing code ...
}

/**
 * Updates a card's review history with new review data.
 * 
 * @param params - Object containing card and review information
 * @param params.card - The card being reviewed
 * @param params.isCorrect - Whether the review was correct
 * @param params.timeSpent - Time spent on the review in milliseconds
 * @returns Updated card with new review history
 * 
 * @example
 * ```typescript
 * const updatedCard = updateCardReviewHistory({
 *   card,
 *   isCorrect: true,
 *   timeSpent: 15000
 * });
 * ```
 */
export function updateCardReviewHistory({
  card,
  isCorrect,
  timeSpent,
}: {
  card: Card;
  isCorrect: boolean;
  timeSpent: number;
}): Card {
// ... existing code ...
}

/**
 * Determines if a card should be buried based on related cards and settings.
 * 
 * @param params - Object containing card and settings information
 * @param params.card - The card to check
 * @param params.relatedCards - Array of related cards
 * @param params.settings - Study settings
 * @returns True if the card should be buried, false otherwise
 * 
 * @example
 * ```typescript
 * const shouldBury = shouldBuryCard({
 *   card,
 *   relatedCards: siblings,
 *   settings
 * });
 * ```
 */
export function shouldBuryCard({
  card,
  relatedCards,
  settings,
}: {
  card: Card;
  relatedCards: Card[];
  settings: StudySettings;
}): boolean {
// ... existing code ...
}