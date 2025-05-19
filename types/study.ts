import { z } from "zod";
import type { Tables } from '@/types/database';
import type { Settings } from '@/providers/settings-provider'; // For ReviewGrade, and potentially other settings


// Define Zod schema for study query criteria
export const studyQueryCriteriaSchema = z.object({
    deckId: z.string().uuid().optional(),
    studySetId: z.string().uuid().optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
    includeNew: z.boolean().optional().default(true),
    includeReview: z.boolean().optional().default(true),
    includeLearning: z.boolean().optional().default(true)
});

// Export the TypeScript type derived from the schema
export type StudyQueryCriteria = z.infer<typeof studyQueryCriteriaSchema>;

// Add new interface for tracking SRS changes
export interface SrsProgression {
    newToLearning: number;
    learningToReview: number;
    stayedInLearning: number;
    droppedToLearning: number;
} 

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
  // easedCount is implicitly part of correctCount with grade 4
  graduatedFromLearnCount: number;    // Cards graduating from initial learning (srs_level 0 -> 1)
  graduatedFromRelearnCount: number; // Cards graduating from relearning (relearning -> review)
  lapsedToRelearnCount: number;    // Cards lapsing from review to relearning
}

/**
 * Describes the outcome of answering a card, providing necessary data
 * for updating the card's DB state and the session queue.
 */
export interface CardAnswerResult {
  /** The card object with its SRS fields updated, ready for persistence. */
  updatedCardDbState: Partial<Tables<'cards'>>; // Only the fields that need to be saved to DB
  /** The updated internal state for this card in the session. */
  updatedInternalState: InternalCardState;
  /** Instruction for how the queue manager should handle this card. */
  queueAction: 'remove' | 're-queue-sooner' | 're-queue-later' | 'keep-for-timed-step';
  /** Specific index for re-queueing (e.g., after N cards for 'dedicated-learn' hard/again). Optional. */
  reinsertAtIndex?: number;
  /** Indicates if a session result metric should be incremented (e.g., graduated, lapsed). */
  sessionResultIncrement?: keyof Pick<SessionResults, 'graduatedFromLearnCount' | 'graduatedFromRelearnCount' | 'lapsedToRelearnCount'>;
}

/**
 * Input parameters to initialize a study session, typically stored in Zustand.
 * This is based on the existing `StudyInput` from `studySessionStore.ts`.
 */
export type StudySessionInput =
  | { criteria: StudyQueryCriteria; studySetId?: never; deckId?: never } // Used by /study/select for custom queries
  | { criteria?: never; studySetId: string; deckId?: never }              // Used by /study/select for saved Study Sets
  | { criteria?: never; studySetId?: never; deckId: string };             // Used by Deck List "Practice" button

/**
 * Study mode, typically stored in Zustand along with StudySessionInput.
 * This is based on the existing `StudyMode` from `studySessionStore.ts`.
 */
export type StudySessionMode = 'learn' | 'review';


// Helper type for the return of state handlers, before processing by queue manager
export type CardStateUpdateOutcome = {
    dbUpdatePayload: Partial<Tables<'cards'>>;
    nextInternalState: InternalCardState;
    queueInstruction: 'remove' | 're-queue-soon' | 're-queue-later' | 'set-timed-step';
    reinsertAfterNJobs?: number; // For 'dedicated-learn' requeue gap
    sessionResultCategory?: 'graduatedLearn' | 'graduatedRelearn' | 'lapsed';
};