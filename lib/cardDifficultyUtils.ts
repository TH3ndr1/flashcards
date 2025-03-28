import type { FlashCard } from "@/types/deck"

// Constants for difficulty calculation
const WEIGHT_INCORRECT_RATIO = 0.6 // Heaviest weight on failure rate
const WEIGHT_ATTEMPTS = 0.2 // Some weight for exposure/effort
const WEIGHT_FORGETFULNESS = 0.2 // Weight for time decay
const DAYS_FOR_MAX_FORGETFULNESS = 5 // Time window for forgetting
const ATTEMPT_NORMALIZATION_FACTOR = 5 // Constant C for attempt normalization

/**
 * Calculates a difficulty score for a flashcard based on various factors.
 * @param card The flashcard to calculate difficulty for
 * @returns A score between 0 and 1, where higher values indicate greater difficulty
 */
export function calculateDifficultyScore(card: FlashCard): number {
  let score = 0.0

  // Factor 1: Incorrectness Ratio (60% weight)
  if (card.attemptCount > 0) {
    const incorrectRatio = card.incorrectCount / card.attemptCount
    score += WEIGHT_INCORRECT_RATIO * incorrectRatio
  }

  // Factor 2: Number of Attempts (20% weight)
  // Normalize attempts to prevent indefinite growth and give diminishing returns
  const attemptsFactor = card.attemptCount / (card.attemptCount + ATTEMPT_NORMALIZATION_FACTOR)
  score += WEIGHT_ATTEMPTS * attemptsFactor

  // Factor 3: Forgetfulness (20% weight)
  if (card.lastStudied) {
    const daysSinceReview = getDaysSinceDate(new Date(card.lastStudied))
    // Score increases linearly up to DAYS_FOR_MAX_FORGETFULNESS, then caps
    const forgetfulnessFactor = Math.min(1.0, daysSinceReview / DAYS_FOR_MAX_FORGETFULNESS)
    score += WEIGHT_FORGETFULNESS * forgetfulnessFactor
  } else {
    // Card never reviewed - give it a moderate forgetfulness boost
    score += WEIGHT_FORGETFULNESS * 0.5
  }

  return Math.min(1.0, score) // Ensure score doesn't exceed 1.0
}

/**
 * Helper function to calculate days between now and a given date
 */
function getDaysSinceDate(date: Date): number {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Returns an array of cards sorted by difficulty (most difficult first)
 * @param cards Array of flashcards to sort
 * @param limit Optional limit on number of cards to return
 * @returns Sorted array of cards
 */
export function getToughCards(cards: FlashCard[], limit?: number): FlashCard[] {
  const scoredCards = cards.map(card => ({
    card,
    score: calculateDifficultyScore(card)
  }))

  // Sort by difficulty score (descending)
  scoredCards.sort((a, b) => b.score - a.score)

  // Return cards up to the limit (or all if no limit specified)
  const selectedCards = scoredCards.slice(0, limit).map(sc => sc.card)
  return selectedCards
} 