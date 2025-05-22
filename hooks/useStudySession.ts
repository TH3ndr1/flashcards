// hooks/useStudySession.ts
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardsByIds } from '@/lib/actions/cardActions';
import { updateCardProgress } from '@/lib/actions/progressActions';
import { useSettings, type Settings, DEFAULT_SETTINGS } from '@/providers/settings-provider';
import type { Tables } from '@/types/database';

import {
    SessionCard,
    InternalCardState,
    SessionType,
    SessionResults,
    StudyCardDb,
    StudySessionInput,
    CardStateUpdateOutcome
} from '@/types/study';
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import {
    handleInitialLearningAnswer,
    handleRelearningAnswer,
    handleReviewAnswer
} from '@/lib/study/card-state-handlers';
import {
    initializeQueue,
    findNextCardIndex,
    updateQueueAfterAnswer,
    getNextDueCheckDelay
} from '@/lib/study/session-queue-manager';
import {
    type ReviewGrade
} from '@/lib/srs';
import { debounce } from "@/lib/utils";
import { toast } from 'sonner';
import { parseISO, isValid as isValidDate, isToday, isPast } from 'date-fns';
import { appLogger } from '@/lib/logger';

const PROGRESS_UPDATE_DEBOUNCE_MS = 1500;
const FLIP_DURATION_MS = 300;
const PROCESSING_DELAY_MS = FLIP_DURATION_MS + 50;

export interface UseStudySessionReturn {
    currentCard: StudyCardDb | null;
    isInitializing: boolean;
    error: string | null;
    sessionType: SessionType | null;
    isComplete: boolean;
    totalCardsInSession: number;
    currentCardNumberInSession: number;
    initialQueryCount: number;
    isProcessingAnswer: boolean;
    isFlipped: boolean;
    onFlip: () => void;
    sessionResults: SessionResults;
    answerCard: (grade: ReviewGrade) => Promise<void>;
    currentCardStatusDisplay: string | null;
    showContinueReviewPrompt: boolean;
    onContinueReview: () => void;
    isLoadingSettings: boolean;
    unifiedSessionPhase: 'learning' | 'review' | 'complete';
}

interface UseStudySessionProps {
    initialInput: StudySessionInput | null;
    sessionType: SessionType | null;
}

export function useStudySession({
    initialInput,
    sessionType
}: UseStudySessionProps): UseStudySessionReturn {
    const { settings, loading: isLoadingSettings } = useSettings();

    const [sessionQueue, setSessionQueue] = useState<SessionCard[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
    const [isProcessingAnswer, setIsProcessingAnswer] = useState<boolean>(false);
    const [sessionResults, setSessionResults] = useState<SessionResults>({
        totalAnswered: 0, correctCount: 0, hardCount: 0, incorrectCount: 0,
        graduatedFromLearnCount: 0, graduatedFromRelearnCount: 0, lapsedToRelearnCount: 0,
    });
    const [error, setError] = useState<string | null>(null);
    const [initialQueryCount, setInitialQueryCount] = useState<number>(0);
    const [initialEligibleCardCount, setInitialEligibleCardCount] = useState<number>(0);
    const [showContinueReviewPrompt, setShowContinueReviewPrompt] = useState<boolean>(false);
    const [unifiedSessionPhase, setUnifiedSessionPhase] = useState<'learning' | 'review' | 'complete'>('complete');

    const dueCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
    const settingsRef = useRef<Settings | null>(null);

    // Refs to track previous prop values for debugging the initialization effect
    const prevInitialInputRef = useRef<StudySessionInput | null | undefined>(undefined);
    const prevSessionTypeRef = useRef<SessionType | null | undefined>(undefined);
    const prevSettingsRefHook = useRef<Settings | null | undefined>(undefined);
    const prevIsLoadingSettingsRef = useRef<boolean | undefined>(undefined);
    const initEffectRunCountRef = useRef(0);

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const debouncedUpdateProgress = useCallback( /* ... same as previous correct version ... */
      debounce(async (cardId: string, dbPayload: Partial<Tables<'cards'>>, grade: ReviewGrade) => {
        if (!cardId || Object.keys(dbPayload).length === 0) {
            appLogger.warn("[useStudySession] Debounced update: No cardId or empty payload.");
            return;
        }
        appLogger.info(`[useStudySession] DebouncedUpdateProgress: Saving card ${cardId} with grade ${grade}`);

        const currentSettings = settingsRef.current ?? DEFAULT_SETTINGS;
        let finalLearningState: 'learning' | 'relearning' | null = null;
        if (dbPayload.learning_state === 'learning') finalLearningState = 'learning';
        else if (dbPayload.learning_state === 'relearning') finalLearningState = 'relearning';

        const validatedFieldsPayload = {
            srs_level: dbPayload.srs_level ?? 0,
            easiness_factor: dbPayload.easiness_factor ?? currentSettings.defaultEasinessFactor,
            interval_days: dbPayload.interval_days ?? 0,
            next_review_due: dbPayload.next_review_due ?? new Date().toISOString(),
            learning_state: finalLearningState,
            learning_step_index: dbPayload.learning_step_index === undefined ? null : dbPayload.learning_step_index,
            failed_attempts_in_learn: dbPayload.failed_attempts_in_learn ?? 0,
            hard_attempts_in_learn: dbPayload.hard_attempts_in_learn ?? 0,
            attempt_count: (dbPayload.attempt_count === null || dbPayload.attempt_count === undefined) ? undefined : dbPayload.attempt_count,
            correct_count: (dbPayload.correct_count === null || dbPayload.correct_count === undefined) ? undefined : dbPayload.correct_count,
            incorrect_count: (dbPayload.incorrect_count === null || dbPayload.incorrect_count === undefined) ? undefined : dbPayload.incorrect_count,
        };

        try {
          const result = await updateCardProgress({ cardId, grade, updatedFields: validatedFieldsPayload });
          if (result.error) {
            appLogger.error(`[useStudySession] Error saving card ${cardId} progress:`, result.error);
            toast.error(`Failed to save progress for a card.`);
          } else {
            appLogger.info(`[useStudySession] Successfully saved progress for card ${cardId}.`);
          }
        } catch (e) {
          appLogger.error(`[useStudySession] Exception saving progress for card ${cardId}:`, e);
          toast.error(`Exception saving progress for a card.`);
        }
      }, PROGRESS_UPDATE_DEBOUNCE_MS),
      []
    );

    useEffect(() => {
        initEffectRunCountRef.current += 1;
        const runCount = initEffectRunCountRef.current;
        const logPrefix = `[useStudySession #${runCount}] INIT EFFECT:`;

        // Log current and previous prop values for comparison
        if (runCount > 1) { // Only log changes after the first run
            if (initialInput !== prevInitialInputRef.current) {
                appLogger.warn(`${logPrefix} initialInput CHANGED!`, { prev: prevInitialInputRef.current, new: initialInput });
            }
            if (sessionType !== prevSessionTypeRef.current) {
                appLogger.warn(`${logPrefix} sessionType CHANGED!`, { prev: prevSessionTypeRef.current, new: sessionType });
            }
            if (settings !== prevSettingsRefHook.current) {
                // This checks for reference change.
                // For deep content change, you might need to JSON.stringify and compare, but reference is often the culprit.
                appLogger.warn(`${logPrefix} settings REFERENCE CHANGED! Is context value memoized?`);
            }
            if (isLoadingSettings !== prevIsLoadingSettingsRef.current) {
                appLogger.warn(`${logPrefix} isLoadingSettings CHANGED!`, { prev: prevIsLoadingSettingsRef.current, new: isLoadingSettings });
            }
        } else {
            appLogger.info(`${logPrefix} First run. Props:`, { initialInput, sessionType, settingsExists: !!settings, isLoadingSettings });
        }


        let isMounted = true;
        async function initializeNewSession() {
            if (!initialInput || !sessionType || !settings || isLoadingSettings) {
                appLogger.info(`${logPrefix} Deferred: Dependencies not ready.`, { hasInitialInput: !!initialInput, hasSessionType: !!sessionType, hasSettings: !!settings, isLoadingSettings });
                if (isMounted) setIsLoadingData(true);
                return;
            }

            appLogger.info(`${logPrefix} Initializing new session logic. Type: ${sessionType}`, { currentInitialInput: initialInput });
            if(isMounted) {
                setIsLoadingData(true); setError(null); setIsComplete(false); setSessionQueue([]);
                setCurrentCardIndex(0); setInitialEligibleCardCount(0);
                setSessionResults({ totalAnswered: 0, correctCount: 0, hardCount: 0, incorrectCount: 0, graduatedFromLearnCount: 0, graduatedFromRelearnCount: 0, lapsedToRelearnCount: 0 });
                setIsFlipped(false); setInitialQueryCount(0); setShowContinueReviewPrompt(false);
                setUnifiedSessionPhase(sessionType === 'unified' ? 'learning' : 'complete');
            }
            if (dueCheckTimerRef.current) clearTimeout(dueCheckTimerRef.current);

            try {
                let queryPayloadForAction: Parameters<typeof resolveStudyQuery>[0];
                if (initialInput.studySetId) {
                    queryPayloadForAction = { studySetId: initialInput.studySetId };
                    appLogger.info(`${logPrefix} Using studySetId: ${initialInput.studySetId}`);
                } else if (initialInput.deckId) {
                    // CORRECTED: Use deckIds (array) for the criteria
                    const criteriaForDeck: StudyQueryCriteria = {
                        deckIds: [initialInput.deckId], // Pass deckId as an array to deckIds
                        tagLogic: 'ANY',
                    };
                    queryPayloadForAction = { criteria: criteriaForDeck };
                    appLogger.info(`${logPrefix} Constructed criteria for single deckId:`, criteriaForDeck);
                } else if (initialInput.criteria) {
                    // Ensure the criteria from store/input already matches StudyQueryCriteria structure
                    // (which should now also use deckIds if applicable)
                    const criteriaFromInput = initialInput.criteria;
                    queryPayloadForAction = {
                         criteria: {
                            ...criteriaFromInput,
                            tagLogic: criteriaFromInput.tagLogic || (criteriaFromInput.includeTags && criteriaFromInput.includeTags.length > 0 ? 'ANY' : 'ANY'),
                        }
                    };
                    appLogger.info(`${logPrefix} Using criteria directly from initialInput:`, queryPayloadForAction.criteria);
                } else {
                    appLogger.error(`${logPrefix} Critical error: initialInput is invalid.`, initialInput);
                    throw new Error("Invalid initialInput structure for study session.");
                }

                appLogger.info(`${logPrefix} FINAL Calling resolveStudyQuery with:`, queryPayloadForAction);
                const queryResult = await resolveStudyQuery(queryPayloadForAction);

                if (!isMounted) return;
                if (queryResult.error || !queryResult.data) throw new Error(queryResult.error || 'Failed to resolve study query.');
                const cardIds = queryResult.data;
                if(isMounted) setInitialQueryCount(cardIds.length);
                appLogger.info(`${logPrefix} Resolved ${cardIds.length} card IDs.`);

                if (cardIds.length === 0) {
                    if (isMounted) { setIsComplete(true); setIsLoadingData(false); } return;
                }
                const cardsResult = await getCardsByIds(cardIds);
                if (!isMounted) return;
                if (cardsResult.error || !cardsResult.data) throw new Error(cardsResult.error || 'Failed to fetch card data.');
                const fetchedDbCards = cardsResult.data as StudyCardDb[];
                appLogger.info(`${logPrefix} Fetched ${fetchedDbCards.length} card data objects.`);
                const newQueue = initializeQueue(fetchedDbCards, sessionType, settings);
                if (!isMounted) return;
                appLogger.info(`${logPrefix} Queue initialized. Length: ${newQueue.length}`);
                if (newQueue.length === 0) {
                    if (isMounted) setIsComplete(true);
                } else {
                    if (isMounted) {
                        if (newQueue.length === 0) {
                            setIsComplete(true);
                            appLogger.info(`${logPrefix} No eligible cards for this session type. Session complete.`);
                        } else {
                            setSessionQueue(newQueue);
                            setInitialEligibleCardCount(newQueue.length);
                            appLogger.info(`${logPrefix} Queue initialized with ${newQueue.length} cards.`);
                    
                            // CORRECTLY SET unifiedSessionPhase based on initial queue content for 'unified' sessions
                            if (sessionType === 'unified') {
                                const hasLearningCardsInInitialQueue = newQueue.some(
                                    item => item.card.srs_level === 0 && (item.card.learning_state === null || item.card.learning_state === 'learning')
                                );
                                if (hasLearningCardsInInitialQueue) {
                                    setUnifiedSessionPhase('learning');
                                    appLogger.info(`${logPrefix} Unified session starting in 'learning' phase.`);
                                } else {
                                    setUnifiedSessionPhase('review'); // Skip learning phase if no learnable cards
                                    appLogger.info(`${logPrefix} Unified session skipping to 'review' phase (no initial learning cards).`);
                                }
                            } else {
                                setUnifiedSessionPhase('complete'); // Not a unified session or no cards
                            }
                        }
                    }
                }
            } catch (err) {
                if (isMounted) {
                    appLogger.error(`${logPrefix} Error during session initialization:`, err);
                    setError(err instanceof Error ? err.message : 'Unknown initialization error.');
                    setIsComplete(true);
                }
            } finally {
                if (isMounted) setIsLoadingData(false);
            }
        }

        initializeNewSession();

        // Update refs at the end of this effect's execution context
        // so the *next* run can compare against these values.
        prevInitialInputRef.current = initialInput;
        prevSessionTypeRef.current = sessionType;
        prevSettingsRefHook.current = settings;
        prevIsLoadingSettingsRef.current = isLoadingSettings;

        return () => {
            isMounted = false;
            if (dueCheckTimerRef.current) clearTimeout(dueCheckTimerRef.current);
            appLogger.info(`${logPrefix} CLEANUP.`);
        };
    }, [initialInput, sessionType, settings, isLoadingSettings]); // Dependencies of the main initialization effect

    // ... (useEffect for currentCardIndex and timer - no changes from previous) ...
    useEffect(() => {
        if (isLoadingData || isComplete) {
            if (isComplete && dueCheckTimerRef.current) { clearTimeout(dueCheckTimerRef.current); dueCheckTimerRef.current = null; }
            return;
        }
        if (sessionQueue.length > 0) {
            const nextIndex = findNextCardIndex(sessionQueue);
            // Only call setCurrentCardIndex if the index actually needs to change
            if (currentCardIndex !== nextIndex || (currentCardIndex === sessionQueue.length && nextIndex < sessionQueue.length) ) {
                 setCurrentCardIndex(nextIndex);
            }

            if (dueCheckTimerRef.current) clearTimeout(dueCheckTimerRef.current);
            const delay = getNextDueCheckDelay(sessionQueue);
            if (delay !== null) {
                dueCheckTimerRef.current = setTimeout(() => {
                    // appLogger.info("[useStudySession] Due check timer fired.");
                    const newNextIdx = findNextCardIndex(sessionQueue); // Recheck based on current queue
                    if(currentCardIndex !== newNextIdx) setCurrentCardIndex(newNextIdx); // Only update if it actually changed
                }, delay);
            }
        } else if (!isLoadingData && !isComplete && !showContinueReviewPrompt) {
            setIsComplete(true);
        }
        return () => { if (dueCheckTimerRef.current) clearTimeout(dueCheckTimerRef.current); };
    }, [sessionQueue, isLoadingData, isComplete, currentCardIndex, showContinueReviewPrompt]);


    // ... (Memos for currentQueueItem, currentCard, totalCardsInSession, currentCardNumberInSession - no changes) ...
    const currentQueueItem = useMemo(() => { /* ... */
        if (isLoadingData || isComplete || sessionQueue.length === 0 || currentCardIndex >= sessionQueue.length) {
            return null;
        }
        return sessionQueue[currentCardIndex];
    }, [isLoadingData, isComplete, sessionQueue, currentCardIndex]);

    const currentCard = currentQueueItem ? currentQueueItem.card : null;
    const totalCardsInSession = useMemo(() => initialEligibleCardCount, [initialEligibleCardCount]);
    const currentCardNumberInSession = useMemo(() => { /* ... */
        if (totalCardsInSession === 0) return 0;
        return Math.min(sessionResults.totalAnswered + 1, totalCardsInSession);
    }, [sessionResults.totalAnswered, totalCardsInSession]);

    // ... (onFlip callback - no changes) ...
    const onFlip = useCallback(() => { /* ... */
        if (!currentQueueItem || isProcessingAnswer || isComplete) return;
        setIsFlipped(prev => !prev);
    }, [currentQueueItem, isProcessingAnswer, isComplete]);

    // ... (answerCard callback - no changes) ...
    const answerCard = useCallback(async (grade: ReviewGrade) => { /* ... */
        if (!currentQueueItem || isProcessingAnswer || isComplete || !settingsRef.current) {
            appLogger.warn("[useStudySession] answerCard: Guarded return");
            return;
        }
        const currentSettings = settingsRef.current;
        setIsProcessingAnswer(true);
        if (!isFlipped) setIsFlipped(true);

        setTimeout(async () => {
            const { card: answeredDbCard, internalState: answeredInternalState } = currentQueueItem;
            let outcome: CardStateUpdateOutcome;

            if (answeredDbCard.srs_level === 0 && (answeredDbCard.learning_state === 'learning' || answeredDbCard.learning_state === null)) {
                outcome = handleInitialLearningAnswer(answeredDbCard, answeredInternalState, grade, currentSettings);
            } else if (answeredDbCard.srs_level === 0 && answeredDbCard.learning_state === 'relearning') {
                outcome = handleRelearningAnswer(answeredDbCard, answeredInternalState, grade, currentSettings);
            } else if (answeredDbCard.srs_level !== null && answeredDbCard.srs_level >= 1 && answeredDbCard.learning_state === null) {
                outcome = handleReviewAnswer(answeredDbCard, answeredInternalState, grade, currentSettings);
            } else {
                appLogger.error("[useStudySession] answerCard: Unhandled card state:", answeredDbCard);
                setIsProcessingAnswer(false); return;
            }

            setSessionResults(prev => {
                const newResults = { ...prev, totalAnswered: prev.totalAnswered + 1 };
                if (grade === 1) newResults.incorrectCount++;
                else if (grade === 2) newResults.hardCount++;
                else if (grade >= 3) newResults.correctCount++;
                if (outcome.sessionResultCategory === 'graduatedLearn') newResults.graduatedFromLearnCount++;
                if (outcome.sessionResultCategory === 'graduatedRelearn') newResults.graduatedFromRelearnCount++;
                if (outcome.sessionResultCategory === 'lapsed') newResults.lapsedToRelearnCount++;
                return newResults;
            });

            debouncedUpdateProgress(answeredDbCard.id, outcome.dbUpdatePayload, grade);
            const nextQueue = updateQueueAfterAnswer(sessionQueue, answeredDbCard.id, outcome, currentSettings);

            if (sessionType === 'unified' && unifiedSessionPhase === 'learning') {
                const remainingLearning = nextQueue.some(item => item.card.srs_level === 0 && (item.card.learning_state === 'learning' || item.card.learning_state === null));
                if (!remainingLearning) {
                    appLogger.info("[useStudySession] Learning phase of unified session complete.");
                    const hasReviewCards = nextQueue.some(item => (item.card.srs_level !== null && item.card.srs_level >= 1) || item.card.learning_state === 'relearning');
                    if (hasReviewCards) {
                        appLogger.info("[useStudySession] Review cards exist, showing prompt.");
                        setShowContinueReviewPrompt(true);
                        setSessionQueue(nextQueue);
                        setIsFlipped(false); setIsProcessingAnswer(false); return;
                    } else {
                        appLogger.info("[useStudySession] No review cards, unified session complete.");
                        setUnifiedSessionPhase('complete');
                    }
                }
            }

            setTimeout(() => {
                setSessionQueue(nextQueue);
                if (nextQueue.length === 0 && !showContinueReviewPrompt) {
                    setIsComplete(true); setCurrentCardIndex(0);
                } else if (!showContinueReviewPrompt) {
                    setIsFlipped(false);
                }
                setIsProcessingAnswer(false);
            }, PROCESSING_DELAY_MS);
        }, FLIP_DURATION_MS);
    }, [currentQueueItem, isProcessingAnswer, isComplete, settingsRef, sessionQueue, debouncedUpdateProgress, sessionType, unifiedSessionPhase, isFlipped]);

    // ... (onContinueReview callback - no changes) ...
    const onContinueReview = useCallback(() => { /* ... */
        appLogger.info("[useStudySession] User continuing to review phase.");
        setShowContinueReviewPrompt(false);
        setUnifiedSessionPhase('review');
        const nextIndex = findNextCardIndex(sessionQueue);
        setCurrentCardIndex(nextIndex);
        setIsFlipped(false);
    }, [sessionQueue]); // Added sessionQueue dependency

    // ... (currentCardStatusDisplay memo - ensure settingsRef.current is used) ...
    const currentCardStatusDisplay = useMemo(() => { /* ... */
        if (isLoadingData || isLoadingSettings) return 'Loading...';
        if (error) return `Error: ${error}`;
        if (showContinueReviewPrompt) return "Learning phase complete. Continue to review?";
        if (isComplete) return totalCardsInSession > 0 ? 'Session Complete!' : 'No cards to study.';
        const currentSettings = settingsRef.current; // Use the ref
        if (!currentSettings) return "Loading settings...";
        if (!currentQueueItem) {
            const delay = getNextDueCheckDelay(sessionQueue);
            if (delay !== null) {
                const diffSeconds = Math.ceil(delay / 1000);
                if (diffSeconds <= 1) return `Next card in ~1s`;
                if (diffSeconds < 60) return `Next card in ${diffSeconds}s`;
                const diffMinutes = Math.ceil(delay / (1000 * 60));
                return `Next card in ~${diffMinutes}m`;
            }
            return sessionQueue.length > 0 ? "Preparing next card..." : "No cards currently due.";
        }
        const { card, internalState } = currentQueueItem;
        if (card.srs_level === 0 && (card.learning_state === 'learning' || card.learning_state === null )) {
            if (currentSettings.studyAlgorithm === 'dedicated-learn' || currentSettings.enableDedicatedLearnMode) {
                return `Streak: ${internalState.streak}/${currentSettings.masteryThreshold}`;
            } else {
                const stepIdx = internalState.learningStepIndex ?? 0;
                const totalSteps = currentSettings.initialLearningStepsMinutes?.length || 0;
                return `Learn Step: ${stepIdx + 1}${totalSteps > 0 ? `/${totalSteps}` : ''}`;
            }
        } else if (card.srs_level === 0 && card.learning_state === 'relearning') {
            const stepIdx = internalState.learningStepIndex ?? 0;
            const totalSteps = currentSettings.relearningStepsMinutes?.length || 0;
            return `Relearning: Step ${stepIdx + 1}${totalSteps > 0 ? `/${totalSteps}` : ''}`;
        } else if (card.srs_level !== null && card.srs_level >= 1) {
            let levelText = `Lvl ${card.srs_level}`;
            if (card.srs_level === 1) levelText = "Status: New to Review";
            else if (card.srs_level >= 2 && card.srs_level <= 4) levelText = "Status: Getting Familiar";
            else if (card.srs_level > 4) levelText = "Status: Well Known";
        
            let dueText = `Interval: ${Math.round(card.interval_days || 0)}d`; // Default due text
            if (card.next_review_due) {
                const dueDate = parseISO(card.next_review_due);
                if (isValidDate(dueDate)) {
                    if (isToday(dueDate)) dueText = "Due Today!";
                    else if (isPast(dueDate)) dueText = "Review Now!";
                }
            }
            return `${levelText} • ${dueText}`;
        }
        return 'Studying...';
    }, [
        isLoadingData, isLoadingSettings, error, isComplete, currentQueueItem, sessionQueue,
        showContinueReviewPrompt, totalCardsInSession // settingsRef is stable, currentSettings is derived inside
    ]);


    return {
        currentCard, isInitializing: isLoadingData || isLoadingSettings, error, sessionType,
        isComplete, totalCardsInSession, currentCardNumberInSession, initialQueryCount,
        isProcessingAnswer, isFlipped, onFlip, sessionResults, answerCard,
        currentCardStatusDisplay, showContinueReviewPrompt, onContinueReview, isLoadingSettings, unifiedSessionPhase,
    };
}