// lib/study/session-queue-manager.ts
/**
 * Utility functions for managing the study session queue.
 * These functions are pure and operate on the queue data structure,
 * facilitating its initialization, updates, and card selection.
 */

import type { Tables } from '@/types/database';
import type { Settings } from '@/providers/settings-provider';
import type {
    SessionCard,
    InternalCardState,
    SessionType,
    CardAnswerResult, // Not directly used here, but its components are used in updateQueueAfterAnswer
    StudyCardDb,
    CardStateUpdateOutcome
} from '@/types/study';
import { parseISO, isValid as isValidDate } from 'date-fns'; // Renamed isValid to avoid conflict

// Type alias for card data from DB
type DbCard = Tables<'cards'>;

/**
 * Initializes the session queue from a list of fetched database cards.
 * - Filters cards based on the sessionType.
 * - For 'unified' mode, prioritizes 'new' and 'learning' cards.
 * - Initializes InternalCardState for each card.
 * - Sorts the queue.
 *
 * @param fetchedCards Array of cards fetched from the database.
 * @param sessionType The type of session being started ('learn-only', 'review-only', 'unified').
 * @param settings User's application settings.
 * @returns An array of SessionCard objects ready for the study session.
 */
export function initializeQueue(
    fetchedCards: StudyCardDb[],
    sessionType: SessionType,
    settings: Settings
): SessionCard[] {
    console.log(`[QueueManager] Initializing queue. Type: ${sessionType}, Fetched cards: ${fetchedCards.length}`);
    const now = new Date();
    let eligibleCards: StudyCardDb[] = [];

    // 1. Filter cards based on sessionType and their current state
    if (sessionType === 'learn-only') {
        eligibleCards = fetchedCards.filter(card =>
            card.srs_level === 0 && card.learning_state !== 'relearning'
        );
        console.log(`[QueueManager] Filtered for 'learn-only': ${eligibleCards.length} cards.`);
    } else if (sessionType === 'review-only') {
        eligibleCards = fetchedCards.filter(card => {
            const isReviewState = card.srs_level !== null && card.srs_level >= 1 && card.learning_state === null;
            const isRelearningState = card.srs_level === 0 && card.learning_state === 'relearning';
            const isDue = card.next_review_due && isValidDate(parseISO(card.next_review_due)) && parseISO(card.next_review_due) <= now;
            return (isReviewState || isRelearningState) && isDue;
        });
        console.log(`[QueueManager] Filtered for 'review-only' (due): ${eligibleCards.length} cards.`);
    } else { // 'unified' session
        // For unified, we take all cards and will prioritize them later.
        // We still need to ensure they are generally eligible for either learn or review.
        eligibleCards = fetchedCards.filter(card => {
            const isLearnEligible = card.srs_level === 0 && card.learning_state !== 'relearning';
            const isReviewEligible = (
                (card.srs_level !== null && card.srs_level >= 1 && card.learning_state === null) ||
                (card.srs_level === 0 && card.learning_state === 'relearning')
            ) && card.next_review_due && isValidDate(parseISO(card.next_review_due)) && parseISO(card.next_review_due) <= now;
            return isLearnEligible || isReviewEligible;
        });
        console.log(`[QueueManager] Filtered for 'unified' (learn or due review): ${eligibleCards.length} cards.`);
    }

    if (eligibleCards.length === 0) {
        return [];
    }

    // 2. Map to SessionCard and initialize InternalCardState
    const sessionCards: SessionCard[] = eligibleCards.map(dbCard => {
        const card = { ...dbCard }; // Create a mutable copy for the session
        let initialLearningStepIndex = card.learning_step_index;

        // For truly new cards entering a learn or unified session, set their initial learning state
        if ((sessionType === 'learn-only' || sessionType === 'unified') && card.srs_level === 0 && card.learning_state === null) {
            // Note: The actual DB update for learning_state='learning' will happen after the first answer.
            // Here, we prepare the internal session state.
            initialLearningStepIndex = 0; // Start at step 0 for session internal state
        }

        const internalState: InternalCardState = {
            streak: 0,
            learningStepIndex: initialLearningStepIndex,
            // For review cards, dueTime is their actual DB due time.
            // For new/learning cards in learn/unified, they are due now unless steps dictate otherwise.
            dueTime: (card.srs_level !== null && card.srs_level >= 1 && card.next_review_due && isValidDate(parseISO(card.next_review_due)))
                        ? parseISO(card.next_review_due)
                        : now,
            failedAttemptsInLearnSession: 0,
            hardAttemptsInLearnSession: 0,
            justSeenInSession: false,
            originalSrsLevelOnLoad: card.srs_level, // Store original level
        };
        return { card, internalState };
    });

    // 3. Sort the queue
    return sortSessionQueue(sessionCards, sessionType);
}

/**
 * Sorts the session queue.
 * For 'unified' mode, learning cards (srs_level 0, not relearning) are prioritized first,
 * then all cards are sorted by their dueTime.
 * For 'learn-only' and 'review-only', sorts primarily by dueTime.
 */
function sortSessionQueue(queue: SessionCard[], sessionType: SessionType): SessionCard[] {
    return [...queue].sort((a, b) => {
        if (sessionType === 'unified') {
            const aIsLearning = a.card.srs_level === 0 && a.card.learning_state !== 'relearning';
            const bIsLearning = b.card.srs_level === 0 && b.card.learning_state !== 'relearning';

            if (aIsLearning && !bIsLearning) return -1; // a (learning) comes before b (review)
            if (!aIsLearning && bIsLearning) return 1;  // b (learning) comes before a (review)
            // If both are learning or both are review, sort by dueTime
        }
        // Default sort by dueTime for all other cases or when types are same in unified
        return a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime();
    });
}

/**
 * Finds the index of the next card to study in the queue.
 * Returns the index of the first card where internalState.dueTime <= now.
 * If no card is due, returns queue.length (indicating a waiting state).
 *
 * @param queue The current session queue.
 * @returns The index of the next due card, or queue.length.
 */
export function findNextCardIndex(queue: SessionCard[]): number {
    if (!queue || queue.length === 0) return 0; // Or queue.length, but 0 is fine for empty

    const now = new Date();
    const nextIndex = queue.findIndex(item => item.internalState.dueTime <= now);

    return nextIndex !== -1 ? nextIndex : queue.length;
}

/**
 * Updates the session queue after a card has been answered.
 *
 * @param currentQueue The current session queue.
 * @param answeredCardId The ID of the card that was just answered.
 * @param answerOutcome The result from card-state-handlers, containing updated states and queue instruction.
 * @param settings User settings, for `customLearnRequeueGap`.
 * @returns The new session queue, sorted.
 */
export function updateQueueAfterAnswer(
    currentQueue: SessionCard[],
    answeredCardId: string,
    answerOutcome: CardStateUpdateOutcome, // This is the outcome from card-state-handlers
    settings: Settings
): SessionCard[] {
    const { nextInternalState, queueInstruction, reinsertAfterNJobs } = answerOutcome;

    let newQueue = [...currentQueue];
    const answeredItemIndex = newQueue.findIndex(item => item.card.id === answeredCardId);

    if (answeredItemIndex === -1) {
        console.error(`[QueueManager] Could not find answered card ${answeredCardId} in queue to update.`);
        return currentQueue; // Return original queue if card not found
    }

    // Get the card data from the item that was answered (it might have been updated by the handler)
    // The `answerOutcome.dbUpdatePayload` contains the new DB state, but for the queue, we need the SessionCard structure.
    // The `nextInternalState` is the critical piece for the queue.
    // The card's DB-relevant fields within SessionCard.card should also reflect `answerOutcome.dbUpdatePayload`.
    const originalAnsweredItem = newQueue[answeredItemIndex];
    const updatedAnsweredCardData = { ...originalAnsweredItem.card, ...answerOutcome.dbUpdatePayload };

    // Remove the answered card first
    newQueue.splice(answeredItemIndex, 1);

    if (queueInstruction === 'remove') {
        // Card is removed permanently from this session (graduated or completed review)
        console.log(`[QueueManager] Card ${answeredCardId} removed from queue.`);
    } else {
        const itemToReinsert: SessionCard = {
            card: updatedAnsweredCardData as StudyCardDb, // Assert as StudyCardDb after merging
            internalState: nextInternalState,
        };

        if (queueInstruction === 're-queue-soon' && reinsertAfterNJobs !== undefined) {
            const insertPos = Math.min(answeredItemIndex + reinsertAfterNJobs, newQueue.length);
            newQueue.splice(insertPos, 0, itemToReinsert);
            console.log(`[QueueManager] Card ${answeredCardId} re-queued sooner at index ${insertPos}.`);
        } else if (queueInstruction === 're-queue-later') {
            newQueue.push(itemToReinsert); // Add to the end
            console.log(`[QueueManager] Card ${answeredCardId} re-queued later (end of current due items).`);
        } else if (queueInstruction === 'set-timed-step') {
            // Card stays in queue, its dueTime in nextInternalState determines its new position
            newQueue.push(itemToReinsert); // Add it back, sort will place it
            console.log(`[QueueManager] Card ${answeredCardId} updated for timed step. Due: ${nextInternalState.dueTime}`);
        }
    }

    // Always re-sort the queue as dueTimes or item order might have changed
    // The sort function used here might need to be aware of the overall sessionType if unified prioritization is complex.
    // For now, a simple dueTime sort after initial prioritization should work.
    return newQueue.sort((a, b) => a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime());
}


/**
 * Determines the delay for the next due check timer.
 *
 * @param queue The current session queue.
 * @returns The delay in milliseconds, or null if no timer is needed.
 */
export function getNextDueCheckDelay(queue: SessionCard[]): number | null {
    if (queue.length === 0) return null;

    const now = new Date();
    let soonestFutureDueTime: Date | null = null;

    // Queue should already be sorted by dueTime by updateQueueAfterAnswer or initializeQueue
    for (const item of queue) {
        if (item.internalState.dueTime > now) {
            soonestFutureDueTime = item.internalState.dueTime;
            break;
        }
    }

    if (soonestFutureDueTime) {
        const delay = soonestFutureDueTime.getTime() - now.getTime();
        return Math.max(delay + 100, 100); // Add buffer, min 100ms
    }

    return null; // No future due cards, no timer needed immediately
}