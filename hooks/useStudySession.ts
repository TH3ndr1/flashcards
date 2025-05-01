// Fixed TypeScript errors - 2023-09-15
// hooks/useStudySession.ts
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardsByIds } from '@/lib/actions/cardActions';
import { updateCardProgress } from '@/lib/actions/progressActions'; // Assuming this action expects { cardId, grade, updatedFields: Partial<Tables<'cards'>> }
import {
  calculateSm2State,
  Sm2UpdatePayload,
  ReviewGrade,
  Sm2InputCardState,
  calculateNextStandardLearnStep,
  calculateNextRelearningStep,
  createGraduationPayload,
  createRelearningGraduationPayload,
} from '@/lib/srs'; // Assuming these utilities are in srs.ts
import { useSettings, type Settings } from '@/providers/settings-provider'; // Import Settings type
import type { Database, Tables, TablesUpdate } from "@/types/database"; // Import TablesUpdate
import type { StudyInput, StudyMode } from '@/store/studySessionStore';
import type { ResolvedCardId, StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import {
  isAfter,
  parseISO,
  isValid,
  isToday,
  isPast,
  addDays,
  addMinutes,
  startOfDay
} from 'date-fns';
import { debounce } from "@/lib/utils";
import { toast } from 'sonner';
// import { useAuth } from '@/hooks/use-auth'; // Assuming auth is managed globally/elsewhere if not used directly here

// Define card type from database Tables
type StudyCard = Tables<'cards'>;

// Define LearningState locally as it's a limited set of strings
type LearningState = 'learning' | 'relearning' | null;

/**
 * Represents the relevant SRS state of a card needed for calculations in lib/srs.ts.
 * Derived from StudyCard.
 */
type CardSrsState = Pick<StudyCard, 'srs_level' | 'easiness_factor' | 'interval_days' | 'learning_state' | 'learning_step_index' | 'next_review_due'>;


/**
 * Represents the internal state of a card within the study session queue.
 * This state is specific to the *current session instance*.
 */
export type InternalCardState = {
  streak: number;             // For dedicated-learn tracking consecutive correct answers in *current session*
  learningStepIndex: number | null; // Current position in learning/relearning steps array for *current session*
  dueTime: Date;              // When card is next due *within the session context* (now for immediate, future for timed steps)
  failedAttemptsInLearn: number; // Track 'Again' responses in learn mode for initial EF
  hardAttemptsInLearn: number;   // Track 'Hard' responses in learn mode for initial EF
};

/**
 * Represents a card item in the study session queue.
 * Combines the database card data with session-specific internal state.
 */
export type SessionCard = {
  card: StudyCard; // Full card data from DB
  internalState: InternalCardState; // State specific to this session instance
};

/**
 * Represents the aggregated results/stats for the current study session.
 */
export type SessionResults = {
  totalAnswered: number; // Total grades given
  correctCount: number;  // Grade >= 3
  incorrectCount: number; // Grade 1
  hardCount: number; // Grade 2
  easedCount: number; // Grade 4
  graduatedCount: number; // Cards graduating from Initial Learn or Relearn this session
  relapsedCount: number; // Cards lapsing from Review to Relearn this session
  // elapsedTimeMs: number; // Optional: Add timer logic if needed
};


// Define the structure returned by the hook
interface UseStudySessionReturn {
    currentCard: StudyCard | null; // The card data currently displayed
    isInitializing: boolean; // Is the hook loading data/preparing session
    error: string | null; // Any error message
    studyMode: StudyMode | null; // The mode of the current session ('learn' or 'review')
    isComplete: boolean; // Is the session finished
    totalCardsInSession: number; // Total cards initially loaded into the mode queue
    currentCardNumber: number; // 1-based index of the currently displayed card within the mode queue
    initialSelectionCount: number; // Total cards matching initial query criteria before mode filtering
    isProcessingAnswer: boolean; // Is the app currently processing an answer (UI locked)
    isFlipped: boolean; // Is the current card flipped to show the answer
    onFlip: () => void; // Action to trigger card flip
    sessionResults: Pick<SessionResults, 'totalAnswered' | 'correctCount' | 'incorrectCount'>; // Publicly exposed results (simplified)
    answerCard: (grade: ReviewGrade) => Promise<void>; // Action to grade a card
    currentCardStatusDisplay: string | null; // String like "Streak: 2/3", "Due in 5m" for UI display
    // debugQueue?: SessionCard[]; // Optional debug export
}

interface UseStudySessionProps {
    initialInput: StudyInput | null;
    initialMode: StudyMode | null;
}

const PROGRESS_UPDATE_DEBOUNCE_MS = 1500;
const FLIP_DURATION_MS = 300;
const PROCESSING_DELAY_MS = FLIP_DURATION_MS + 50; // Delay processing slightly longer than flip

/**
 * Custom hook for managing study session state and logic.
 */
export function useStudySession({ 
    initialInput, 
    initialMode 
}: UseStudySessionProps): UseStudySessionReturn {
    const { settings, loading: isLoadingSettings } = useSettings(); // Access settings and loading state
    // Study mode and input are derived from props
    const studyInput = initialInput;
    const studyMode = initialMode;
    // Session is initialized when input, mode, and settings are available and settings are not loading
    const isInitialized = Boolean(initialInput && initialMode && settings && !isLoadingSettings);

    // --- State Variables ---
    const [sessionQueue, setSessionQueue] = useState<SessionCard[]>([]); // The queue of cards for this session
    // currentCardIndex tracks the index of the card *currently being displayed* within sessionQueue
    const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true); // True during initial data fetch/queue prep
    const [isProcessingAnswer, setIsProcessingAnswer] = useState<boolean>(false); // True while processing an answer
    const [sessionResults, setSessionResults] = useState<SessionResults>({
      totalAnswered: 0, correctCount: 0, incorrectCount: 0, hardCount: 0, easedCount: 0, graduatedCount: 0, relapsedCount: 0
    });
    const [error, setError] = useState<string | null>(null);
    // State variable for the status display string (derived from internal state)
    const [currentCardStatusText, setCurrentCardStatusText] = useState<string | null>(null);

    // Total cards matching initial query criteria (set once during init)
    const [initialSelectionCount, setInitialSelectionCount] = useState<number>(-1);


    // Ref for timer to check for cards becoming due (timed steps)
    const dueCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
    // Ref for settings to use in async functions and callbacks
    const settingsRef = useRef<Settings | null>(null);


    // Update settings ref when settings change
    useEffect(() => {
      settingsRef.current = settings;
    }, [settings]);


    // --- Debounced Save Progress Function ---
    // This function takes the *final state of the card object* after logic is applied
    // and the grade that triggered the update.
    const debouncedUpdateProgress = useCallback(
      debounce(async (updateData: { cardToSave: StudyCard, grade: ReviewGrade }) => {
        const { cardToSave, grade } = updateData;
        console.log(`[debouncedUpdateProgress] Saving card ${cardToSave?.id} with grade ${grade}`);

        if (!cardToSave || !cardToSave.id) {
            console.error("[debouncedUpdateProgress] Attempted to save invalid card data (missing card or id).");
            toast.error("Failed to save progress for a card due to invalid data.");
            return;
        }

        try {
          // Cast learning_state to the specific union type expected by the schema
          const learningState = cardToSave.learning_state as LearningState;
          
          // Explicitly define the fixed payload with non-nullable required fields
          const payload = {
               srs_level: cardToSave.srs_level ?? 0,
               easiness_factor: cardToSave.easiness_factor ?? settings?.defaultEasinessFactor ?? 2.5, 
               interval_days: cardToSave.interval_days ?? 0, 
               next_review_due: cardToSave.next_review_due && isValid(parseISO(cardToSave.next_review_due)) 
                 ? cardToSave.next_review_due 
                 : new Date().toISOString(), // Ensure valid date string
               learning_state: learningState, // Already cast to the correct type
               learning_step_index: cardToSave.learning_step_index ?? null,
               failed_attempts_in_learn: cardToSave.failed_attempts_in_learn ?? 0,
               hard_attempts_in_learn: cardToSave.hard_attempts_in_learn ?? 0,
               attempt_count: cardToSave.attempt_count ?? 0, 
               correct_count: cardToSave.correct_count ?? 0,
               incorrect_count: cardToSave.incorrect_count ?? 0,
           };

          // The action sets last_reviewed_at and last_review_grade based on its grade parameter
          const result = await updateCardProgress({
            cardId: cardToSave.id,
            grade: grade, 
            updatedFields: payload,
          });

          if (result.error) {
            console.error(`Error updating card ${cardToSave.id} progress:`, result.error);
             toast.error(`Failed to save progress for card: ${cardToSave.id}`);
          } else {
             console.log(`Successfully saved progress for card ${cardToSave.id}.`);
             // Optional: toast.success(`Progress saved for ${cardToSave.id}`);
          }
        } catch (error) {
          console.error(`Exception saving progress for card ${cardToSave?.id}:`, error);
           toast.error(`Exception saving progress for card: ${cardToSave?.id}`);
            }
        }, PROGRESS_UPDATE_DEBOUNCE_MS),
      [settingsRef] // Depend on the settings ref
    );

    // --- Find the next card to study based on due time ---
    // Iterates through the queue from the beginning to find the first card ready now.
    // Returns the index of the first item where dueTime <= now, or queue.length if none are due.
    // This function does NOT modify state and does NOT schedule timers.
    const findNextCardIndex = useCallback((queue: SessionCard[]): number => {
        if (!queue || queue.length === 0) return queue.length; // Return length to signal empty/no-due

        const now = new Date();
        // Find the index of the first card that is due now or in the past
        const nextIndex = queue.findIndex(item => item.internalState.dueTime <= now);

        // If no card is currently due, findIndex returns -1. Map -1 to queue.length for consistency.
        return nextIndex !== -1 ? nextIndex : queue.length;
    }, []); // No dependencies on state, pure function of input queue


    // --- Schedule a check for the next due card ---
    // Finds the soonest *future* due time in the current queue and schedules a timer.
    // Called after queue state updates.
    const scheduleNextDueCheck = useCallback(() => {
         // Clear any existing timer
         if (dueCheckTimerRef.current) {
             clearTimeout(dueCheckTimerRef.current);
             dueCheckTimerRef.current = null;
         }

         // If session is complete or queue is empty, no need to schedule
         if (isComplete || sessionQueue.length === 0) return;

         // Find the soonest *future* due time in the current queue
         const now = new Date();
         let soonestFutureDueTime: Date | null = null;

         // Iterate through the queue to find the earliest future due time
         // Assumes sessionQueue is sorted by dueTime
         for (const item of sessionQueue) {
             if (item.internalState.dueTime > now) {
                 soonestFutureDueTime = item.internalState.dueTime;
                 break; // Found the soonest future one since it's sorted
             }
         }

         // If found a future due time, schedule a timer
         if (soonestFutureDueTime) {
             const delay = soonestFutureDueTime.getTime() - now.getTime() + 100; // Add a small buffer

             dueCheckTimerRef.current = setTimeout(() => {
                  console.log("[useStudySession] Due check timer fired. Triggering queue re-evaluation.");
                  // Trigger re-evaluation by updating queue state (shallow copy to force render)
                  // This will cause the currentCard memo (which calls findNextCardIndex) to re-run.
                  setSessionQueue([...sessionQueue]);
             }, Math.max(delay, 100)); // Minimum 100ms delay
             console.log(`[useStudySession] Scheduled next due check in ${Math.max(delay, 100)}ms.`);
         } else {
             // No future cards are due in the queue. No timer needed.
             console.log("[useStudySession] No future cards to schedule check for.");
         }
     }, [isComplete, sessionQueue]); // Dependency on sessionQueue to re-schedule when queue changes


    // --- Initialize the session when dependencies are ready ---
    useEffect(() => {
      let isMounted = true; // Flag to prevent state updates on unmounted component

      async function initializeSession() {
        try {
          // Wait for initial parameters and settings to be loaded
          // Only initialize if hook is not already loading and dependencies are ready
          if (!isLoading && !isInitialized) {
               console.log("[useStudySession] Waiting for initialization dependencies (input, mode, settings)...");
               return; // Exit if not ready
          }
          // If already initialized and dependencies haven't changed, do nothing
           if (!isLoading && sessionQueue.length > 0 && initialSelectionCount > -1 && !isComplete) {
                console.log("[useStudySession] Session already initialized with existing queue.");
                // If the hook was unmounted and remounted, the timer might be gone. Re-schedule it.
                 scheduleNextDueCheck(); // Schedule check based on existing queue
                return;
            }


          console.log(`[useStudySession] Starting session initialization for Mode: ${studyMode}`);
          setIsLoading(true);
                setError(null);
                setIsComplete(false);
          setSessionQueue([]); // Clear previous session state
          setCurrentCardIndex(0); // Reset index
          setSessionResults({ totalAnswered: 0, correctCount: 0, incorrectCount: 0, hardCount: 0, easedCount: 0, graduatedCount: 0, relapsedCount: 0 });
          setIsFlipped(false);
          setInitialSelectionCount(-1); // Reset count for new init
          setCurrentCardStatusText(null); // Clear status display

           // Clear any old timers
           if (dueCheckTimerRef.current) {
             clearTimeout(dueCheckTimerRef.current);
             dueCheckTimerRef.current = null;
           }


          // 1. Get card IDs based on study input (resolveQuery handles StudySet/Deck/etc)
          let cardIds: string[] = [];
          let resolveResult;

          // Adapt resolveStudyQuery call based on the structure of StudyInput
          if (studyInput && 'studySetId' in studyInput && studyInput.studySetId) {
              console.log(`[useStudySession] Resolving Study Set: ${studyInput.studySetId}`);
              resolveResult = await resolveStudyQuery({ studySetId: studyInput.studySetId });
          } else if (studyInput && 'criteria' in studyInput && studyInput.criteria) {
               console.log(`[useStudySession] Resolving Study Criteria:`, studyInput.criteria);
               resolveResult = await resolveStudyQuery({ criteria: studyInput.criteria });
          } else if (studyInput && 'deckId' in studyInput && studyInput.deckId) {
               // For a specific deck, resolve ALL cards in the deck first by ID
               console.log(`[useStudySession] Resolving Deck ID: ${studyInput.deckId}`);
               resolveResult = await resolveStudyQuery({ 
                 criteria: { 
                   deckId: studyInput.deckId as string,
                   tagLogic: "ANY",
                   includeDifficult: true
                 } 
               });
          } else {
              console.error("[useStudySession] Invalid study input configuration:", studyInput);
              throw new Error('Invalid study input configuration');
          }


          if (!isMounted) return; // Check mount status after async op
                if (resolveResult.error || !resolveResult.data) {
            console.error("[useStudySession] Failed to resolve card IDs:", resolveResult.error);
            // If the query failed, set initial count to 0 to indicate nothing was found
            setInitialSelectionCount(0);
            throw new Error(resolveResult.error || 'Failed to resolve study query');
          }
          cardIds = resolveResult.data;
          console.log(`[useStudySession] Resolved ${cardIds.length} card IDs from query`);

          // Set total cards matching criteria (before mode filtering)
          setInitialSelectionCount(cardIds.length);

                if (cardIds.length === 0) {
            console.log("[useStudySession] No card IDs found matching criteria.");
                    if (isMounted) {
              setIsLoading(false);
                        setIsComplete(true);
              setCurrentCardStatusText('No cards found matching criteria.');
            }
            return; // Exit initialization
          }

          // 2. Fetch full card data for all resolved IDs
          const cardResult = await getCardsByIds(cardIds);
          if (!isMounted) return; // Check mount status
          if (cardResult.error || !cardResult.data) {
            console.error("[useStudySession] Failed to fetch cards:", cardResult.error);
             // If fetching failed, set initial count to the number of IDs found but couldn't fetch
             // setInitialSelectionCount(cardIds.length); // Keep the count of resolved IDs
            throw new Error(cardResult.error || 'Failed to fetch cards');
          }
          const fetchedCards: StudyCard[] = cardResult.data;
          console.log(`[useStudySession] Fetched ${fetchedCards.length} cards for session.`);

          // 3. CRITICAL: Filter fetched cards to create the *initial* queue based on Study Mode
          let initialQueueCards: StudyCard[] = [];
          const now = new Date();

          if (studyMode === 'learn') {
            // Learn mode queue: cards with srs_level=0 and not in relearning
            // These are the cards needing initial learning or reset learning
            initialQueueCards = fetchedCards.filter(card =>
                 card.srs_level === 0 && card.learning_state !== 'relearning'
            );
            console.log(`[useStudySession] Filtered ${initialQueueCards.length} cards for Learn mode queue.`);

          } else if (studyMode === 'review') {
            // Review mode queue: cards in review state OR relearning state that are currently DUE
            initialQueueCards = fetchedCards.filter(card => {
                 const isReviewOrRelearning = (card.srs_level >= 1 && card.learning_state === null) ||
                                              (card.srs_level === 0 && card.learning_state === 'relearning');

                 // A card is due if its next_review_due is null OR <= now()
                 // Review mode should ideally only get cards already scheduled (non-null next_review_due)
                 // If the query was for 'isDue', it might include NULLs, but filter them out for Review mode queue
                 const isScheduledAndDue = card.next_review_due && isValid(parseISO(card.next_review_due)) && parseISO(card.next_review_due) <= now;

                 // For Review mode queue, we only want cards that are *scheduled* and due (srs_level >= 1 or relearning)
                 return isReviewOrRelearning && isScheduledAndDue;
            });

            console.log(`[useStudySession] Filtered ${initialQueueCards.length} cards for Review mode queue (due).`);
          }


          // --- Handle empty queue after filtering ---
          if (initialQueueCards.length === 0) {
            console.log(`[useStudySession] No cards filtered into ${studyMode} queue.`);
                if (isMounted) {
              setIsLoading(false);
              setIsComplete(true);
              setCurrentCardStatusText(
                studyMode === 'learn'
                  ? (fetchedCards.length > 0 ? 'No new cards in selection' : 'No cards found matching criteria.')
                  : (fetchedCards.length > 0 ? 'No cards due for review in selection' : 'No cards found matching criteria.')
              );
            }
            return; // Exit initialization
          }

          // 4. Create session queue with internal state
          // sessionStartTimeRef.current = new Date(); // Start timer here if needed

          const newSessionQueue: SessionCard[] = initialQueueCards.map(card => {
            const internalState: InternalCardState = {
              // Initialize state relevant for the session based on card's *initial* DB state
              streak: 0, // Streak starts at 0 for the session
              learningStepIndex: card.learning_step_index, // Carry over step index from DB
              // failedAttemptsInLearn and hardAttemptsInLearn are tracked on the card object, not internal state
              // Set initial dueTime for session queue management
              // Review cards use their DB due date for initial sorting/finding
              // Learn cards start as immediately due (now())
              dueTime: studyMode === 'review' && card.next_review_due ? parseISO(card.next_review_due) : new Date(),
              failedAttemptsInLearn: card.failed_attempts_in_learn ?? 0,
              hardAttemptsInLearn: card.hard_attempts_in_learn ?? 0,
            };

            // IMPORTANT: For truly new cards (srs_level=0, learning_state=null) entering Learn mode,
            // explicitly set their state to 'learning' and step 0 *here* for the session queue item
            // This is the transition from 'new' to 'learning' state for the session/saving
            if (studyMode === 'learn' && card.srs_level === 0 && !card.learning_state) {
                 // Update card object itself (copy) for saving later
                 card = { ...card, learning_state: 'learning', learning_step_index: 0 };
                 // Update internal internalState as well
                 internalState.learningStepIndex = 0;
            }


            return { card: { ...card }, internalState }; // Clone card again to be safe
          });

          // 5. Sort the initial queue by due time (earliest first)
          const sortedQueue = [...newSessionQueue].sort((a, b) =>
            a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime()
          );
                
                if (isMounted) {
            setSessionQueue(sortedQueue);
            // Find the first card that is due *now* from the sorted queue
            const initialNextCardIndex = findNextCardIndex(sortedQueue);

             // Set the current index to the first due card, or queue.length to signal 'waiting' state
             setCurrentCardIndex(initialNextCardIndex); // findNextCardIndex returns index or queue.length


            setIsLoading(false);
            // scheduleNextDueCheck() will be triggered by the queue state update effect
          }

        } catch (err) {
          console.error('[useStudySession] Error during initialization:', err);
                if (isMounted) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during setup.');
            setIsLoading(false);
            setIsComplete(true); // Mark as complete on error
             // setCurrentStatusText will show the error via the memo
          }
        }
      }

        // Effect runs when isInitialized becomes true (initialInput, initialMode, settings load)
        // Dependencies: Re-run when init parameters/settings are ready change
        // Include isLoadingSettings as a dependency because settings might load asynchronously
        initializeSession();

      // Cleanup function for the effect
      return () => {
        isMounted = false;
        // Clear any scheduled timer when component unmounts or dependencies change (triggering re-init)
        if (dueCheckTimerRef.current) {
          clearTimeout(dueCheckTimerRef.current);
          dueCheckTimerRef.current = null;
        }
      };
    }, [isInitialized, studyInput, studyMode, settings, isLoadingSettings]);


    // Effect to re-schedule the timer whenever the queue changes, if not complete
    useEffect(() => {
        // This effect handles scheduling the *next* timer if the queue state changes (after answer, init, etc.)
        if (!isComplete && sessionQueue.length > 0) {
             // scheduleNextDueCheck() will find the next future due time in the *new* queue and schedule the timer
             scheduleNextDueCheck();
        } else if (isComplete && dueCheckTimerRef.current) {
             // If session becomes complete, clear any pending timer
             clearTimeout(dueCheckTimerRef.current);
             dueCheckTimerRef.current = null;
        }
         // Cleanup timer on effect re-run or component unmount is handled in the initialization effect's cleanup

    }, [sessionQueue, isComplete, scheduleNextDueCheck]);


    // --- Get the currently displayed SessionCard item ---
    // This memo finds the card to display based on the currentCardIndex state
    const currentQueueItem = useMemo(() => {
      // If session is loading, complete, queue is empty, or index is out of bounds, no card item to display
      // currentCardIndex can be queue.length to signal the 'waiting' state
      if (isLoading || isComplete || !sessionQueue || sessionQueue.length === 0 || currentCardIndex < 0 || currentCardIndex > sessionQueue.length) {
          // console.log("[currentQueueItem] Returning null based on state or index bounds.", {isLoading, isComplete, queueLength: sessionQueue.length, currentCardIndex});
          return null;
      }

       // If currentCardIndex is queue.length, it means we are in the waiting state (no cards currently due)
       if (currentCardIndex === sessionQueue.length) {
           // console.log("[currentQueueItem] Returning null due to waiting state index.");
           return null;
       }

       // Return the item at the currentCardIndex state
       // The findNextCardIndex logic is now responsible for setting the currentCardIndex state correctly
       //console.log(`[currentQueueItem] Displaying card at index ${currentCardIndex}`);
      return sessionQueue[currentCardIndex];

    }, [isLoading, isComplete, sessionQueue, currentCardIndex]); // Depends on the state variables


    // The actual StudyCard object returned by the hook
    const currentCard = currentQueueItem ? currentQueueItem.card : null;


    // Calculate total cards in session (count after mode filtering during init)
    const totalCardsInSession = useMemo(() => {
        // Use the count after the mode-specific filtering set during initialization
        // If initialSelectionCount is -1 (init not finished or error), use queue length as fallback
        return initialSelectionCount > -1 ? initialSelectionCount : sessionQueue.length;
    }, [initialSelectionCount, sessionQueue.length]); // Depends on the count set after filtering

    // Calculate current card number (1-based index of the currently displayed card)
    const currentCardNumber = useMemo(() => {
        if (!currentQueueItem) {
            // If no current item, and session is complete but queue wasn't empty, show total count
            if (isComplete && totalCardsInSession > 0) return totalCardsInSession;
            return 0; // No card displayed, or session empty from start
        }
        // Find the 0-based index of the current item within the *full* session queue + 1
        // currentCardIndex state should already be the correct index
        return currentCardIndex + 1;
    }, [currentQueueItem, currentCardIndex, isComplete, totalCardsInSession]); // Depends on the current displayed item and its index


    // Derived status display (memoized)
    const currentCardStatusDisplay = useMemo(() => {
        if (isLoading) return 'Loading session...';
        if (error) return `Error: ${error}`;
        if (isComplete) return totalCardsInSession > 0 ? 'Session Complete!' : 'No cards to study.';
        if (!settings || isLoadingSettings) return 'Loading settings...'; // Wait for settings to display status

        // If queue is not empty, but no card is currently displayed (waiting for timed step)
        if (!currentQueueItem && sessionQueue.length > 0) {
            const now = new Date();
            // Find the soonest future due time from the *entire* queue (which is sorted)
            // The first item in the sorted queue that is > now() is the soonest future one
            let soonestFutureDueItem = sessionQueue.find(item => item.internalState.dueTime > now);

            if (soonestFutureDueItem) {
                 const diffMs = soonestFutureDueItem.internalState.dueTime.getTime() - now.getTime();
                 const diffSeconds = Math.ceil(diffMs / 1000);
                 if (diffSeconds <= 1) return `Next card due in ~1s`; // Round up to 1 sec if < 1 sec
                 if (diffSeconds < 60) return `Next card due in ${diffSeconds}s`;
                 const diffMinutes = Math.ceil(diffMs / (1000 * 60));
                 if (diffMinutes <= 1) return `Next card due in ~1m`; // Round up to 1 min if < 1 min
                 if (diffMinutes < 60) return `Next card due in ${diffMinutes}m`;
                 const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                 if (diffHours <= 24) return `Next card due in ${diffHours}h`;
                 // Format date like "MMM dd"
                 return setCurrentCardStatusText(`Next card due on ${soonestFutureDueItem.internalState.dueTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
            } else {
                 // This case means queue is not empty, but no card is due now or in future (shouldn't happen if logic is right)
                 return 'Waiting... (No future due times)';
            }
        }

        // If a currentQueueItem exists, display its specific status
        if (currentQueueItem) {
             const card = currentQueueItem.card;
             const internalState = currentQueueItem.internalState;

             if (card.srs_level === 0 && card.learning_state === 'learning') {
                 if (settings.studyAlgorithm === 'dedicated-learn') {
                      return `Streak: ${internalState.streak}/${settings.masteryThreshold}`;
                 } else { // Standard SM-2 Learn
                      const stepIndex = internalState.learningStepIndex || 0; // Use internal state's step index
                      const totalSteps = settings.initialLearningStepsMinutes?.length || 0;
                      return `Learn Step: ${stepIndex + 1}${totalSteps > 0 ? '/' + totalSteps : ''}`;
                 }
             } else if (card.srs_level === 0 && card.learning_state === 'relearning') {
                 const stepIndex = internalState.learningStepIndex || 0; // Use internal state's step index
                 const totalSteps = settings.relearningStepsMinutes?.length || 0;
                 return `Relearning: Step ${stepIndex + 1}${totalSteps > 0 ? '/' + totalSteps : ''}`;
             } else if (card.srs_level >= 1 && card.learning_state === null) {
                 // Standard Review
                 const interval = Math.round(card.interval_days || 0); // Round interval for display
                 let displayText = `Reviewing (Level ${card.srs_level}) • Interval: ${interval} day${interval === 1 ? '' : 's'}`;
                 // Add more specific due time if it's due today
                 const cardDueDate = card.next_review_due ? parseISO(card.next_review_due) : null;
                 if (cardDueDate && isValid(cardDueDate) && isToday(cardDueDate)) {
                     displayText = `Reviewing (Level ${card.srs_level}) • Due Today`;
                 } else if (cardDueDate && isValid(cardDueDate) && isPast(cardDueDate) && !isToday(cardDueDate)) {
                     displayText = `Reviewing (Level ${card.srs_level}) • Overdue`;
                 }
                 return displayText;
             } else if (card.srs_level === 0 && card.learning_state === null && studyMode === 'learn') {
                  // This is the initial 'new' state encountered in Learn mode if not filtered/mapped correctly in init
                  // Should transition to learning state in init
                  return 'New Card (Initializing...)'; // Should not remain in this state
             } else {
                 // Catch any unexpected state or cards not meant for this mode
                 return 'Studying... (Unknown State)';
             }
        }

        // Fallback status - should ideally be covered by isComplete/error/isLoading/waiting
        return null;

    }, [currentQueueItem, isLoading, error, isComplete, sessionQueue, totalCardsInSession, settings, isLoadingSettings, studyMode]);


    // Handle card flipping
    const onFlip = useCallback(() => {
      // Use currentQueueItemState (calculated by memo)
      if (!currentQueueItem || isProcessingAnswer || isComplete) return;
      setIsFlipped(prev => !prev);
    }, [currentQueueItem, isProcessingAnswer, isComplete]); // Depend on currentQueueItemState


    // Handle answering a card
    const answerCard = useCallback(async (grade: ReviewGrade) => {
      // Only allow answering if a card is currently displayed, not processing, and not complete
      // Use currentQueueItemState (calculated by memo)
      if (!currentQueueItem || isProcessingAnswer || isComplete || !settings) { // Depends on settings here directly
          console.log("[answerCard] Ignoring answer: processing, complete, no card, or settings missing.");
            return;
        }

      setIsProcessingAnswer(true); // Lock input
      setIsFlipped(true); // Auto-flip back to front/answer side before processing

      console.log(`[answerCard] Answering card ${currentQueueItem.card.id} (Mode: ${studyMode}, State: ${currentQueueItem.card.learning_state}/${currentQueueItem.card.srs_level}) with grade ${grade}`);

      // Use setTimeout to delay processing until flip animation completes (roughly)
      setTimeout(async () => {
          // Create copies of the current card and its internal state for updates
          // Use currentQueueItemState (calculated by memo)
          const updatedCard = { ...currentQueueItem.card };
          const currentInternalState = { ...currentQueueItem.internalState }; // Ensure all internalState fields are copied
          const nextQueue = [...sessionQueue]; // Copy the queue to modify

          // Find the index of the card we are CURRENTLY answering in the queue copy
          // Use currentQueueItemState (calculated by memo)
          const queueItemIndex = nextQueue.findIndex(item => item.card.id === updatedCard.id);
          if (queueItemIndex === -1) {
               console.error("[answerCard] Cannot find current card in queue copy. Aborting processing.", updatedCard.id);
               setIsProcessingAnswer(false);
               setIsFlipped(false);
               // Schedule next check in case other cards became due (based on potentially unchanged queue state)
               scheduleNextDueCheck(); // This depends on sessionQueue state, which hasn't changed yet
               return; // Should not happen in a functional app
          }

          // Remove the card from its *current* position in the queue copy.
          // It will be re-added later if it stays in the session queue.
          const [answeredQueueItem] = nextQueue.splice(queueItemIndex, 1); // Use splice to remove


          // --- Update Session Results & General Card Stats ---
          setSessionResults(prev => {
              const newResults = { ...prev, totalAnswered: prev.totalAnswered + 1 };
              // Update counts based on grade
              if (grade === 1) { newResults.incorrectCount++; } // Relapse count updated during state transition check below
              else if (grade === 2) newResults.hardCount++;
              else if (grade === 3) newResults.correctCount++;
              else if (grade === 4) newResults.easedCount++;
              // graduatedCount and relapsedCount are updated below during state transitions
              return newResults;
          });

          // Update general stats on the card object itself for saving
          updatedCard.attempt_count = (updatedCard.attempt_count || 0) + 1;
          if (grade >= 3) {
            updatedCard.correct_count = (updatedCard.correct_count || 0) + 1;
          } else if (grade === 1) {
            updatedCard.incorrect_count = (updatedCard.incorrect_count || 0) + 1;
          }

          // Update last reviewed timestamp and grade on the card object for saving
          updatedCard.last_reviewed_at = new Date().toISOString();
          updatedCard.last_review_grade = grade;

          // --- Determine NEXT State and Queue based on Current State and Algorithm ---
          let nextSrsPayload: Sm2UpdatePayload | null = null; // Payload calculated by SRS functions
          let shouldRemoveFromQueue = false; // Should this card be removed from the session queue permanently?
          let reAddToQueue = false; // Should this card be added back to the *end* or a specific position?
          let reinsertCard: SessionCard | null = null; // The item to potentially re-add to the queue
          let reinsertIndex: number | null = null; // Position for re-insertion if applicable

          // Use settingsRef.current for settings within the async function
          const currentSettings = settingsRef.current!; // settings is guaranteed here by the initial check


          // --- Handle the card based on its CURRENT state ---

          // Case 1: Card is currently in Initial Learning state (srs_level = 0, learning_state = 'learning')
          if (answeredQueueItem.card.srs_level === 0 && answeredQueueItem.card.learning_state === 'learning') {
               console.log(`[answerCard] Processing Initial Learning state (srs_level=0, learning_state=learning)`);

               // Update learning attempt counters on the card object (only increment in initial learning)
               if (grade === 1) updatedCard.failed_attempts_in_learn = (updatedCard.failed_attempts_in_learn || 0) + 1;
               if (grade === 2) updatedCard.hard_attempts_in_learn = (updatedCard.hard_attempts_in_learn || 0) + 1;
                // Update internal state counters (redundant but keeps internal state consistent)
               currentInternalState.failedAttemptsInLearn = updatedCard.failed_attempts_in_learn;
               currentInternalState.hardAttemptsInLearn = updatedCard.hard_attempts_in_learn;


               // --- Branch based on Learning Algorithm Setting ---
               if (currentSettings.enableDedicatedLearnMode) {
                    // --- Custom Learn Mode Logic (Streak) ---
                     console.log(`[answerCard] Using Dedicated Learn logic`);
                    let newStreak = currentInternalState.streak;

                    if (grade === 1) newStreak = 0; // Again: Reset streak
                    else if (grade === 2) newStreak = Math.max(0, newStreak); // Hard: Keep streak as is (do not increment, do not reset)
                    else if (grade === 3) newStreak++; // Good: Increment streak
                    else if (grade === 4) newStreak += 2; // Easy: Increment streak by 2

                    currentInternalState.streak = newStreak; // Update internal state streak

                    // Check for Graduation
                    if (newStreak >= currentSettings.masteryThreshold || grade === 4) { // Graduating (threshold or Easy)
                         console.log(`[answerCard] Card ${updatedCard.id} graduating from Dedicated Learn (Streak: ${newStreak}).`);
                        shouldRemoveFromQueue = true; // Remove from session queue permanently
                         setSessionResults(prev => ({ ...prev, graduatedCount: prev.graduatedCount + 1 })); // Count graduation

                         // Calculate initial SM-2 state upon graduation (srs_level=1)
                         nextSrsPayload = createGraduationPayload(
                             grade,
                             updatedCard.failed_attempts_in_learn, // Pass final counts from card object
                             updatedCard.hard_attempts_in_learn,
                             currentSettings
                         );
                         // Update card object fields for saving
                         updatedCard.srs_level = nextSrsPayload.srsLevel; // 1
                         updatedCard.learning_state = nextSrsPayload.learningState; // null
                         updatedCard.learning_step_index = nextSrsPayload.learningStepIndex; // null
                         updatedCard.easiness_factor = nextSrsPayload.easinessFactor;
                         updatedCard.interval_days = nextSrsPayload.intervalDays; // Integer days for first review
                         updatedCard.next_review_due = nextSrsPayload.nextReviewDue 
                            ? nextSrsPayload.nextReviewDue.toISOString() 
                            : new Date().toISOString();
                         // Reset learning counters in the card object upon graduation
                         updatedCard.failed_attempts_in_learn = 0;
                         updatedCard.hard_attempts_in_learn = 0;


                    } else { // Not Graduated - Re-queue in session
                         console.log(`[answerCard] Card ${updatedCard.id} continues in Dedicated Learn (Streak: ${newStreak}).`);
                        shouldRemoveFromQueue = false; // Stays in queue
                         reAddToQueue = true; // Mark to be re-added

                         // Determine re-queue position based on grade and setting
                         if (grade === 1 || grade === 2) { // Again or Hard: Re-insert after a gap
                              reinsertIndex = Math.min(queueItemIndex + currentSettings.customLearnRequeueGap, nextQueue.length);
                         } else { // Good or Easy (if Easy didn't graduate): Move to end of queue
                             reinsertIndex = nextQueue.length; // Add to the end
                         }

                         // internalState needs updating (streak, counters). dueTime remains now().
                         currentInternalState.dueTime = new Date(); // Keep it immediately due

                         // Create the item to re-add
                         reinsertCard = { card: updatedCard, internalState: currentInternalState };
                    }

               } else { // settings.enableDedicatedLearnMode === FALSE (Standard SM-2 Learn Steps)
                    console.log(`[answerCard] Using Standard SM-2 Learn logic`);
                    currentInternalState.learningStepIndex = answeredQueueItem.internalState.learningStepIndex ?? 0;

                    // Calculate next state using standard learning steps
                    const stepResult = calculateNextStandardLearnStep(currentInternalState.learningStepIndex, grade, currentSettings);

                    if (stepResult.nextStepIndex === 'graduated') { // Completed steps or Easy grade
                         console.log(`[answerCard] Card ${updatedCard.id} graduating from Standard Learn.`);
                        shouldRemoveFromQueue = true; // Remove from session queue permanently
                         setSessionResults(prev => ({ ...prev, graduatedCount: prev.graduatedCount + 1 })); // Count graduation

                         // Calculate initial SM-2 state upon graduation (srs_level=1)
                         nextSrsPayload = createGraduationPayload(
                             grade,
                             updatedCard.failed_attempts_in_learn, // Pass final counts
                             updatedCard.hard_attempts_in_learn,
                             currentSettings
                         );
                         // Update card object fields for saving
                         updatedCard.srs_level = nextSrsPayload.srsLevel;
                         updatedCard.learning_state = nextSrsPayload.learningState; // null
                         updatedCard.learning_step_index = nextSrsPayload.learningStepIndex; // null
                         updatedCard.easiness_factor = nextSrsPayload.easinessFactor;
                         updatedCard.interval_days = nextSrsPayload.intervalDays; // Integer days for first review
                         updatedCard.next_review_due = nextSrsPayload.nextReviewDue?.toISOString() || '';
                          // Reset learning counters in the card object upon graduation
                         updatedCard.failed_attempts_in_learn = 0;
                         updatedCard.hard_attempts_in_learn = 0;


                    } else { // Card continues in standard learning steps
                         console.log(`[answerCard] Card ${updatedCard.id} continues in Standard Learn step ${stepResult.nextStepIndex}.`);
                        shouldRemoveFromQueue = false; // Stays in queue
                         reAddToQueue = true; // Mark to be re-added (to be sorted by dueTime)
                         reinsertIndex = nextQueue.length; // Add to end initially, then sort

                         // Update internal state (next step index and due time)
                         currentInternalState.learningStepIndex = stepResult.nextStepIndex as number;
                         currentInternalState.dueTime = stepResult.nextDueTime; // Timed step due time

                         // Update card object fields for saving (state and next due time)
                         updatedCard.learning_state = 'learning'; // Explicitly set state
                         updatedCard.learning_step_index = currentInternalState.learningStepIndex;
                         updatedCard.next_review_due = currentInternalState.dueTime 
                             ? currentInternalState.dueTime.toISOString()
                             : new Date().toISOString();
                         // Failed/hard attempt counters are incremented above and saved on the card object

                         // Create the item to re-add
                         reinsertCard = { card: updatedCard, internalState: currentInternalState };
                    }
               }
          }

          // Case 2: Card is currently in Relearning state (srs_level = 0, learning_state = 'relearning')
          else if (answeredQueueItem.card.srs_level === 0 && answeredQueueItem.card.learning_state === 'relearning') {
               console.log(`[answerCard] Processing Relearning state (srs_level=0, learning_state=relearning)`);

               currentInternalState.learningStepIndex = answeredQueueItem.internalState.learningStepIndex ?? 0;

               // Calculate next state using relearning steps
               const stepResult = calculateNextRelearningStep(currentInternalState.learningStepIndex, grade, currentSettings);

               if (stepResult.nextStepIndex === 'graduatedFromRelearning') { // Completed relearning steps
                    console.log(`[answerCard] Card ${updatedCard.id} graduating from Relearning.`);
                    shouldRemoveFromQueue = true; // Remove from session queue (completed in this session)
                    setSessionResults(prev => ({ ...prev, graduatedCount: prev.graduatedCount + 1 })); // Count graduation from relearning

                    // Calculate payload for re-entering standard Review (srs_level=1)
                    nextSrsPayload = createRelearningGraduationPayload(
                        grade,
                        updatedCard.easiness_factor || currentSettings.defaultEasinessFactor, // Use card's current EF (penalized on initial lapse)
                        currentSettings
                    );
                     // Update card object fields for saving
                    updatedCard.srs_level = nextSrsPayload.srsLevel; // 1
                    updatedCard.learning_state = nextSrsPayload.learningState; // null
                    updatedCard.learning_step_index = nextSrsPayload.learningStepIndex; // null
                    updatedCard.easiness_factor = nextSrsPayload.easinessFactor; // Penalized EF
                    updatedCard.interval_days = nextSrsPayload.intervalDays; // Integer days for re-entry review
                    updatedCard.next_review_due = nextSrsPayload.nextReviewDue?.toISOString() || '';
                    // Failed/hard attempts counters from initial learning are NOT reset by relearning - keep their current value on updatedCard

               } else { // Card continues in relearning steps
                    console.log(`[answerCard] Card ${updatedCard.id} continues in Relearning step ${stepResult.nextStepIndex}.`);
                    shouldRemoveFromQueue = false; // Stays in queue
                    reAddToQueue = true; // Mark to be re-added (to be sorted by dueTime)
                    reinsertIndex = nextQueue.length; // Add to end initially, then sort

                    // Update internal state (next step index and due time)
                    currentInternalState.learningStepIndex = stepResult.nextStepIndex as number;
                    currentInternalState.dueTime = stepResult.nextDueTime; // Timed step due time

                    // Update card object fields for saving (state and next due time)
                    updatedCard.learning_state = 'relearning'; // Explicitly set state
                    updatedCard.learning_step_index = currentInternalState.learningStepIndex;
                    updatedCard.next_review_due = currentInternalState.dueTime 
                        ? currentInternalState.dueTime.toISOString()
                        : new Date().toISOString();
                    // EF and srs_level remain as they were when it entered relearning. Failed/hard attempts are not incremented here.

                    // Create the item to re-add
                    reinsertCard = { card: updatedCard, internalState: currentInternalState };
               }

          }

          // Case 3: Card is currently in Standard Review state (srs_level >= 1, learning_state === null)
          else if (answeredQueueItem.card.srs_level >= 1 && answeredQueueItem.card.learning_state === null) {
               console.log(`[answerCard] Processing Standard Review state (srs_level=${answeredQueueItem.card.srs_level})`);

               // Calculate next state using SM-2 algorithm (handles Review -> Review or Review -> Relearning)
               // Use card's current DB state fields for input to calculateSm2State
               const sm2Input: Sm2InputCardState = {
                    srsLevel: answeredQueueItem.card.srs_level,
                    easinessFactor: answeredQueueItem.card.easiness_factor || currentSettings.defaultEasinessFactor, // Use card's current EF
                    intervalDays: answeredQueueItem.card.interval_days || 0, // Use card's current interval (in days)
                    learningState: answeredQueueItem.card.learning_state as LearningState, // null
                    learningStepIndex: answeredQueueItem.card.learning_step_index, // null
                    nextReviewDue: answeredQueueItem.card.next_review_due // Pass existing due date
               };
               const sm2Result = calculateSm2State(sm2Input, grade, currentSettings);

               // Apply the calculated changes to the card object for saving
               updatedCard.srs_level = sm2Result.srsLevel;
               updatedCard.learning_state = sm2Result.learningState; // null or 'relearning'
               updatedCard.learning_step_index = sm2Result.learningStepIndex; // null or 0
               updatedCard.easiness_factor = sm2Result.easinessFactor;
               updatedCard.interval_days = sm2Result.intervalDays; // Integer or fractional days
               updatedCard.next_review_due = sm2Result.nextReviewDue 
                   ? sm2Result.nextReviewDue.toISOString() 
                   : new Date().toISOString();

               if (sm2Result.learningState === 'relearning') {
                    // Card lapsed from Review to Relearning
                    console.log(`[answerCard] Card ${updatedCard.id} lapsed to Relearning.`);
                    setSessionResults(prev => ({ ...prev, relapsedCount: prev.relapsedCount + 1 })); // Count relapse
                    shouldRemoveFromQueue = true; // Remove from *this* review session queue (it's due later/tomorrow)
                     // Failed/hard attempt counters from initial learning are NOT reset on lapse - keep their value on updatedCard

               } else { // Card successful in Review (Grade >= 2)
                    console.log(`[answerCard] Card ${updatedCard.id} successful in Review.`);
                    shouldRemoveFromQueue = true; // Remove from *this* review session queue
               }

          }
           // Case 4: Card is a truly new card (srs_level = 0, learning_state = null) - This case is handled during initialization
           // It transitions from 'new' to 'learning' in the map function during the initial useEffect
           // So, cards entering answerCard will always be in one of the first 3 cases (learning, relearning, review).


          // --- Manage the queue based on whether the card completed the session ---
          if (shouldRemoveFromQueue) {
               // Card was already spliced out above. nextQueue is correct.
               console.log(`[answerCard] Card ${updatedCard.id} removed from session queue permanently.`);
          } else if (reinsertIndex !== null) {
               // Card needs to be re-added to the queue copy at a specific position
                console.log(`[answerCard] Card ${updatedCard.id} re-adding to queue at index ${reinsertIndex}.`);
               nextQueue.splice(reinsertIndex!, 0, reinsertCard!); // Re-insert the updated item
          } else {
              // This case should ideally not happen if shouldRemoveFromQueue or reinsertIndex cover all possibilities
              // It means a card was spliced out but not re-added/completed.
              console.error("[answerCard] Logic error: Card neither removed nor marked for re-queueing. Re-adding to end as fallback.", updatedCard.id);
              // Create a new item to push
              nextQueue.push({ card: updatedCard, internalState: currentInternalState }); // Fallback - push the updated item
          }

          // --- Sort the queue ---
          // Sorting is always needed after answers because dueTimes change or items are re-inserted.
          nextQueue.sort((a, b) => a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime());


          // --- Save Progress to database (debounced) ---
          // Pass the potentially updated card object and the grade
          // The debounced function constructs the payload for the action
          debouncedUpdateProgress({ cardToSave: updatedCard, grade: grade });


          // --- Update UI State (Delayed for animation) ---
          setTimeout(() => {
              const sessionIsComplete = nextQueue.length === 0;
              console.log(`[answerCard] Delayed state update. Queue length: ${nextQueue.length}, Complete: ${sessionIsComplete}`);

              setSessionQueue(nextQueue); // Update session queue state
              setIsComplete(sessionIsComplete); // Update completion status

              if (!sessionIsComplete) {
                   // Find the next card to show from the *updated and sorted* queue
                   const nextIndex = findNextCardIndex(nextQueue); // findNextCardIndex returns index or queue.length
                   console.log(`[answerCard] Next card index to display: ${nextIndex}`);

                   // Set currentCardIndex state. This will trigger the currentQueueItem memo.
                   // If nextIndex is queue.length, currentCard will become null (waiting state)
                   setCurrentCardIndex(nextIndex);

                   // scheduleNextDueCheck() will be triggered by the queue state update effect (dependency on sessionQueue)
             } else {
                   // Session is complete, index doesn't matter
                   setCurrentCardIndex(0);
                   console.log("[answerCard] Session is now complete.");
              }

              setIsFlipped(false); // Flip back
              setIsProcessingAnswer(false); // Unlock input

          }, PROCESSING_DELAY_MS); // Use the constant

      }, PROCESSING_DELAY_MS); // Use the constant for the outer timeout as well
    }, [
      currentQueueItem, // Depend on the current item being answered
      sessionQueue, // Depend on sessionQueue to create nextQueue copy and for sorting/finding next
      studyMode, // Depend on studyMode for logic branching
      isProcessingAnswer, isComplete, // Depend on state to prevent multiple calls
      settings, // Depend on settings for algorithm, thresholds, intervals, intervals/penalties for calc fns
      debouncedUpdateProgress, // Depend on the memoized function
      findNextCardIndex, // Depend on the memoized function
      scheduleNextDueCheck, // Depend on the memoized function
      // Dependencies from calculate/create payload functions are implicitly via 'settings'
    ]);

    // Helper to update card status display (memoized)
    // This memo *returns* the string, it does NOT set state.
     const cardStatusDisplayMemo = useMemo(() => {
       // Status display logic relies on currentQueueItem and settings
       if (isLoading) return 'Loading session...';
       if (error) return `Error: ${error}`;
       if (isComplete) return totalCardsInSession > 0 ? 'Session Complete!' : 'No cards to study.';
       if (!settings || isLoadingSettings) return 'Loading settings...'; // Wait for settings to display status

       // If queue is not empty, but currentQueueItem is null (waiting for timed step)
       if (!currentQueueItem && sessionQueue.length > 0) {
           const now = new Date();
           // Find the soonest future due time from the *entire* queue (which is sorted)
           // The first item in the sorted queue that is > now() is the soonest future one
           let soonestFutureDueItem = sessionQueue.find(item => item.internalState.dueTime > now);

           if (soonestFutureDueItem) {
                const diffMs = soonestFutureDueItem.internalState.dueTime.getTime() - now.getTime();
                const diffSeconds = Math.ceil(diffMs / 1000);
                if (diffSeconds <= 1) return `Next card due in ~1s`; // Round up to 1 sec if < 1 sec
                if (diffSeconds < 60) return `Next card due in ${diffSeconds}s`;
                const diffMinutes = Math.ceil(diffMs / (1000 * 60));
                if (diffMinutes <= 1) return `Next card due in ~1m`; // Round up to 1 min if < 1 min
                if (diffMinutes < 60) return `Next card due in ${diffMinutes}m`;
                const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                if (diffHours <= 24) return `Next card due in ${diffHours}h`;
                // Format date like "MMM dd"
                return `Next card due on ${soonestFutureDueItem.internalState.dueTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
           } else {
                // This case means queue is not empty, but no card is due now or in future (shouldn't happen if logic is right)
                return 'Waiting... (No future due times)';
           }
       }

       // If a currentQueueItem exists, display its specific status
       if (currentQueueItem) {
            const card = currentQueueItem.card;
            const internalState = currentQueueItem.internalState;

            if (card.srs_level === 0 && card.learning_state === 'learning') {
                if (settings.studyAlgorithm === 'dedicated-learn') {
                     return `Streak: ${internalState.streak}/${settings.masteryThreshold}`;
                } else { // Standard SM-2 Learn
                     const stepIndex = internalState.learningStepIndex || 0; // Use internal state's step index
                     const totalSteps = settings.initialLearningStepsMinutes?.length || 0;
                     return `Learn Step: ${stepIndex + 1}${totalSteps > 0 ? '/' + totalSteps : ''}`;
                }
            } else if (card.srs_level === 0 && card.learning_state === 'relearning') {
                const stepIndex = internalState.learningStepIndex || 0; // Use internal state's step index
                const totalSteps = settings.relearningStepsMinutes?.length || 0;
                return `Relearning: Step ${stepIndex + 1}${totalSteps > 0 ? '/' + totalSteps : ''}`;
            } else if (card.srs_level >= 1 && card.learning_state === null) {
                // Standard Review
                const interval = Math.round(card.interval_days || 0); // Round interval for display
                let displayText = `Reviewing (Level ${card.srs_level})`; // Base display
                if (interval > 0) displayText += ` • Interval: ${interval} day${interval === 1 ? '' : 's'}`; // Add interval if > 0

                // Add more specific due time if it's due today or past
                 const cardDueDate = card.next_review_due ? parseISO(card.next_review_due) : null;
                 if (cardDueDate && isValid(cardDueDate) && isToday(cardDueDate)) {
                     displayText = `Reviewing (Level ${card.srs_level}) • Due Today`;
                 } else if (cardDueDate && isValid(cardDueDate) && isPast(cardDueDate) && !isToday(cardDueDate)) {
                     displayText = `Reviewing (Level ${card.srs_level}) • Overdue`;
                 }
                 return displayText;
            } else if (card.srs_level === 0 && card.learning_state === null && studyMode === 'learn') {
                 // This is the initial 'new' state encountered in Learn mode if not filtered/mapped correctly in init
                 // Should transition to learning state in init
                 return 'New Card (Initializing...)'; // Should not remain in this state
            } else {
                 // Catch any unexpected state or cards not meant for this mode
                 return 'Studying... (Unknown State)';
            }
       }

       // Fallback status - should ideally be covered by isComplete/error/isLoading/waiting
            return null;


    }, [currentQueueItem, isLoading, error, isComplete, sessionQueue, totalCardsInSession, settings, isLoadingSettings, studyMode]); // Depends on currentQueueItem, global state, settings

    // Removed the useEffect that watched currentQueueItem for status update, the memo handles it

    // Clean up timer on component unmount
    useEffect(() => {
      return () => {
        if (dueCheckTimerRef.current) {
          clearTimeout(dueCheckTimerRef.current);
          dueCheckTimerRef.current = null;
        }
      };
    }, []); // Effect runs only on mount and unmount

    // Map our session results to the expected format for the return type (memoized)
    const mappedSessionResults = useMemo(() => ({
      totalAnswered: sessionResults.totalAnswered,
      correctCount: sessionResults.correctCount,
      incorrectCount: sessionResults.incorrectCount,
      // graduatedCount and relapsedCount are not exposed in the return type
      // graduatedCount: sessionResults.graduatedCount,
      // relapsedCount: sessionResults.relapsedCount,
    }), [sessionResults]);


    return {
      // Map to the expected return interface
      currentCard: currentCard, // Use the extracted StudyCard or null
      isInitializing: isLoading, // Renamed isLoading to isInitializing for consistency with return type
        error,
      studyMode: studyMode, // Return the study mode
        isComplete,
      totalCardsInSession: totalCardsInSession, // Use the calculated count
      currentCardNumber: currentCardNumber, // Use the calculated card number
      initialSelectionCount: initialSelectionCount, // Total cards from query
      isProcessingAnswer,
      isFlipped,
      onFlip, // Use the memoized flip handler
      sessionResults: mappedSessionResults, // Use the memoized results
      answerCard, // Use the memoized answer handler
      currentCardStatusDisplay: cardStatusDisplayMemo, // Use the memoized value directly instead of the state
      // debugQueue: sessionQueue, // Optional debug export
    };
} 