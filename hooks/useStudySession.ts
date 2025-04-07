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
    isLoading: boolean;
    error: string | null;
    studyMode: StudyMode | null;
    isComplete: boolean;
    totalCardsInSession: number;
    currentCardNumber: number; // 1-based index for display
    answerCard: (grade: ReviewGrade) => Promise<void>; // Function to submit an answer
}

interface UseStudySessionProps {
    initialInput: StudyInput | null;
    initialMode: StudyMode | null;
}

const PROGRESS_UPDATE_DEBOUNCE_MS = 1500; // Allow slightly longer debounce

export function useStudySession({ initialInput, initialMode }: UseStudySessionProps): UseStudySessionReturn {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [studyMode, setStudyMode] = useState<StudyMode | null>(initialMode);

    const [allFetchedCards, setAllFetchedCards] = useState<StudyCard[]>([]);
    const [sessionQueue, setSessionQueue] = useState<StudyCard[]>([]); 
    const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
    const [learnModeProgress, setLearnModeProgress] = useState<Map<string, number>>(new Map());
    const [isComplete, setIsComplete] = useState<boolean>(false);

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
                    setIsLoading(false);
                    setIsComplete(true);
                }
                return;
            }

            if (isMounted) {
                setIsLoading(true);
                setError(null);
                setStudyMode(initialMode);
                setAllFetchedCards([]);
                setSessionQueue([]);
                setCurrentCardIndex(0);
                setIsComplete(false);
                setLearnModeProgress(new Map());
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
                        setIsComplete(true);
                        setIsLoading(false);
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
                if (isMounted) setAllFetchedCards(fetchedCards);
                console.log(`[useStudySession] Fetched ${fetchedCards.length} cards.`);

                // 3. Prepare Initial Queue based on Mode
                let initialQueue: StudyCard[] = [];
                const now = new Date();

                if (initialMode === 'learn') {
                    console.log("[useStudySession] Preparing Learn Mode queue.");
                    initialQueue = [...fetchedCards].sort(() => Math.random() - 0.5); 
                    if (isMounted) setLearnModeProgress(new Map(fetchedCards.map(card => [card.id, 0]))); 
                } else { 
                    console.log("[useStudySession] Preparing Review Mode queue.");
                    initialQueue = fetchedCards
                        .filter(card => card.next_review_due && isAfter(parseISO(card.next_review_due), now) === false) // Correct check: due date is now or in the past
                        .sort((a, b) => parseISO(a.next_review_due!).getTime() - parseISO(b.next_review_due!).getTime());
                    
                    console.log(`[useStudySession] Found ${initialQueue.length} cards due for review.`);
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
                }
            } finally {
                 if (isMounted) setIsLoading(false);
            }
        };

        initializeSession();

        return () => { isMounted = false; }; // Cleanup function

    }, [initialInput, initialMode]); // Only re-run if input parameters change


    // --- answerCard Function --- 
    const answerCard = useCallback(async (grade: ReviewGrade) => {
        if (isComplete || isLoading || isLoadingSettings || currentCardIndex >= sessionQueue.length) return;

        const card = sessionQueue[currentCardIndex];
        if (!card) return;
        
        console.log(`[useStudySession] Answering card ${card.id} with grade ${grade} in mode ${studyMode}`);

        // 1. Calculate new SRS state
         const currentSrsState = {
            srsLevel: card.srs_level,
            easinessFactor: card.easiness_factor,
            intervalDays: card.interval_days
         };
        const srsResult = calculateSm2State(currentSrsState, grade); 
        
        // 2. Create and Schedule Debounced Progress Update Payload
        const updatePayload: CardProgressUpdatePayload = {
            last_reviewed_at: new Date().toISOString(), // Set current time as last reviewed
            next_review_due: srsResult.nextReviewDue.toISOString(), // Format date to ISO string
            srs_level: srsResult.srsLevel,
            easiness_factor: srsResult.easinessFactor,
            interval_days: srsResult.intervalDays,
            last_review_grade: srsResult.lastReviewGrade
        };
        debouncedUpdateProgress(card.id, updatePayload);

        // 3. Mode-specific logic & queue management
        let nextIndex = currentCardIndex; // Start with current index
        let nextQueue = [...sessionQueue];
        let sessionComplete = false;

        if (studyMode === 'learn') {
            const currentStreak = learnModeProgress.get(card.id) ?? 0;
            const isCorrect = grade >= 3; 
            const newStreak = isCorrect ? currentStreak + 1 : 0;
            const updatedLearnProgress = new Map(learnModeProgress).set(card.id, newStreak);
            setLearnModeProgress(updatedLearnProgress); // Update map state
            
            const cardSessionComplete = newStreak >= learnSuccessThreshold;

            if (cardSessionComplete) {
                console.log(`[useStudySession] Card ${card.id} completed for Learn session.`);
                nextQueue.splice(currentCardIndex, 1); // Remove from queue
                // Index remains the same relative to the *new* shorter queue
            } else if (!isCorrect) {
                 console.log(`[useStudySession] Card ${card.id} incorrect in Learn session.`);
                 const failedCard = nextQueue.splice(currentCardIndex, 1)[0];
                 // Simple requeue at end - consider smarter placement
                 nextQueue.push(failedCard);
                 // Index remains the same relative to the *new* queue order
            } else {
                 // Correct, but not done - advance index if possible
                 nextIndex = currentCardIndex + 1;
            }
            
            // Check if the modified queue is empty
            if (nextQueue.length === 0) {
                sessionComplete = true;
            } else if (nextIndex >= nextQueue.length) {
                // If we were at the end and advanced past it (or removed last card)
                console.log("[useStudySession] Learn mode cycle complete, looping.");
                nextIndex = 0; // Loop back to the start of remaining cards
                // Optional: Reshuffle remaining cards each cycle?
                // nextQueue = [...nextQueue].sort(() => Math.random() - 0.5);
            }
            setSessionQueue(nextQueue); // Update the queue state

        } else { // Review Mode
            nextIndex = currentCardIndex + 1; // Simply advance index
            sessionComplete = nextIndex >= nextQueue.length;
        }
        
        setCurrentCardIndex(nextIndex);
        setIsComplete(sessionComplete);
        if(sessionComplete) console.log("[useStudySession] Session complete.");


    }, [currentCardIndex, sessionQueue, studyMode, isComplete, isLoading, isLoadingSettings, learnSuccessThreshold, learnModeProgress, debouncedUpdateProgress]);

    // --- Derived State --- 
    const currentCard = useMemo(() => {
        if (isLoading || isLoadingSettings || isComplete || sessionQueue.length === 0 || currentCardIndex >= sessionQueue.length) {
            return null;
        }
        return sessionQueue[currentCardIndex];
    }, [isLoading, isLoadingSettings, isComplete, sessionQueue, currentCardIndex]);

    const totalCardsInSession = sessionQueue.length;
    // Display 1-based index, show total if complete but queue had items
    const currentCardNumber = totalCardsInSession > 0 ? (isComplete ? totalCardsInSession : currentCardIndex + 1) : 0; 


    return {
        currentCard,
        isLoading: isLoading || isLoadingSettings, 
        error,
        studyMode,
        isComplete,
        totalCardsInSession,
        currentCardNumber, 
        answerCard,
    };
} 