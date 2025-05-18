// lib/study-utils.ts
import type { Tables, Json } from "@/types/database";
import type { Settings } from "@/providers/settings-provider";

// Define type aliases for better readability using Tables from database types
type DbCard = Tables<'cards'>;

// Extend the deck type to include cards relationship.
// This local interface represents a deck object in memory that also holds its cards.
interface DbDeckWithCards extends Tables<'decks'> {
  cards: DbCard[];
}

// Constants (remain the same)
export const DEFAULT_MASTERY_THRESHOLD = 3;
export const STUDY_SAVE_DEBOUNCE_MS = 2000;
export const TTS_DELAY_MS = 100;
export const DECK_LOAD_RETRY_DELAY_MS = 500;
export const MAX_DECK_LOAD_RETRIES = 5;
export const FLIP_ANIMATION_MIDPOINT_MS = 150;
export const FLIP_ANIMATION_DURATION_MS = 300;

export const DIFFICULTY_WEIGHTS = {
  INCORRECT_RATIO: 0.8,
  ATTEMPTS: 0.1,
  FORGETFULNESS: 0.1
} as const;

export const DAYS_FOR_MAX_FORGETFULNESS = 5;
export const ATTEMPTS_NORMALIZATION_FACTOR = 5;
export const DIFFICULTY_THRESHOLD = 0.55;

/**
 * Prepares cards for a study session, excluding mastered cards and applying weighted randomization.
 */
export const prepareStudyCards = (cards: DbCard[], settings?: Settings | null): DbCard[] => {
  if (!Array.isArray(cards)) return [];

  const threshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;

  const availableCards = cards.filter(
    (card) => card && (card.correct_count ?? 0) < threshold // Use nullish coalescing for counts
  );

  if (availableCards.length === 0) return [];

  const weightedCards = availableCards.map((card) => {
    const correct = card.correct_count ?? 0;
    const incorrect = card.incorrect_count ?? 0;
    const correctRatio = correct / (correct + incorrect + 1);
    const weight = 1 - correctRatio;
    return { card, weight };
  });

  weightedCards.sort((a, b) => {
    const weightDiff = b.weight - a.weight;
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
export const calculateMasteredCount = (cards: DbCard[], settings?: Settings | null): number => {
  if (!Array.isArray(cards)) return 0;
  const threshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
  return cards.filter((card) => card && (card.correct_count ?? 0) >= threshold).length;
};

/**
 * Determines the next state of the study session.
 */
export const determineNextCardState = (
  currentStudyCards: DbCard[],
  currentCardIndex: number,
  answeredCard: DbCard, // Expects a full DbCard with updated stats
  masteryThreshold: number
): { nextStudyCards: DbCard[]; nextIndex: number; cardJustMastered: boolean } => {
  let nextStudyCards = [...currentStudyCards];
  let nextIndex = currentCardIndex;
  let cardJustMastered = false;

  if ((answeredCard.correct_count ?? 0) >= masteryThreshold) {
    cardJustMastered = true;
    console.log(`study-utils: Card ${answeredCard.id} mastered and will be removed.`);
    nextStudyCards = currentStudyCards.filter(card => card.id !== answeredCard.id);
    nextIndex = Math.min(currentCardIndex, nextStudyCards.length - 1);
    if (nextIndex < 0) nextIndex = 0;
  } else {
    if (currentStudyCards.length > 0) {
      nextIndex = (currentCardIndex + 1) % currentStudyCards.length;
    }
    if (nextStudyCards.length === 0) {
        nextIndex = 0;
    }
  }
  return { nextStudyCards, nextIndex, cardJustMastered };
};

/**
 * Creates the necessary state components for resetting a deck's progress.
 */
export const createResetDeckState = (deck: DbDeckWithCards, settings: Settings | null): { resetDeck: DbDeckWithCards; initialStudyCards: DbCard[] } => {
  console.log("study-utils: Preparing reset state for deck:", deck.name);

  const resetCards = deck.cards.map((card: DbCard) => ({
    ...card,
    correct_count: 0,
    incorrect_count: 0,
    last_reviewed_at: null, // Corrected from last_studied, matches DbCard type
    attempt_count: 0,
    difficulty_score: card.difficulty_score === undefined ? 0 : (card.difficulty_score ?? 0), // Handle potential undefined if not set
    // Also reset SRS fields for a full progress reset
    srs_level: 0,
    easiness_factor: settings?.defaultEasinessFactor ?? 2.5,
    interval_days: 0,
    learning_state: null,
    learning_step_index: null,
    failed_attempts_in_learn: 0,
    hard_attempts_in_learn: 0,
    next_review_due: null,
    last_review_grade: null,
  }));

  const resetDeck: DbDeckWithCards = {
    ...deck,
    cards: resetCards,
    // progress field from Tables<'decks'> is Json, pass it as is or reset its sub-fields
    // Assuming we keep the existing Json blob structure and just reset card-specific parts
    progress: deck.progress, // Or reset: { streak: 0, correct: 0, incorrect: 0, lastStudied: null } if progress has a known structure
  };

  const initialStudyCards = prepareStudyCards(resetCards, settings);

  return { resetDeck, initialStudyCards };
};