// lib/srs.ts
import { addDays, addMinutes, startOfDay, isAfter } from 'date-fns';
import type { Settings } from "@/providers/settings-provider"; // Import the correct Settings type
import { appLogger, statusLogger } from '@/lib/logger';



/**
 * Represents the relevant SRS state of a card before a review or step calculation.
 * Matches necessary fields from the 'cards' table data model + internal state.
 */
export interface Sm2InputCardState {
  srsLevel: number;               // Current repetition count (n)
  easinessFactor: number;         // Current Easiness Factor (EF). Assuming NOT NULL after first review/graduation.
  intervalDays: number;           // Interval used to schedule *this* review (I(n-1)). Can be fractional for step intervals.
  learningState: 'learning' | 'relearning' | null; // Current phase
  learningStepIndex: number | null; // Current step index within learning/relearning
  nextReviewDue?: Date | string | null; // ADD this field, make optional for flexibility
  // failedAttemptsInLearn and hardAttemptsInLearn are tracked by the hook, not part of this input state object
}

/**
 * Represents the grade given by the user after reviewing a card.
 */
export type ReviewGrade = 1 | 2 | 3 | 4;

/**
 * Represents the data payload needed to update the card's SRS state
 * in the database. Contains the *next* state fields.
 */
export interface Sm2UpdatePayload {
  srsLevel: number;           // The new repetition count (n')
  easinessFactor: number;     // The new Easiness Factor (EF')
  intervalDays: number;       // The new interval in days (I(n')). Can be fractional.
  nextReviewDue: Date;        // The calculated next review date/time.
  lastReviewGrade: ReviewGrade; // The grade that led to this update. (Hook sets this)
  learningState: 'learning' | 'relearning' | null; // The new phase
  learningStepIndex: number | null; // The new step index

  // Note: failedAttemptsInLearn and hardAttemptsInLearn are *not* included here.
  // The hook manages and updates these counters separately based on grades in the 'learning' state.
}


// --- Core SM-2 Calculation (for Review State Progression or Lapse) ---
/**
 * Calculates the next SM-2 state for a card that is currently in the
 * standard Review phase (srsLevel >= 1, learningState === null).
 * Also handles the transition FROM Review TO Relearning on Grade 1 (Lapse).
 *
 * @param current The current SRS state of the card before review (must have srsLevel >= 1).
 * @param grade The user's assessment of recall difficulty (1-4).
 * @param settings The user's application settings.
 * @returns An object containing the updated SRS fields (Sm2UpdatePayload).
 */
export function calculateSm2State(
  current: Sm2InputCardState,
  grade: ReviewGrade,
  settings: Settings // Use imported Settings type
): Sm2UpdatePayload {
  // This function should *only* be called for cards with current.srsLevel >= 1
  if (current.srsLevel < 1) {
       appLogger.error("[calculateSm2State] Called with card not in Review state (srsLevel < 1). This function is for Review -> Review or Review -> Relearning transitions only.", current);
       // Return a default or throw, depending on desired error handling.
       // Returning current state as a fallback (might not be desired):
       return {
            srsLevel: current.srsLevel,
            easinessFactor: current.easinessFactor,
            intervalDays: current.intervalDays,
            nextReviewDue: current.nextReviewDue ? new Date(current.nextReviewDue) : addDays(startOfDay(new Date()), 1),
            lastReviewGrade: grade,
            learningState: current.learningState,
            learningStepIndex: current.learningStepIndex,
       };
  }

  const currentEasinessFactor = current.easinessFactor; // srsLevel >= 1 implies EF is not null
  const previousIntervalDays = current.intervalDays; // srsLevel >= 1 implies interval is not null

  let newSrsLevel: number;
  let newEasinessFactor: number;
  let newIntervalDays: number; // Will be integer days for review intervals
  let newLearningState: 'learning' | 'relearning' | null = null; // Default to staying in Review
  let newLearningStepIndex: number | null = null; // Default to not being in steps

  const quality = grade + 1; // Map 1->2, 2->3, 3->4, 4->5 for standard EF formula

  // --- Calculate New Easiness Factor ---
  // This formula applies regardless of lapse vs. success in Review
  const efDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  newEasinessFactor = Math.max(settings.minEasinessFactor, currentEasinessFactor + efDelta);


  // --- Handle Lapse (Grade 1 from Review) ---
  if (grade === 1) {
      appLogger.info("[calculateSm2State] Grade 1 (Again) in Review. Lapsing to Relearning.");
      const relearningIntervalMinutes = settings.relearningStepsMinutes[0]; // First relearning step
      const nextReviewDue = addMinutes(new Date(), relearningIntervalMinutes);

      newSrsLevel = 0; // Reset level on lapse
      // EF penalty already applied above as part of standard EF calculation
      newIntervalDays = relearningIntervalMinutes / (60 * 24); // Store interval as fractional days
      newLearningState = 'relearning'; // Card is now in relearning state
      newLearningStepIndex = 0; // Start at step 0 of relearning

      return {
        srsLevel: newSrsLevel,
        easinessFactor: newEasinessFactor, // Penalized EF
        intervalDays: newIntervalDays, // Fractional days
        nextReviewDue: nextReviewDue,
        lastReviewGrade: grade, // Hook sets this
        learningState: newLearningState,
        learningStepIndex: newLearningStepIndex,
      };
  }

  // --- Handle Success (Grade 2, 3, or 4 from Review) ---
  appLogger.info(`[calculateSm2State] Grade ${grade} (Hard/Good/Easy) in Review. Successful recall.`);
  newSrsLevel = current.srsLevel + 1; // Increment level for successful review

  // Calculate next interval based on Anki's SM-2 interpretation for review phase (level >= 1 -> next level >= 2)
  let intervalBase: number;
  if (current.srsLevel === 1) { // Transitioning from level 1 to 2 (first successful review to second)
       intervalBase = 6; // This is I(2) in Anki, based on I(1)=1. Interval is fixed.
  } else { // Transitioning from level >= 2 to >= 3 (standard review growth)
      intervalBase = previousIntervalDays; // Base interval is the previous interval
  }

  const multiplier = (grade === 2) ? 1.2 : newEasinessFactor; // Anki Hard multiplier (1.2), otherwise use the new EF

  newIntervalDays = Math.round(intervalBase * multiplier);


  // Ensure interval is at least 1 day for Review phase
  newIntervalDays = Math.max(1, newIntervalDays);
  // Ensure new srsLevel is at least 1 (as we are in Review) - should be >= 2 here anyway
  newSrsLevel = Math.max(1, newSrsLevel);


  const nextReviewDue = addDays(startOfDay(new Date()), newIntervalDays);

  return {
    srsLevel: newSrsLevel, // Incremented level
    easinessFactor: newEasinessFactor, // Updated EF
    intervalDays: newIntervalDays, // Integer days
    nextReviewDue: nextReviewDue,
    lastReviewGrade: grade, // Hook sets this
    learningState: null, // Stays in Review
    learningStepIndex: null, // Not in steps
  };
}


// --- NEW Helper Function: Calculation for Initial EF upon Graduation ---
/**
 * Calculates the initial Easiness Factor when a card graduates from
 * the Initial Learning state based on its performance during learning.
 *
 * @param failedAttempts Total Grade 1s ('Again') received during the initial learning phase for this card.
 * @param hardAttempts Total Grade 2s ('Hard') received during the initial learning phase for this card.
 * @param settings The user's application settings.
 * @returns The calculated initial EF (min 1.3).
 */
export function calculateInitialEasinessFactor(
    failedAttempts: number, // Total Grade 1s in initial learning state for this card
    hardAttempts: number,   // Total Grade 2s in initial learning state for this card
    settings: Settings // Use imported Settings type
): number {
    let ef = settings.defaultEasinessFactor;
    ef -= failedAttempts * settings.learnAgainPenalty; // Subtract penalty for each 'Again'
    ef -= hardAttempts * settings.learnHardPenalty;   // Subtract penalty for each 'Hard' (smaller penalty)
    return Math.max(settings.minEasinessFactor, ef); // Ensure it doesn't go below minimum
}

// --- NEW Helper Function: Calculate Next Step in Initial Learning (Standard SM-2 Mode) ---
/**
 * Calculates the next step and due time for a card in the Initial Learning state
 * when using the Standard SM-2 learning algorithm (`settings.studyAlgorithm === 'standard-sm2'`).
 *
 * @param currentStepIndex The card's current step index (0-based) within settings.initialLearningStepsMinutes.
 * @param grade The user's assessment of recall difficulty (1-4).
 * @param settings The user's application settings.
 * @returns An object indicating the next step index (or 'graduated'), its due time, and the step's interval in minutes.
 */
export function calculateNextStandardLearnStep(
    currentStepIndex: number,
    grade: ReviewGrade,
    settings: Settings // Use imported Settings type
): { nextStepIndex: number | 'graduated'; nextDueTime: Date; intervalMinutes: number | null; } {
    const steps = settings.initialLearningStepsMinutes;
    let nextStepIndex: number | 'graduated';
    let intervalMinutes: number | null = null; // The interval for the *next* step

    if (!steps || steps.length === 0) {
        appLogger.error("Standard learning steps not defined or empty in settings. Graduating immediately.");
        return { nextStepIndex: 'graduated', nextDueTime: new Date(), intervalMinutes: null };
    }

    if (grade === 1) { // Again: Go back to first step
        nextStepIndex = 0;
        intervalMinutes = steps[0];
    } else if (grade === 4) { // Easy: Skip all steps and graduate
        nextStepIndex = 'graduated';
        intervalMinutes = null; // Graduation interval handled by createGraduationPayload
    } else { // Hard (2) or Good (3): Move forward
        // Hard moves one step (current + 1)
        // Good moves two steps (current + 2) - standard Anki behavior for steps > 1
        const stepsToAdvance = (grade === 2) ? 1 : 2;
        const potentialNextIndex = currentStepIndex + stepsToAdvance;

        if (potentialNextIndex >= steps.length) {
            nextStepIndex = 'graduated'; // Completed steps
            intervalMinutes = null; // Graduation interval handled by createGraduationPayload
        } else {
            nextStepIndex = potentialNextIndex;
            intervalMinutes = steps[nextStepIndex];
        }
    }

    const nextDueTime = nextStepIndex === 'graduated'
        ? new Date() // Card is immediately due for graduation processing
        : addMinutes(new Date(), intervalMinutes!); // Card is due after the step interval

    return { nextStepIndex, nextDueTime, intervalMinutes };
}


// --- NEW Helper Function: Calculate Next Step in Relearning ---
/**
 * Calculates the next step and due time for a card in the Relearning state (`learning_state = 'relearning'`).
 *
 * @param currentStepIndex The card's current step index (0-based) within settings.relearningStepsMinutes.
 * @param grade The user's assessment of recall difficulty (1-4).
 * @param settings The user's application settings.
 * @returns An object indicating the next step index (or 'graduatedFromRelearning'), its due time, and the step's interval in minutes.
 */
export function calculateNextRelearningStep(
    currentStepIndex: number,
    grade: ReviewGrade, // Note: Grades 2, 3, 4 often behave similarly in relearning
    settings: Settings // Use imported Settings type
): { nextStepIndex: number | 'graduatedFromRelearning'; nextDueTime: Date; intervalMinutes: number | null; } {
    const steps = settings.relearningStepsMinutes;
    let nextStepIndex: number | 'graduatedFromRelearning';
    let intervalMinutes: number | null = null; // The interval for the *next* step

     if (!steps || steps.length === 0) {
        appLogger.error("Relearning steps not defined or empty in settings. Defaulting to immediate re-entry to review.");
        return { nextStepIndex: 'graduatedFromRelearning', nextDueTime: new Date(), intervalMinutes: null };
    }

    if (grade === 1) { // Again: Go back to first relearning step
        nextStepIndex = 0;
        intervalMinutes = steps[0];
    } else { // Hard (2), Good (3), Easy (4): Success in relearning - move one step forward
        const potentialNextIndex = currentStepIndex + 1;

        if (potentialNextIndex >= steps.length) {
            nextStepIndex = 'graduatedFromRelearning'; // Completed relearning steps
            intervalMinutes = null; // Re-entering Review handled separately
        } else {
            nextStepIndex = potentialNextIndex;
            intervalMinutes = steps[nextStepIndex];
        }
    }

    const nextDueTime = nextStepIndex === 'graduatedFromRelearning'
        ? new Date() // Card is immediately due for re-entry processing
        : addMinutes(new Date(), intervalMinutes!); // Card is due after the step interval

    return { nextStepIndex, nextDueTime, intervalMinutes };
}

// --- Helper for Initial Graduation Payload (Learning -> Review Transition) ---
/**
 * Constructs the payload for the first Review state (srs_level=1) when a card
 * graduates from the Initial Learning phase (either algorithm).
 *
 * @param grade The grade that triggered graduation (typically 3 or 4, but could be 2 if last step reached).
 * @param failedAttemptsInLearn Total Grade 1s recorded *during initial learning* for this card.
 * @param hardAttemptsInLearn Total Grade 2s recorded *during initial learning* for this card.
 * @param settings The user's application settings.
 * @returns An Sm2UpdatePayload object representing the initial Review state.
 */
export function createGraduationPayload(
    grade: ReviewGrade, // The grade that caused graduation
    failedAttemptsInLearn: number,
    hardAttemptsInLearn: number,
    settings: Settings // Use imported Settings type
): Sm2UpdatePayload {
     const initialEF = calculateInitialEasinessFactor(failedAttemptsInLearn, hardAttemptsInLearn, settings);
     // Use Easy Interval if graduated with Grade 4, otherwise use Graduating Interval
     const initialIntervalDays = grade === 4 ? settings.easyIntervalDays : settings.graduatingIntervalDays;

     return {
        srsLevel: 1, // Enters review phase at level 1
        easinessFactor: initialEF, // Calculated based on learning performance
        intervalDays: initialIntervalDays, // Integer days
        nextReviewDue: addDays(startOfDay(new Date()), initialIntervalDays),
        lastReviewGrade: grade, // The grade that triggered graduation
        learningState: null, // No longer in learning state
        learningStepIndex: null,
     };
}

// --- Helper for Relearning Graduation Payload (Relearning -> Review Transition) ---
/**
 * Constructs the payload when a card graduates from the Relearning state and
 * re-enters the standard Review phase.
 *
 * @param grade The grade that triggered graduation from Relearning (typically >= 2).
 * @param currentCardEf The card's Easiness Factor *before* starting Relearning (i.e., the EF it had when it lapsed). This should be the EF used for the new state.
 * @param settings The user's application settings.
 * @returns An Sm2UpdatePayload object representing the state upon re-entering Review.
 */
export function createRelearningGraduationPayload(
    grade: ReviewGrade, // The grade that caused graduation from Relearning
    currentCardEf: number, // Use the EF it had when it lapsed (passed from hook)
    settings: Settings // Use imported Settings type
): Sm2UpdatePayload {
     // The EF was already penalized when the card *lapsed* from Review. We keep that penalized EF.
     const newEasinessFactor = Math.max(settings.minEasinessFactor, currentCardEf);

     // Anki often uses a specific interval after relearning. A common approach is the Graduating Interval (1 day).
     const intervalAfterRelearning = settings.graduatingIntervalDays; // Use graduating interval as re-entry interval

     return {
        srsLevel: 1, // Re-entering Review at level 1 (common practice after lapse/relearn)
        easinessFactor: newEasinessFactor, // Keep the penalized EF
        intervalDays: intervalAfterRelearning, // Integer days
        nextReviewDue: addDays(startOfDay(new Date()), intervalAfterRelearning),
        lastReviewGrade: grade, // The grade that triggered relearning graduation
        learningState: null, // No longer in relearning state
        learningStepIndex: null,
     };
}