// src/lib/study-utils.ts
import type { FlashCard } from "@/types/deck";

// --- Constants ---
// Exporting from here makes it the single source of truth
export const MASTERY_THRESHOLD = 3;
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

// --- Helper Functions ---

/**
 * Prepares cards for a study session, excluding mastered cards and applying weighted randomization.
 */
export const prepareStudyCards = (cards: FlashCard[]): FlashCard[] => {
  if (!Array.isArray(cards)) return [];

  const availableCards = cards.filter(
    (card) => card && (card.correctCount || 0) < MASTERY_THRESHOLD
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
export const calculateMasteredCount = (cards: FlashCard[]): number => {
  if (!Array.isArray(cards)) return 0;
  return cards.filter((card) => card && (card.correctCount || 0) >= MASTERY_THRESHOLD).length;
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