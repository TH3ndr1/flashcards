'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardsByIds } from '@/lib/actions/cardActions'; // Assuming this action exists
import { updateCardProgress } from '@/lib/actions/progressActions'; // Assuming this action exists
import { calculateSm2State } from '@/lib/srs'; // Assuming this utility exists
import { useSettings } from '@/providers/settings-provider'; // Corrected path
import type { Database, Tables, Json } from "@/types/database"; // Use correct path
import type { StudyInput, StudyMode } from '@/store/studySessionStore'; // Import types
import type { ResolvedCardId, StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // Import ResolvedCardId type
import { isAfter, parseISO } from 'date-fns'; // For checking due dates
import { debounce } from "@/lib/utils"; // If using debounce for progress updates
import { toast } from 'sonner'; // For potential error notifications

// Define the full card type expected after fetching
type StudyCard = Tables<'cards'>;
type ReviewGrade = 1 | 2 | 3 | 4;

// Define the explicit payload type expected by updateCardProgress
// Should match the relevant fields updated by calculateSm2State, using DB column names
interface CardProgressUpdatePayload {
    last_reviewed_at: string; // ISO string
    next_review_due: string; // ISO string
    srs_level: number;
    easiness_factor: number | null;
    interval_days: number | null;
    last_review_grade: ReviewGrade | null;
    // Include other potential fields if updateCardProgress handles them
    // correct_count?: number; 
    // incorrect_count?: number;
}

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
        debounce(async (cardId: string, updatePayload: CardProgressUpdatePayload) => { // Use explicit payload type
            console.log(`[useStudySession] Debounced save for card ${cardId}`);
            try {
                 await updateCardProgress(cardId, updatePayload);
            } catch (err) {
                 console.error(`[useStudySession] Failed to save progress for card ${cardId}`, err);
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
                const now = new Date(); // Get current time once

                if (initialMode === 'learn') {
                    console.log("[useStudySession] Preparing Learn Mode queue.");
                    initialQueue = [...fetchedCards].sort(() => Math.random() - 0.5); 
                    if (isMounted) setLearnModeProgress(new Map(fetchedCards.map(card => [card.id, 0]))); 
                } else { // Review Mode
                    console.log("[useStudySession] Preparing Review Mode queue.");
                    initialQueue = fetchedCards
                        .filter(card => {
                             // Corrected Filter: Include if never reviewed OR if due date is now or in the past
                             return !card.next_review_due || 
                                    (card.next_review_due && parseISO(card.next_review_due).getTime() <= now.getTime());
                        })
                        .sort((a, b) => {
                            // Corrected Sort: Prioritize null dates, then sort ascending
                            const timeA = a.next_review_due ? parseISO(a.next_review_due).getTime() : -Infinity; 
                            const timeB = b.next_review_due ? parseISO(b.next_review_due).getTime() : -Infinity;
                            return timeA - timeB; 
                        });
                    
                    console.log(`[useStudySession] Found ${initialQueue.length} cards due for review (including new).`);
                     if (initialQueue.length === 0 && isMounted) {
                         console.log("[useStudySession] No cards due for review in this set.");
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

    // --- answerCard Function (Refactored with Delay) --- 
    const answerCard = useCallback(async (grade: ReviewGrade) => {
        // Prevent answering if initializing or already processing
        if (isInitializing || isProcessingAnswer || isComplete || isLoadingSettings || currentCardIndex >= sessionQueue.length) return;

        const card = sessionQueue[currentCardIndex];
        if (!card) return;
        
        setIsProcessingAnswer(true); 
        console.log(`[useStudySession] Processing answer for card ${card.id} with grade ${grade}`);

        // 1. Calculate new SRS state
        const currentSrsState = { srsLevel: card.srs_level, easinessFactor: card.easiness_factor, intervalDays: card.interval_days };
        const srsResult = calculateSm2State(currentSrsState, grade); 
        
        // 2. Create the specific payload for the updateCardProgress action
        const progressUpdatePayload: CardProgressUpdatePayload = {
            last_reviewed_at: new Date().toISOString(), // Set current time
            next_review_due: srsResult.nextReviewDue.toISOString(), // Format date
            srs_level: srsResult.srsLevel,
            easiness_factor: srsResult.easinessFactor,
            interval_days: srsResult.intervalDays,
            last_review_grade: srsResult.lastReviewGrade
        };
        
        // 3. Schedule Debounced Save with the correct payload type
        debouncedUpdateProgress(card.id, progressUpdatePayload); 

        // 4. Update Session Stats 
        const isCorrect = grade >= 3;
        setSessionResults(prev => ({
            ...prev,
            correct: isCorrect ? prev.correct + 1 : prev.correct,
            incorrect: !isCorrect ? prev.incorrect + 1 : prev.incorrect,
        }));

        // 5. Determine NEXT state variables (without setting state yet)
        let nextIndex = currentCardIndex;
        let nextQueue = [...sessionQueue];
        let sessionComplete = false;
        let cardCompletedThisTurn = false; 

        if (studyMode === 'learn') {
             const currentStreak = learnModeProgress.get(card.id) ?? 0;
             const newStreak = isCorrect ? currentStreak + 1 : 0;
             const updatedLearnProgress = new Map(learnModeProgress).set(card.id, newStreak);             
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

        // 6. Use setTimeout to delay updating the card/queue state
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