// lib/study/card-state-handlers.ts
/**
 * Pure functions to handle card state transitions based on review grades and study settings.
 * These functions determine the next database state, internal session state, and queue action
 * for a card after it has been answered.
 */

import type { Tables } from '@/types/database';
import type { Settings } from '@/providers/settings-provider';
import type {
    InternalCardState,
    CardStateUpdateOutcome // This type should define the queueInstruction literals correctly
} from '@/types/study'; // Assuming types are in types/study.ts
import {
    ReviewGrade,
    calculateSm2State,
    calculateNextStandardLearnStep,
    calculateNextRelearningStep,
    createGraduationPayload,
    createRelearningGraduationPayload,
    Sm2InputCardState
} from '@/lib/srs';
import { addMinutes, addDays, parseISO } from 'date-fns'; // Added parseISO

type DbCard = Tables<'cards'>;

export function handleInitialLearningAnswer(
    card: DbCard,
    internalState: InternalCardState,
    grade: ReviewGrade,
    settings: Settings
): CardStateUpdateOutcome {
    console.log(`[CardStateHandler] Handling initial learning answer for card ${card.id}, grade: ${grade}, algorithm: ${settings.studyAlgorithm}`);

    const dbUpdatePayload: Partial<DbCard> = {
        last_reviewed_at: new Date().toISOString(),
        last_review_grade: grade,
        attempt_count: (card.attempt_count ?? 0) + 1,
        correct_count: grade >= 3 ? (card.correct_count ?? 0) + 1 : card.correct_count ?? 0,
        incorrect_count: grade === 1 ? (card.incorrect_count ?? 0) + 1 : card.incorrect_count ?? 0,
    };
    let nextInternalState = { ...internalState };
    let queueInstruction: CardStateUpdateOutcome['queueInstruction'] = 'set-timed-step'; // CORRECTED
    let sessionResultCategory: CardStateUpdateOutcome['sessionResultCategory'] | undefined = undefined;
    let reinsertAfterNJobs: CardStateUpdateOutcome['reinsertAfterNJobs'] | undefined = undefined;

    if (grade === 1) dbUpdatePayload.failed_attempts_in_learn = (card.failed_attempts_in_learn ?? 0) + 1;
    if (grade === 2) dbUpdatePayload.hard_attempts_in_learn = (card.hard_attempts_in_learn ?? 0) + 1;
    nextInternalState.failedAttemptsInLearnSession = grade === 1 ? nextInternalState.failedAttemptsInLearnSession + 1 : nextInternalState.failedAttemptsInLearnSession;
    nextInternalState.hardAttemptsInLearnSession = grade === 2 ? nextInternalState.hardAttemptsInLearnSession + 1 : nextInternalState.hardAttemptsInLearnSession;

    if (settings.studyAlgorithm === 'dedicated-learn' || settings.enableDedicatedLearnMode) {
        let newStreak = internalState.streak;
        if (grade === 1) newStreak = 0;
        else if (grade === 2) newStreak = Math.max(0, newStreak);
        else if (grade >= 3) newStreak++;

        nextInternalState.streak = newStreak;
        nextInternalState.justSeenInSession = true;

        if (newStreak >= settings.masteryThreshold || grade === 4) {
            console.log(`[CardStateHandler] Card ${card.id} graduating from Dedicated Learn.`);
            sessionResultCategory = 'graduatedLearn';
            queueInstruction = 'remove';

            const graduationPayload = createGraduationPayload(
                grade,
                dbUpdatePayload.failed_attempts_in_learn ?? 0,
                dbUpdatePayload.hard_attempts_in_learn ?? 0,
                settings
            );
            dbUpdatePayload.srs_level = graduationPayload.srsLevel;
            dbUpdatePayload.learning_state = null;
            dbUpdatePayload.learning_step_index = null;
            dbUpdatePayload.easiness_factor = graduationPayload.easinessFactor;
            dbUpdatePayload.interval_days = graduationPayload.intervalDays;
            dbUpdatePayload.next_review_due = graduationPayload.nextReviewDue?.toISOString();
            dbUpdatePayload.failed_attempts_in_learn = 0;
            dbUpdatePayload.hard_attempts_in_learn = 0;
            nextInternalState.learningStepIndex = null;
        } else {
            console.log(`[CardStateHandler] Card ${card.id} continues in Dedicated Learn (Streak: ${newStreak}).`);
            if (grade === 1 || grade === 2) {
                queueInstruction = 're-queue-soon'; // CORRECTED
                reinsertAfterNJobs = settings.customLearnRequeueGap;
            } else {
                queueInstruction = 're-queue-later';
            }
            nextInternalState.dueTime = new Date();
            dbUpdatePayload.learning_state = 'learning';
            dbUpdatePayload.learning_step_index = nextInternalState.learningStepIndex ?? 0;
        }
    } else {
        const currentStep = internalState.learningStepIndex ?? 0;
        const stepResult = calculateNextStandardLearnStep(currentStep, grade, settings);

        if (stepResult.nextStepIndex === 'graduated') {
            console.log(`[CardStateHandler] Card ${card.id} graduating from Standard Learn.`);
            sessionResultCategory = 'graduatedLearn';
            queueInstruction = 'remove';

            const graduationPayload = createGraduationPayload(
                grade,
                dbUpdatePayload.failed_attempts_in_learn ?? 0,
                dbUpdatePayload.hard_attempts_in_learn ?? 0,
                settings
            );
            dbUpdatePayload.srs_level = graduationPayload.srsLevel;
            dbUpdatePayload.learning_state = null;
            dbUpdatePayload.learning_step_index = null;
            dbUpdatePayload.easiness_factor = graduationPayload.easinessFactor;
            dbUpdatePayload.interval_days = graduationPayload.intervalDays;
            dbUpdatePayload.next_review_due = graduationPayload.nextReviewDue?.toISOString();
            dbUpdatePayload.failed_attempts_in_learn = 0;
            dbUpdatePayload.hard_attempts_in_learn = 0;
            nextInternalState.learningStepIndex = null;
        } else {
            console.log(`[CardStateHandler] Card ${card.id} continues in Standard Learn step ${stepResult.nextStepIndex}.`);
            queueInstruction = 'set-timed-step'; // CORRECTED
            nextInternalState.learningStepIndex = stepResult.nextStepIndex;
            nextInternalState.dueTime = stepResult.nextDueTime;

            dbUpdatePayload.learning_state = 'learning';
            dbUpdatePayload.learning_step_index = nextInternalState.learningStepIndex;
            dbUpdatePayload.next_review_due = nextInternalState.dueTime.toISOString();
        }
    }
    return { dbUpdatePayload, nextInternalState, queueInstruction, sessionResultCategory, reinsertAfterNJobs };
}

export function handleRelearningAnswer(
    card: DbCard,
    internalState: InternalCardState,
    grade: ReviewGrade,
    settings: Settings
): CardStateUpdateOutcome {
    console.log(`[CardStateHandler] Handling relearning answer for card ${card.id}, grade: ${grade}`);
    const dbUpdatePayload: Partial<DbCard> = {
        last_reviewed_at: new Date().toISOString(),
        last_review_grade: grade,
        attempt_count: (card.attempt_count ?? 0) + 1,
        correct_count: grade >= 3 ? (card.correct_count ?? 0) + 1 : card.correct_count ?? 0,
        incorrect_count: grade === 1 ? (card.incorrect_count ?? 0) + 1 : card.incorrect_count ?? 0,
    };
    let nextInternalState = { ...internalState };
    let queueInstruction: CardStateUpdateOutcome['queueInstruction'] = 'set-timed-step'; // CORRECTED
    let sessionResultCategory: CardStateUpdateOutcome['sessionResultCategory'] | undefined = undefined;

    const currentStep = internalState.learningStepIndex ?? 0;
    const stepResult = calculateNextRelearningStep(currentStep, grade, settings);

    if (stepResult.nextStepIndex === 'graduatedFromRelearning') {
        console.log(`[CardStateHandler] Card ${card.id} graduating from Relearning.`);
        sessionResultCategory = 'graduatedRelearn';
        queueInstruction = 'remove';

        const relearnGraduationPayload = createRelearningGraduationPayload(
            grade,
            card.easiness_factor ?? settings.defaultEasinessFactor,
            // internalState.originalSrsLevelOnLoad, // REMOVED - not used by current srs.ts function
            settings
        );
        dbUpdatePayload.srs_level = relearnGraduationPayload.srsLevel;
        dbUpdatePayload.learning_state = null;
        dbUpdatePayload.learning_step_index = null;
        dbUpdatePayload.easiness_factor = relearnGraduationPayload.easinessFactor;
        dbUpdatePayload.interval_days = relearnGraduationPayload.intervalDays;
        dbUpdatePayload.next_review_due = relearnGraduationPayload.nextReviewDue?.toISOString();
        nextInternalState.learningStepIndex = null;
    } else {
        console.log(`[CardStateHandler] Card ${card.id} continues in Relearning step ${stepResult.nextStepIndex}.`);
        queueInstruction = 'set-timed-step'; // CORRECTED
        nextInternalState.learningStepIndex = stepResult.nextStepIndex;
        nextInternalState.dueTime = stepResult.nextDueTime;
        dbUpdatePayload.learning_state = 'relearning';
        dbUpdatePayload.learning_step_index = nextInternalState.learningStepIndex;
        dbUpdatePayload.next_review_due = nextInternalState.dueTime.toISOString();
    }
    return { dbUpdatePayload, nextInternalState, queueInstruction, sessionResultCategory };
}

export function handleReviewAnswer(
    card: DbCard,
    internalState: InternalCardState,
    grade: ReviewGrade,
    settings: Settings
): CardStateUpdateOutcome {
    console.log(`[CardStateHandler] Handling review answer for card ${card.id}, grade: ${grade}`);
    const dbUpdatePayload: Partial<DbCard> = {
        last_reviewed_at: new Date().toISOString(),
        last_review_grade: grade,
        attempt_count: (card.attempt_count ?? 0) + 1,
        correct_count: grade >= 2 ? (card.correct_count ?? 0) + 1 : card.correct_count ?? 0,
        incorrect_count: grade === 1 ? (card.incorrect_count ?? 0) + 1 : card.incorrect_count ?? 0,
    };
    let nextInternalState = { ...internalState };
    let queueInstruction: CardStateUpdateOutcome['queueInstruction'] = 'remove';
    let sessionResultCategory: CardStateUpdateOutcome['sessionResultCategory'] | undefined = undefined;

    const sm2Input: Sm2InputCardState = {
        srsLevel: card.srs_level,
        easinessFactor: card.easiness_factor ?? settings.defaultEasinessFactor,
        intervalDays: card.interval_days ?? 0,
        learningState: null,
        learningStepIndex: null,
        nextReviewDue: card.next_review_due ? parseISO(card.next_review_due) : null
    };

    const sm2Result = calculateSm2State(sm2Input, grade, settings);

    dbUpdatePayload.srs_level = sm2Result.srsLevel;
    dbUpdatePayload.easiness_factor = sm2Result.easinessFactor;
    dbUpdatePayload.interval_days = sm2Result.intervalDays;
    dbUpdatePayload.next_review_due = sm2Result.nextReviewDue?.toISOString();
    dbUpdatePayload.learning_state = sm2Result.learningState;
    dbUpdatePayload.learning_step_index = sm2Result.learningStepIndex;

    if (sm2Result.learningState === 'relearning') {
        console.log(`[CardStateHandler] Card ${card.id} lapsed to Relearning.`);
        sessionResultCategory = 'lapsed';
        nextInternalState.learningStepIndex = sm2Result.learningStepIndex;
        nextInternalState.dueTime = sm2Result.nextReviewDue || new Date();
        queueInstruction = 'set-timed-step';
    } else {
        console.log(`[CardStateHandler] Card ${card.id} successful in Review. Next due: ${dbUpdatePayload.next_review_due}`);
    }
    return { dbUpdatePayload, nextInternalState, queueInstruction, sessionResultCategory };
}