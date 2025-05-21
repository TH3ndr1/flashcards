// types/study.ts

import type { Tables } from '@/types/database';
// Import the authoritative StudyQueryCriteria type from its Zod schema definition
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
// Note: ReviewGrade should be imported from '@/lib/srs' where used, not redefined here.

// Type for the card data as fetched from the database, including potential deck relations
// This should align with what getCardsByIds action returns.
export type StudyCardDb = Tables<'cards'> & {
  decks?: { // Optional decks relation for language info
    primary_language: string;
    secondary_language: string;
  } | null;
};

/**
 * Represents the internal, session-specific state of a card being studied.
 * This state is managed by the study session hook and is not directly persisted
 * as-is to the database (though its components might inform DB updates).
 */
export interface InternalCardState {
  /** For 'dedicated-learn' algorithm: tracks consecutive correct answers in the current session. */
  streak: number;
  /** For 'standard-sm2' (learn/relearn): current step index in the learning/relearning steps array. */
  learningStepIndex: number | null;
  /** When this card is next due *within the current study session*. (e.g., for timed steps or re-queueing) */
  dueTime: Date;
  /** For 'dedicated-learn': tracks 'Again' (Grade 1) responses during the initial learning phase of this session. */
  failedAttemptsInLearnSession: number;
  /** For 'dedicated-learn': tracks 'Hard' (Grade 2) responses during the initial learning phase of this session. */
  hardAttemptsInLearnSession: number;
  /** Flag to indicate if this card has just been seen in the current session pass (for custom re-queue logic) */
  justSeenInSession?: boolean;
  /** Original srs_level when the card was loaded into the session (for relearning graduation reference) */
  originalSrsLevelOnLoad?: number;
}

/**
 * Represents a card item within the active study session queue.
 * It combines the persistent card data with its transient session state.
 */
export interface SessionCard {
  /** The full card data object from the database. */
  card: StudyCardDb;
  /** The internal state of this card specific to the current study session. */
  internalState: InternalCardState;
}

/**
 * Defines the type of study session being conducted.
 * - 'learn-only': Focuses only on new cards (srs_level 0, not relearning).
 * - 'review-only': Focuses only on cards due for review (srs_level >= 1 or relearning, and due).
 * - 'unified': A combined session that prioritizes learning cards first, then due review cards.
 */
export type SessionType = 'learn-only' | 'review-only' | 'unified';

/**
 * Represents the aggregated results and statistics for the current study session.
 */
export interface SessionResults {
  totalAnswered: number;
  correctCount: number; // Grade >= 3 (Good or Easy)
  hardCount: number;    // Grade 2
  incorrectCount: number; // Grade 1 (Again)
  graduatedFromLearnCount: number;
  graduatedFromRelearnCount: number;
  lapsedToRelearnCount: number;
}

/**
 * Describes the outcome of answering a card, providing necessary data
 * for updating the card's DB state and the session queue.
 * This type is used by card-state-handlers.ts
 */
export type CardStateUpdateOutcome = {
    dbUpdatePayload: Partial<Tables<'cards'>>;
    nextInternalState: InternalCardState;
    queueInstruction: 'remove' | 're-queue-soon' | 're-queue-later' | 'set-timed-step'; // Aligned with handler logic
    reinsertAfterNJobs?: number; // For 'dedicated-learn' requeue gap
    sessionResultCategory?: 'graduatedLearn' | 'graduatedRelearn' | 'lapsed';
};


/**
 * Input parameters to initialize a study session, typically stored in Zustand
 * or passed as props to the useStudySession hook.
 */
export type StudySessionInput =
  | { criteria: StudyQueryCriteria; studySetId?: undefined; deckId?: undefined } // Uses the Zod-derived StudyQueryCriteria
  | { criteria?: undefined; studySetId: string; deckId?: undefined }
  | { criteria?: undefined; studySetId?: undefined; deckId: string };

/**
 * Study mode, typically stored in Zustand along with StudySessionInput.
 * This determines the high-level intent (learn new things vs. review existing).
 * The `SessionType` (used internally by the hook) might be derived from this
 * for more specific queue handling (e.g., a 'unified' SessionType).
 */
export type StudySessionMode = 'learn' | 'review';


// REMOVED: SrsProgression - Not directly used by the core session types, can be app-specific if needed elsewhere.
// REMOVED: studyQueryCriteriaSchema and StudyQueryCriteria - These are authoritatively defined in lib/schema/study-query.schema.ts
// REMOVED: Redefinition of CardAnswerResult - It was identical to CardStateUpdateOutcome. Consolidating to CardStateUpdateOutcome.
// REMOVED: ReviewGrade - Should be imported from lib/srs.ts by consuming files.