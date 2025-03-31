import { addDays, startOfDay } from 'date-fns'; // Using date-fns for reliable date math

/**
 * Represents the relevant SRS state of a card before a review.
 * Matches fields from the 'cards' table data model.
 */
export interface Sm2InputCardState {
  srsLevel: number;           // Current repetition count (n)
  easinessFactor: number | null; // Current Easiness Factor (EF)
  intervalDays: number | null;    // Interval used to schedule *this* review (I(n-1))
}

/**
 * Represents the grade given by the user after reviewing a card.
 * Maps to buttons like: 1: Again, 2: Hard, 3: Good, 4: Easy
 */
export type ReviewGrade = 1 | 2 | 3 | 4;

/**
 * Represents the data payload needed to update the card's SRS state
 * in the database via the `progressActions.updateCardProgress` action.
 */
export interface Sm2UpdatePayload {
  srsLevel: number;           // The new repetition count (n')
  easinessFactor: number;     // The new Easiness Factor (EF')
  intervalDays: number;       // The new interval in days (I(n'))
  nextReviewDue: Date;        // The calculated next review date
  lastReviewGrade: ReviewGrade; // The grade that led to this update
  // Note: progressActions.updateCardProgress should also update 'last_reviewed_at'
}

// --- Constants Used ---
const MIN_EASINESS_FACTOR = 1.3;
const DEFAULT_EASINESS_FACTOR = 2.5;
const FIRST_INTERVAL = 1; // days
const SECOND_INTERVAL = 6; // days

/**
 * Calculates the next SM-2 state for a card based on the user's review grade.
 *
 * @param current The current SRS state of the card before review.
 * @param grade The user's assessment of recall difficulty (1=Again, 2=Hard, 3=Good, 4=Easy).
 * @returns An object containing the updated SRS fields (Sm2UpdatePayload) ready for saving.
 */
export function calculateSm2State(
  current: Sm2InputCardState,
  grade: ReviewGrade
): Sm2UpdatePayload {
  // Log input state
  console.log("[calculateSm2State] Input:", { current, grade });

  // Initialize values from input or defaults if first review
  const currentSrsLevel = current.srsLevel ?? 0; // Default to 0 if null/undefined
  const currentEasinessFactor = current.easinessFactor ?? DEFAULT_EASINESS_FACTOR;
  // If intervalDays is null/0 (e.g., first review or lapse), treat the previous interval as 0 for calculation purposes.
  const previousIntervalDays = current.intervalDays ?? 0;

  // Add defensive check for NaN input
  if (isNaN(currentSrsLevel) || isNaN(currentEasinessFactor) || isNaN(previousIntervalDays)) {
      console.error("[calculateSm2State] Invalid input detected (NaN):", { current });
      throw new Error("Invalid SRS input state for calculation.");
  }

  let newSrsLevel: number;
  let newEasinessFactor: number;
  let newIntervalDays: number;

  // --- Grade Handling ---

  // Case 1: Failed Recall (Grade 1: Again, or implicit Grade 2: Hard - Treat < 3 as fail)
  if (grade < 3) {
    // Reset repetition count
    newSrsLevel = 0;
    // Interval resets to the first interval
    newIntervalDays = FIRST_INTERVAL;
    // Keep the easiness factor the same (standard SM-2), but ensure it doesn't drop below minimum.
    newEasinessFactor = Math.max(MIN_EASINESS_FACTOR, currentEasinessFactor);

    // --- Adjustment for Grade 2 (Hard) --- 
    // Although SM-2's *original* formula doesn't explicitly reduce EF on fail, 
    // many implementations (like Anki's variant based on it) slightly reduce EF 
    // even on 'Hard' (grade 2 in our case) during relearning lapses. 
    // However, sticking strictly to the provided SM-2 formula for grade < 3:
    // No EF adjustment happens here, only reset of level/interval.
    // Let's stick to the formula as written in the doc for now.
    
  }
  // Case 2: Successful Recall (Grade 3: Good, 4: Easy)
  else {
    // Increment repetition count
    const levelBefore = currentSrsLevel;
    const typeBefore = typeof levelBefore;
    console.log(`[calculateSm2State] Before increment: currentSrsLevel=${levelBefore} (type: ${typeBefore})`);
    
    const numLevelBefore = Number(levelBefore); 
    const typeAfterCoercion = typeof numLevelBefore;
    console.log(`[calculateSm2State] Coerced value: numLevelBefore=${numLevelBefore} (type: ${typeAfterCoercion})`);
    
    // *** TEMPORARY DIAGNOSTIC: Hardcode result ***
    if (levelBefore === 3) {
       console.warn("[calculateSm2State] DIAGNOSTIC: Hardcoding newSrsLevel to 4");
       newSrsLevel = 4;
    } else {
       newSrsLevel = numLevelBefore + 1; 
    }
    // newSrsLevel = numLevelBefore; 
    // newSrsLevel += 1; 
    console.log(`[calculateSm2State] After increment attempt: newSrsLevel=${newSrsLevel} (type: ${typeof newSrsLevel})`);

    // Calculate new Easiness Factor (EF')
    // Map our 1-4 grade to the formula's conceptual 0-5 quality (q):
    // Grade 3 (Good) -> q=4
    // Grade 4 (Easy) -> q=5
    // (Grade 2 (Hard) maps to q=3 but is handled in the grade < 3 block above)
    const quality = grade + 1; // Map 3->4, 4->5
    // Standard SM-2 formula: EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))
    const efAdjustment = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    newEasinessFactor = Math.max(MIN_EASINESS_FACTOR, currentEasinessFactor + efAdjustment);

    // Calculate new Interval (I(n'))
    if (newSrsLevel === 1) {
      newIntervalDays = FIRST_INTERVAL;
    } else if (newSrsLevel === 2) {
      newIntervalDays = SECOND_INTERVAL;
    } else {
      // I(n) = I(n-1) * EF'
      // Use the interval that *led* to this review (previousIntervalDays)
      // Ensure previousIntervalDays is treated as > 0 for calculation after first two steps
      const intervalBase = (previousIntervalDays === 0 && currentSrsLevel >= 2) ? SECOND_INTERVAL : previousIntervalDays;
      newIntervalDays = Math.ceil(intervalBase * newEasinessFactor);
      // Safety check for excessively long intervals if needed
      // newIntervalDays = Math.min(newIntervalDays, MAX_INTERVAL_DAYS); 
    }
  }

  // --- Calculate Next Review Date ---
  // Add the new interval (in days) to today's date (at the start of the day).
  const reviewDate = startOfDay(new Date()); // Use start of today for consistency
  const nextReviewDue = addDays(reviewDate, newIntervalDays);

  // --- Return Payload ---
  const resultPayload = {
    srsLevel: newSrsLevel,
    easinessFactor: newEasinessFactor,
    intervalDays: newIntervalDays,
    nextReviewDue: nextReviewDue,
    lastReviewGrade: grade,
  };
  console.log("[calculateSm2State] Output:", resultPayload);
  return resultPayload;
}


/**
 * Selects the appropriate SRS calculation function based on the algorithm name.
 *
 * @param card The current card state (needs relevant fields for the chosen algorithm).
 * @param grade The user's review grade (1-4).
 * @param algorithm The name of the algorithm ('sm2' or 'fsrs').
 * @returns The calculated update payload object, or throws an error if algorithm is unknown.
 */
export function calculateNextSrsState(
  card: Sm2InputCardState, // Adjust type if FSRS needs different input
  grade: ReviewGrade,
  algorithm: 'sm2' | 'fsrs'
): Sm2UpdatePayload /* | FsrsUpdatePayload */ {
  switch (algorithm) {
    case 'sm2':
      return calculateSm2State(card, grade);
    case 'fsrs':
      // Placeholder for FSRS implementation
      console.warn("FSRS algorithm not yet implemented. Falling back to SM-2 for calculation.");
      // return calculateFsrsState(card, grade); // Call FSRS function when ready
      return calculateSm2State(card, grade); // Fallback for now
    default:
      console.error(`Unknown SRS algorithm: ${algorithm}. Defaulting to SM-2.`);
      // Fallback to SM-2 or throw a more specific error
      // throw new Error(`Unsupported SRS algorithm: ${algorithm}`);
      return calculateSm2State(card, grade);
  }
} 