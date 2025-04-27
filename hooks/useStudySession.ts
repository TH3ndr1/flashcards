'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardsByIds } from '@/lib/actions/cardActions'; // Assuming this action exists
import { updateCardProgress } from '@/lib/actions/progressActions'; // Assuming this action exists
import { calculateSm2State } from '@/lib/srs'; // Assuming this utility exists
import { useSettings } from '@/providers/settings-provider'; // Corrected path
import type { Database, Tables } from "@/types/database"; // Remove DbCard import, use Tables
import type { StudyInput, StudyMode } from '@/store/studySessionStore'; // Import types
import type { ResolvedCardId, StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // Import ResolvedCardId type
import type { ReviewGrade, Sm2UpdatePayload as SRSState } from '@/lib/srs'; // Import necessary types from srs
import { isAfter, parseISO, isValid, isToday, isPast } from 'date-fns'; // For checking due dates
import { debounce } from "@/lib/utils"; // If using debounce for progress updates
import { toast } from 'sonner'; // For potential error notifications

// Define the full card type expected after fetching
type StudyCard = Tables<'cards'>; // Use Tables<'cards'> instead of DbCard

// Define the structure returned by the hook
interface UseStudySessionReturn {
    currentCard: StudyCard | null;
    isInitializing: boolean;
    error: string | null;
    studyMode: StudyMode | null;
    isComplete: boolean;
    totalCardsInSession: number;
    currentCardNumber: number; // 1-based index for display
    initialSelectionCount: number; // Add count before mode filtering
    isProcessingAnswer: boolean; // Add processing state
    isFlipped: boolean; // Hook now manages flip state
    onFlip: () => void; // Action to trigger flip
    sessionResults: { correct: number, incorrect: number, completedInSession: number };
    answerCard: (grade: ReviewGrade) => Promise<void>;
}

interface UseStudySessionProps {
    initialInput: StudyInput | null;
    initialMode: StudyMode | null;
}

const PROGRESS_UPDATE_DEBOUNCE_MS = 1500; // Allow slightly longer debounce
const FLIP_DURATION_MS = 300; // Ensure consistency with page
const PROCESSING_DELAY_MS = FLIP_DURATION_MS + 50; // Delay slightly longer than flip

/**
 * Custom hook for managing study session state and logic.
 * 
 * This hook provides:
 * - Card progression and review scheduling
 * - Session state management
 * - Study statistics and progress tracking
 * - Integration with the spaced repetition system
 * 
 * @param {Object} params - Hook parameters
 * @param {Card[]} params.cards - Array of cards to study
 * @param {() => void} params.onComplete - Callback when the study session is completed
 * @param {(cardId: string, rating: number) => void} params.onRateCard - Callback for rating a card
 * @returns {Object} Study session state and controls
 * @returns {Card | null} returns.currentCard - Current card being studied
 * @returns {number} returns.progress - Session progress (0-1)
 * @returns {() => void} returns.nextCard - Function to move to next card
 * @returns {(rating: number) => void} returns.rateCard - Function to rate current card
 * @returns {boolean} returns.isComplete - Whether session is complete
 */
export function useStudySession({ 
    initialInput, 
    initialMode 
}: UseStudySessionProps): UseStudySessionReturn {
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [studyMode, setStudyMode] = useState<StudyMode | null>(initialMode);

    const [allFetchedCards, setAllFetchedCards] = useState<StudyCard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<StudyCard[]>([]); 
    const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
    const [learnModeProgress, setLearnModeProgress] = useState<Map<string, number>>(new Map());
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [initialSelectionCount, setInitialSelectionCount] = useState<number>(-1); // Initialize to -1 (unset)
    const [sessionResults, setSessionResults] = useState({ correct: 0, incorrect: 0, completedInSession: 0 });
    const [isProcessingAnswer, setIsProcessingAnswer] = useState<boolean>(false); // New state
    const [isFlipped, setIsFlipped] = useState<boolean>(false); // Add flip state here

    const { settings, loading: isLoadingSettings } = useSettings(); 
    const learnSuccessThreshold = useMemo(() => settings?.masteryThreshold ?? 3, [settings]);

    // --- Debounced Progress Update --- 
    const debouncedUpdateProgress = useCallback(
        debounce(async (updateArg: { cardId: string; grade: ReviewGrade; nextState: SRSState }) => {
            console.log(`[useStudySession] Debounced save for card ${updateArg.cardId}`);
            try {
                // Convert nextState (Sm2UpdatePayload) to the required CalculatedSrsState format
                await updateCardProgress({
                    cardId: updateArg.cardId,
                    grade: updateArg.grade,
                    nextState: {
                        easiness_factor: updateArg.nextState.easinessFactor,
                        interval_days: updateArg.nextState.intervalDays,
                        next_review_due: updateArg.nextState.nextReviewDue.toISOString(),
                        srs_level: updateArg.nextState.srsLevel
                    }
                });
            } catch (err) {
                 console.error(`[useStudySession] Failed to save progress for card ${updateArg.cardId}`, err);
                 toast.error("Failed to save progress for one card."); 
            }
        }, PROGRESS_UPDATE_DEBOUNCE_MS),
        [] 
    );

    // --- Initialization Effect --- 
    useEffect(() => {
        let isMounted = true; // Flag to prevent state updates if component unmounts during async ops

        const initializeSession = async () => {
            if (!initialInput || !initialMode) {
                if (isMounted) {
                    setError("Study parameters not provided.");
                    setIsInitializing(false);
                    setIsComplete(true);
                }
                return;
            }

            if (isMounted) {
                setIsInitializing(true);
                setError(null);
                setStudyMode(initialMode);
                setAllFetchedCards([]);
                setSessionQueue([]);
                setCurrentCardIndex(0);
                setIsComplete(false);
                setLearnModeProgress(new Map());
                setInitialSelectionCount(-1); // Reset count on new init
                setSessionResults({ correct: 0, incorrect: 0, completedInSession: 0 }); // Reset results on init
                setIsFlipped(false); // Reset flip on init
            }

            try {
                // 1. Resolve Card IDs
                console.log("[useStudySession] Resolving card IDs with input:", initialInput);
                const resolveResult = await resolveStudyQuery(initialInput);
                if (!isMounted) return; 

                if (resolveResult.error || !resolveResult.data) {
                    // Fix: Pass only string message to new Error
                    throw new Error(typeof resolveResult.error === 'string' ? resolveResult.error : "Failed to resolve card IDs.");
                }
                const cardIds = resolveResult.data;
                console.log(`[useStudySession] Resolved ${cardIds.length} card IDs.`);

                if (cardIds.length === 0) {
                    console.log("[useStudySession] No cards found for criteria.");
                    if (isMounted) {
                        setInitialSelectionCount(0); // Set count to 0
                        setIsComplete(true);
                        setIsInitializing(false);
                    }
                    return;
                }

                // 2. Fetch Full Card Data
                console.log("[useStudySession] Fetching full card data...");
                const cardsResult = await getCardsByIds(cardIds);
                 if (!isMounted) return; 

                if (cardsResult.error || !cardsResult.data) {
                    // Fix: Pass only string message to new Error
                     throw new Error(typeof cardsResult.error === 'string' ? cardsResult.error : "Failed to fetch card data.");
                }
                // Fix: Ensure fetched data is assigned correctly to StudyCard[] type
                const fetchedCards: StudyCard[] = cardsResult.data as StudyCard[]; 
                if (isMounted) {
                    setAllFetchedCards(fetchedCards);
                    setInitialSelectionCount(fetchedCards.length); // Set count after fetch
                }
                console.log(`[useStudySession] Fetched ${fetchedCards.length} cards.`);

                // 3. Prepare Initial Queue based on Mode
                let initialQueue: StudyCard[] = [];

                if (initialMode === 'learn') {
                    console.log("[useStudySession] Preparing Learn Mode queue.");
                    initialQueue = [...fetchedCards].sort(() => Math.random() - 0.5); 
                    if (isMounted) setLearnModeProgress(new Map(fetchedCards.map(card => [card.id, 0]))); 
                } else { // Review Mode
                    console.log("[useStudySession] Preparing Review Mode queue (based on day).");
                    initialQueue = fetchedCards
                        .filter(card => {
                            if (!card.next_review_due) {
                                return true; // Always include never reviewed
                            }
                            try {
                                const dueDate = parseISO(card.next_review_due);
                                // Check if date is valid AND is today or in the past
                                return isValid(dueDate) && (isToday(dueDate) || isPast(dueDate));
                            } catch (e) {
                                console.error(`[useStudySession] Invalid date format for card ${card.id}: ${card.next_review_due}`, e);
                                return false; // Exclude invalid dates
                            }
                        })
                        .sort((a, b) => {
                            // Sort: nulls first, then by date ascending
                            const timeA = a.next_review_due ? parseISO(a.next_review_due).getTime() : -Infinity; 
                            const timeB = b.next_review_due ? (isValid(parseISO(b.next_review_due)) ? parseISO(b.next_review_due).getTime() : Infinity) : -Infinity; 
                            if (isNaN(timeA) && isNaN(timeB)) return 0;
                            if (isNaN(timeA)) return 1; 
                            if (isNaN(timeB)) return -1;
                            return timeA - timeB; 
                        });
                    
                    console.log(`[useStudySession] Found ${initialQueue.length} cards due for review (day-based).`);
                     if (initialQueue.length === 0 && isMounted) {
                         console.log("[useStudySession] No cards due for review in this set (day-based).");
                         setIsComplete(true); 
                     }
                }
                
                if (isMounted) {
                    setSessionQueue(initialQueue);
                    setIsComplete(initialQueue.length === 0);
                    setCurrentCardIndex(0);
                }

            } catch (err: any) {
                console.error("[useStudySession] Initialization error:", err);
                if (isMounted) {
                     setError(err.message || "Failed to initialize study session.");
                     setIsComplete(true);
                     setInitialSelectionCount(0); // Set count to 0 on error
                }
            } finally {
                 if (isMounted) setIsInitializing(false);
            }
        };

        initializeSession();

        return () => { isMounted = false; }; // Cleanup function

    }, [initialInput, initialMode]); // Remove clearStudyParameters from dependency array

    // --- Flip Handler --- 
    const handleFlip = useCallback(() => {
      // Simple toggle, transition state managed by page or view component still if needed visually
      setIsFlipped(prev => !prev);
      console.log("[useStudySession] Flipping card");
    }, []);

    // --- Answer Handler --- 
    const answerCard = useCallback(async (grade: ReviewGrade) => {
        if (isProcessingAnswer || isComplete) return; // Prevent multiple calls or answering after completion

        const cardToAnswer = sessionQueue[currentCardIndex];
        if (!cardToAnswer) {
            console.error("[useStudySession] answerCard called but current card is invalid.");
            setError("Cannot process answer: current card not found.");
            return;
        }
        // --- START: Add explicit check for card ID --- 
        if (!cardToAnswer.id) {
            console.error("[useStudySession] answerCard called but current card has no ID.", cardToAnswer);
            setError("Cannot process answer: current card is missing an ID.");
            return;
        }
        const cardId = cardToAnswer.id; // Store the valid ID
        // --- END: Add explicit check for card ID ---

        console.log(`[useStudySession] Answering card ${cardId} with grade ${grade}`);
        setIsProcessingAnswer(true); 

        // Determine if answer is correct for session stats (grade >= 3 is correct)
        const isCorrect = grade >= 3;

        // 1. Calculate Next SRS State
        const currentSrsState = {
            srsLevel: cardToAnswer.srs_level ?? 0,
            easinessFactor: cardToAnswer.easiness_factor ?? 2.5,
            intervalDays: cardToAnswer.interval_days ?? 0,
        };
        // const srsAlgorithm = settings?.srs_algorithm ?? 'sm2'; // Algorithm selection if needed
        // Using calculateSm2State directly for now, assuming 'sm2'
        const nextSrsPayload: SRSState = calculateSm2State(currentSrsState, grade);

        // 2. Schedule Debounced DB Update using the validated cardId and the expected object structure
        debouncedUpdateProgress({ 
            cardId: cardId, 
            grade: grade, 
            nextState: nextSrsPayload 
        });

        // 3. Update Session Stats 
        setSessionResults(prev => ({
            ...prev,
            correct: isCorrect ? prev.correct + 1 : prev.correct,
            incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect,
        }));

        // 4. Determine NEXT state variables (without setting state yet)
        let nextIndex = currentCardIndex;
        let nextQueue = [...sessionQueue];
        let sessionComplete = false;
        let cardCompletedThisTurn = false; 

        if (studyMode === 'learn') {
             const currentStreak = learnModeProgress.get(cardId) ?? 0;
             const newStreak = isCorrect ? currentStreak + 1 : 0;
             const updatedLearnProgress = new Map(learnModeProgress).set(cardId, newStreak);             
             const cardSessionComplete = newStreak >= learnSuccessThreshold;

             if (cardSessionComplete) {
                 cardCompletedThisTurn = true; 
                 nextQueue.splice(currentCardIndex, 1); 
                 nextIndex = currentCardIndex; 
             } else if (!isCorrect) {
                  const failedCard = nextQueue.splice(currentCardIndex, 1)[0];
                  nextQueue.push(failedCard);
                  nextIndex = currentCardIndex; 
             } else {
                  nextIndex = currentCardIndex + 1;
             }
             sessionComplete = nextQueue.length === 0;
             if (!sessionComplete && nextIndex >= nextQueue.length) {
                 nextIndex = 0; 
             }
              // Update learn progress map immediately
             setLearnModeProgress(updatedLearnProgress); 
        } else { // Review Mode
            cardCompletedThisTurn = true; 
            nextIndex = currentCardIndex + 1; 
            sessionComplete = nextIndex >= nextQueue.length;
        }

        // Increment completed count if applicable (immediately)
        if (cardCompletedThisTurn) {
             setSessionResults(prev => ({ ...prev, completedInSession: prev.completedInSession + 1 }));
        }

        // 5. Use setTimeout to delay updating the card/queue state
        const timer = setTimeout(() => {
            console.log(`[useStudySession] Delayed state update: nextIndex=${nextIndex}, queueLength=${nextQueue.length}, complete=${sessionComplete}`);
            setSessionQueue(nextQueue);       // Update queue
            setCurrentCardIndex(nextIndex);   // Update index
            setIsComplete(sessionComplete);   // Update completion status
            setIsFlipped(false); // Reset flip state HERE
            setIsProcessingAnswer(false); // End processing
        }, PROCESSING_DELAY_MS); // Delay slightly longer than flip animation

        // Note: No cleanup function needed for this timeout in useCallback

    }, [currentCardIndex, sessionQueue, studyMode, isComplete, isLoadingSettings, learnSuccessThreshold, learnModeProgress, debouncedUpdateProgress, isInitializing, isProcessingAnswer]); // Removed onNewCard

    // --- Derived State --- 
    const currentCard = useMemo(() => {
        if (isInitializing || isLoadingSettings || isComplete || sessionQueue.length === 0 || currentCardIndex >= sessionQueue.length) {
            return null;
        }
        return sessionQueue[currentCardIndex];
    }, [isInitializing, isLoadingSettings, isComplete, sessionQueue, currentCardIndex]);

    const totalCardsInSession = sessionQueue.length;
    // Display 1-based index, show total if complete but queue had items
    const currentCardNumber = totalCardsInSession > 0 ? (isComplete ? totalCardsInSession : currentCardIndex + 1) : 0; 

    return {
        currentCard,
        isInitializing,
        error,
        studyMode,
        isComplete,
        totalCardsInSession,
        currentCardNumber, 
        initialSelectionCount, // Return the count
        sessionResults, // Return results
        isProcessingAnswer, // Return processing state
        isFlipped, // Return flip state
        onFlip: handleFlip, // Return flip action
        answerCard,
    };
} 