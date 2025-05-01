'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardsByIds } from '@/lib/actions/cardActions';
import { updateCardProgress } from '@/lib/actions/progressActions';
import { calculateSm2State, Sm2UpdatePayload, ReviewGrade, Sm2InputCardState } from '@/lib/srs';
import { useSettings, type Settings } from '@/providers/settings-provider';
import type { Database, Tables } from "@/types/database";
import type { StudyInput, StudyMode } from '@/store/studySessionStore';
import type { ResolvedCardId, StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import { isAfter, parseISO, isValid, isToday, isPast } from 'date-fns';
import { debounce } from "@/lib/utils";
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useStudySessionStore } from '@/store/studySessionStore';
import { calculateNextStandardLearnStep, calculateNextRelearningStep, createGraduationPayload, createRelearningGraduationPayload } from '@/lib/srs';

// Define card type from database Tables
type StudyCard = Tables<'cards'>;
type CardWithTags = StudyCard & { tags?: { id: string; name: string }[] };

// Define LearningState locally as it's not exported from srs.ts
type LearningState = 'learning' | 'relearning' | null;

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

// Define card state during study session
export type InternalCardState = {
  streak: number;             // For dedicated-learn tracking consecutive correct answers
  dueTime: Date;              // When card is due for review in session (now for immediate, future for timed steps)
  learningStepIndex: number | null; // Current position in learning/relearning steps array
  failedAttemptsInLearn: number; // Track 'Again' responses in learn mode for initial EF
  hardAttemptsInLearn: number;   // Track 'Hard' responses in learn mode for initial EF
};

// Card with internal session state
export type SessionCard = {
  card: CardWithTags;
  internalState: InternalCardState;
};

// Session results for tracking
export type SessionResults = {
  totalAnswered: number;
  correctCount: number;
  incorrectCount: number;
  hardCount: number;
  easedCount: number;
  graduatedCount: number;
  relapsedCount: number;
  elapsedTimeMs: number;
};

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
    // Using existing settings hook instead of useSettingsContext
    const studySessionStore = useStudySessionStore();
    // Access the study mode and input based on actual store structure
    const studyInput = initialInput;
    const studyMode = initialMode;
    const isInitialized = Boolean(initialInput && initialMode);
    const { settings } = useSettings();
    // Ready to start normal operation
    
    // Use a ref to store settings to avoid re-renders
    const settingsRef = useRef(settings);
    // Update ref when settings change but don't trigger effects
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // Session state
    const [sessionQueue, setSessionQueue] = useState<SessionCard[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [isComplete, setIsComplete] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isProcessingAnswer, setIsProcessingAnswer] = useState<boolean>(false);
    const [sessionResults, setSessionResults] = useState<SessionResults>({
      totalAnswered: 0,
      correctCount: 0,
      incorrectCount: 0,
      hardCount: 0,
      easedCount: 0,
      graduatedCount: 0,
      relapsedCount: 0,
      elapsedTimeMs: 0
    });
    const [error, setError] = useState<string | null>(null);
    const [currentCardStatusDisplay, setCurrentCardStatusDisplay] = useState<string>('');
    
    // Stats for initial counts
    const [initialCardCount, setInitialCardCount] = useState<number>(0);
    
    // Refs for timers and session tracking
    const dueCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
    const sessionStartTimeRef = useRef<Date>(new Date());
    
    // Debounced save progress function
    const debouncedUpdateProgress = useCallback(
      debounce(async (card: CardWithTags) => {
        try {
          const grade = card.last_review_grade as ReviewGrade || 1;
          const now = new Date().toISOString(); // Current timestamp as ISO string for defaults
          
          // Include all required fields with valid values
          const updatedFields = {
            srs_level: card.srs_level || 0,
            easiness_factor: card.easiness_factor || 2.5,
            interval_days: card.interval_days || 0,
            next_review_due: card.next_review_due || now, // Use current timestamp as default
            learning_state: (card.learning_state as LearningState) || null,
            learning_step_index: card.learning_step_index || null,
            failed_attempts_in_learn: card.failed_attempts_in_learn || 0,
            hard_attempts_in_learn: card.hard_attempts_in_learn || 0,
            last_reviewed_at: card.last_reviewed_at || now, // Use current timestamp as default
            last_review_grade: card.last_review_grade
          };
          
          const updateData = {
            cardId: card.id,
            grade,
            updatedFields
          };
          
          console.log("Sending update data:", updateData);
          
          const result = await updateCardProgress(updateData);
          if (result.error) {
            console.error("Error updating card progress:", result.error);
          }
        } catch (error) {
          console.error("Exception updating card progress:", error);
        }
      }, 1000),
      []
    );

    // Find the next card to study based on due time
    const findNextCardIndex = useCallback(() => {
      if (sessionQueue.length === 0) return -1;
      
      const now = new Date();
      
      // Find the first card that's due (or past due)
      for (let i = 0; i < sessionQueue.length; i++) {
        if (now >= sessionQueue[i].internalState.dueTime) {
          return i;
        }
      }
      
      // If no card is currently due, return -1 (will be handled by setting a timer)
      return -1;
    }, [sessionQueue]);

    // Schedule a check for the next due card
    const scheduleNextDueCheck = useCallback(() => {
      // Clear any existing timer
      if (dueCheckTimerRef.current) {
        clearTimeout(dueCheckTimerRef.current);
        dueCheckTimerRef.current = null;
      }
      
      // If session is complete or queue is empty, don't schedule
      if (isComplete || sessionQueue.length === 0) return;
      
      const now = new Date();
      let nextDueTime: Date | null = null;
      
      // Find the earliest due time in the future
      for (let i = 0; i < sessionQueue.length; i++) {
        const dueTime = sessionQueue[i].internalState.dueTime;
        if (dueTime > now && (!nextDueTime || dueTime < nextDueTime)) {
          nextDueTime = dueTime;
        }
      }
      
      // If found a future due time, schedule a timer
      if (nextDueTime) {
        const timeUntilDue = nextDueTime.getTime() - now.getTime();
        dueCheckTimerRef.current = setTimeout(() => {
          const nextIndex = findNextCardIndex();
          if (nextIndex >= 0) {
            setCurrentCardIndex(nextIndex);
          } else {
            // Re-check if there are any cards now due
            scheduleNextDueCheck();
          }
        }, timeUntilDue + 100); // Add a small buffer to ensure we're past the due time
      } else if (sessionQueue.length > 0) {
        // If no future due cards but queue not empty, check if we're done
        const allCardsCompleted = true; // This would need logic to verify all cards have been processed
        if (allCardsCompleted) {
          setIsComplete(true);
        }
      }
    }, [findNextCardIndex, isComplete, sessionQueue]);

    // Initialize the session when dependencies are ready
    useEffect(() => {
      let isMounted = true;
      let hasInitialized = false; // Flag to ensure we only initialize once
      
      async function initializeSession() {
        // Skip if already initialized or missing dependencies
        if (hasInitialized || !isInitialized || !studyInput || !studyMode) {
          return;
        }
        
        hasInitialized = true; // Mark as initialized
        console.log('Running one-time initialization, will not re-run');
        
        try {
          setIsLoading(true);
          setError(null);
          
          // 1. Get card IDs based on study input
          let cardIds: string[] = [];
          
          if ('studySetId' in studyInput && studyInput.studySetId) {
            const result = await resolveStudyQuery({ studySetId: studyInput.studySetId });
            if (result.error || !result.data) {
              throw new Error(result.error || 'Failed to resolve study query');
            }
            cardIds = result.data;
          } else if ('criteria' in studyInput && studyInput.criteria) {
            const result = await resolveStudyQuery({ criteria: studyInput.criteria });
            if (result.error || !result.data) {
              throw new Error(result.error || 'Failed to resolve study query');
            }
            cardIds = result.data;
          } else if ('deckId' in studyInput && studyInput.deckId) {
            // For a specific deck, create a simple criteria and resolve
            const result = await resolveStudyQuery({ 
              criteria: { 
                deckId: studyInput.deckId as string, // Cast to string
                // Use only valid criteria properties
                tagLogic: "ANY",
                includeDifficult: true
              } 
            });
            if (result.error || !result.data) {
              throw new Error(result.error || 'Failed to resolve study query');
            }
            cardIds = result.data;
          } else {
            throw new Error('Invalid study input configuration');
          }
          
          console.log(`Resolved ${cardIds.length} card IDs from query`);

          if (cardIds.length === 0) {
            setIsLoading(false);
            setIsComplete(true);
            setCurrentCardStatusDisplay('No cards found matching your criteria');
            return;
          }

          // 2. Fetch full card data
          const cardResult = await getCardsByIds(cardIds);
          if (cardResult.error || !cardResult.data) {
            throw new Error(cardResult.error || 'Failed to fetch cards');
          }
          
          const fetchedCards = cardResult.data;
          console.log(`Fetched ${fetchedCards.length} cards`);
          
          // 3. CRITICAL: Filter cards based on study mode
          let initialQueueCards: CardWithTags[] = [];
          
          if (studyMode === 'learn') {
            // Learn mode: cards with srs_level=0 and not in relearning
            initialQueueCards = fetchedCards.filter(card => 
              card.srs_level === 0 && card.learning_state !== 'relearning'
            );
            console.log(`Filtered ${initialQueueCards.length} cards for Learn mode`);
          } else if (studyMode === 'review') {
            // Review mode: cards in review state OR relearning state
            initialQueueCards = fetchedCards.filter(card => 
              (card.srs_level >= 1 && card.learning_state === null) || 
              (card.srs_level === 0 && card.learning_state === 'relearning')
            );
            
            // For review mode, also filter to only cards that are due
            const now = new Date();
            initialQueueCards = initialQueueCards.filter(card => 
              !card.next_review_due || new Date(card.next_review_due) <= now
            );
            
            console.log(`Filtered ${initialQueueCards.length} cards for Review mode (due)`);
          }
          
          // Save the initial count for progress tracking
          setInitialCardCount(initialQueueCards.length);
          
          // If filtered queue is empty, handle appropriately
          if (initialQueueCards.length === 0) {
            setIsLoading(false);
            setIsComplete(true);
            setCurrentCardStatusDisplay(
              studyMode === 'learn' 
                ? 'No new cards to learn' 
                : 'No cards due for review'
            );
            return;
          }
          
          // 4. Create session queue with internal state
          const now = new Date();
          const newSessionQueue: SessionCard[] = initialQueueCards.map(card => {
            const internalState: InternalCardState = {
              streak: 0,
              dueTime: now, // All cards start as immediately due
              learningStepIndex: 
                (card.learning_state === 'learning' || card.learning_state === 'relearning') 
                  ? card.learning_step_index || 0 
                  : null,
              failedAttemptsInLearn: card.failed_attempts_in_learn || 0,
              hardAttemptsInLearn: card.hard_attempts_in_learn || 0
            };
            
            return { card, internalState };
          });
          
          // 5. Sort by due time (all same initially, but will change as session progresses)
          const sortedQueue = [...newSessionQueue].sort((a, b) => 
            a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime()
          );
                
          if (isMounted) {
            setSessionQueue(sortedQueue);
            const nextCardIndex = findNextCardIndex();
            setCurrentCardIndex(nextCardIndex >= 0 ? nextCardIndex : 0);
            setIsLoading(false);
            
            // Set session start time
            sessionStartTimeRef.current = new Date();
            
            // Schedule due check if needed for timed algorithms
            if ((settingsRef.current && settingsRef.current.studyAlgorithm === 'standard-sm2') || studyMode === 'review') {
              scheduleNextDueCheck();
            }
          }
        } catch (err) {
          console.error('Error initializing session:', err);
          if (isMounted) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            setIsLoading(false);
          }
        }
      }

      initializeSession();

      return () => {
        isMounted = false;
        if (dueCheckTimerRef.current) {
          clearTimeout(dueCheckTimerRef.current);
        }
      };
    }, []); // Empty dependency array - run only once at mount

    // Get the current card
    const currentCard = useMemo(() => {
      if (isComplete || sessionQueue.length === 0 || currentCardIndex < 0 || currentCardIndex >= sessionQueue.length) {
        return null;
      }
      return sessionQueue[currentCardIndex];
    }, [currentCardIndex, isComplete, sessionQueue]);

    // Calculate session progress
    const progress = useMemo(() => {
      const { totalAnswered } = sessionResults;
      const total = initialCardCount || sessionQueue.length;
      const remaining = Math.max(0, total - totalAnswered);
      
      return {
        totalCards: total,
        cardsAnswered: totalAnswered,
        cardsRemaining: remaining,
        percentComplete: total > 0 ? Math.floor((totalAnswered / total) * 100) : 0
      };
    }, [initialCardCount, sessionQueue.length, sessionResults]);

    // Handle card flipping
    const handleFlip = useCallback(() => {
      setIsFlipped(!isFlipped);
    }, [isFlipped]);

    // Handle answering a card
    const answerCard = useCallback(async (grade: ReviewGrade) => {
      if (!currentCard || isProcessingAnswer || isComplete || !settingsRef.current) return;
      
      setIsProcessingAnswer(true);
      
      try {
        // Update session results
        setSessionResults(prev => {
          const newResults = { ...prev, totalAnswered: prev.totalAnswered + 1 };
          
          // Update counts based on grade
          if (grade === 1) newResults.incorrectCount++;
          else if (grade === 2) newResults.hardCount++;
          else if (grade === 3) newResults.correctCount++;
          else if (grade === 4) newResults.easedCount++;
          
          // Elapsed time
          newResults.elapsedTimeMs = new Date().getTime() - sessionStartTimeRef.current.getTime();
          
          return newResults;
        });
        
        // Create a copy of the current card for updates
        const updatedCard = { ...currentCard.card };
        const currentInternalState = { ...currentCard.internalState };
        
        // Update last reviewed timestamp and grade
        updatedCard.last_reviewed_at = new Date().toISOString();
        updatedCard.last_review_grade = grade;
        
        // Update core stats
        updatedCard.attempt_count = (updatedCard.attempt_count || 0) + 1;
        if (grade >= 3) {
          updatedCard.correct_count = (updatedCard.correct_count || 0) + 1;
        } else if (grade === 1) {
          updatedCard.incorrect_count = (updatedCard.incorrect_count || 0) + 1;
        }
        
        // Handle the card based on its current state and the study mode
        const isStandardSm2 = settingsRef.current?.studyAlgorithm === 'standard-sm2';
        
        // Case 1: Card is in initial learning
        if (updatedCard.srs_level === 0 && updatedCard.learning_state === 'learning') {
          let nextState: { 
            nextStepIndex: number | 'graduated'; 
            nextDueTime: Date; 
            intervalMinutes: number | null;
          };
          
          if (isStandardSm2) {
            // Standard SM-2 learning flow with steps
            nextState = calculateNextStandardLearnStep(
              currentInternalState.learningStepIndex !== null ? currentInternalState.learningStepIndex : 0,
              grade,
              settingsRef.current
            );
          } else {
            // Custom learn with streak tracking
            if (grade === 1) {
              // Again - decrease streak by 1, minimum 0
              currentInternalState.streak = Math.max(0, currentInternalState.streak - 1);
              currentInternalState.failedAttemptsInLearn++;
              updatedCard.failed_attempts_in_learn = currentInternalState.failedAttemptsInLearn;
              
              // Re-queue the card based on requeue gap setting
              nextState = {
                nextStepIndex: 0,
                nextDueTime: new Date(),
                intervalMinutes: 0
              };
            } else if (grade === 2) {
              // Hard - keep streak but track for EF calculation
              currentInternalState.hardAttemptsInLearn++;
              updatedCard.hard_attempts_in_learn = currentInternalState.hardAttemptsInLearn;
              
              // Re-queue the card based on requeue gap setting
              nextState = {
                nextStepIndex: 0,
                nextDueTime: new Date(),
                intervalMinutes: 0
              };
            } else if (grade === 3) {
              // Good - increment streak by 1
              currentInternalState.streak += 1;
              
              // Check if card should graduate (reached threshold)
              if (currentInternalState.streak >= settingsRef.current.masteryThreshold) {
                nextState = {
                  nextStepIndex: 'graduated',
                  nextDueTime: new Date(),
                  intervalMinutes: null
                };
              } else {
                // Not yet graduated - requeue
                nextState = {
                  nextStepIndex: 0,
                  nextDueTime: new Date(),
                  intervalMinutes: 0
                };
              }
            } else { // grade === 4
              // Easy - increment streak by 2
              currentInternalState.streak += 2;
              
              // Check if card should graduate (reached threshold)
              if (currentInternalState.streak >= settingsRef.current.masteryThreshold) {
                nextState = {
                  nextStepIndex: 'graduated',
                  nextDueTime: new Date(),
                  intervalMinutes: null
                };
              } else {
                // Not yet graduated - requeue
                nextState = {
                  nextStepIndex: 0,
                  nextDueTime: new Date(),
                  intervalMinutes: 0
                };
              }
            }
          }
          
          // Handle the next state
          if (nextState.nextStepIndex === 'graduated') {
            // Card graduated from learning
            const graduationPayload = createGraduationPayload(
              grade,
              currentInternalState.failedAttemptsInLearn,
              currentInternalState.hardAttemptsInLearn,
              settingsRef.current
            );
            
            // Update card with graduation state - use camelCase from payload
            updatedCard.srs_level = graduationPayload.srsLevel || 1;
            updatedCard.learning_state = null;
            updatedCard.learning_step_index = null;
            updatedCard.easiness_factor = graduationPayload.easinessFactor || settingsRef.current.defaultEasinessFactor;
            updatedCard.interval_days = graduationPayload.intervalDays || 1;
            updatedCard.next_review_due = graduationPayload.nextReviewDue?.toISOString() || '';
            updatedCard.failed_attempts_in_learn = 0;
            updatedCard.hard_attempts_in_learn = 0;
            
            setSessionResults(prev => ({
              ...prev,
              graduatedCount: prev.graduatedCount + 1
            }));
            
            // Remove card from queue
            const newQueue = [...sessionQueue];
            newQueue.splice(currentCardIndex, 1);
            setSessionQueue(newQueue);
          } else {
            // Card continues in learning
            if (isStandardSm2) {
              // Update learning step and due time for standard SM-2
              updatedCard.learning_step_index = nextState.nextStepIndex as number;
              updatedCard.next_review_due = nextState.nextDueTime.toISOString();
              
              // Update internal state
              currentInternalState.learningStepIndex = nextState.nextStepIndex as number;
              currentInternalState.dueTime = nextState.nextDueTime;
              
              // Update the card in the session queue
              const newQueue = [...sessionQueue];
              newQueue[currentCardIndex] = {
                card: updatedCard,
                internalState: currentInternalState
              };
              
              // Sort the queue by due time
              const sortedQueue = newQueue.sort((a, b) => 
                a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime()
              );
              
              setSessionQueue(sortedQueue);
            } else {
              // For custom learning, manage re-queueing
              if (grade <= 2) {
                // For Again/Hard, move card back in queue based on settings
                const newQueue = [...sessionQueue];
                
                // Remove card from current position
                const cardToRequeue = newQueue.splice(currentCardIndex, 1)[0];
                
                // Update the card's internal state
                cardToRequeue.internalState = currentInternalState;
                cardToRequeue.card = updatedCard;
                
                // Determine requeue position (settings.customLearnRequeueGap cards later)
                const reinsertPosition = Math.min(
                  currentCardIndex + settingsRef.current.customLearnRequeueGap,
                  newQueue.length
                );
                
                // Reinsert the card
                newQueue.splice(reinsertPosition, 0, cardToRequeue);
                setSessionQueue(newQueue);
              } else if ((grade === 3 || grade === 4) && currentInternalState.streak < settingsRef.current.masteryThreshold) {
                // For Good/Easy with streak < threshold, move card to back of queue
                const newQueue = [...sessionQueue];
                
                // Remove card from current position
                const cardToRequeue = newQueue.splice(currentCardIndex, 1)[0];
                
                // Update the card's internal state
                cardToRequeue.internalState = currentInternalState;
                cardToRequeue.card = updatedCard;
                
                // Add to end of queue
                newQueue.push(cardToRequeue);
                setSessionQueue(newQueue);
              }
              // For graduated cards (streak >= threshold), card was already removed
            }
          }
        }
        // Case 2: Card is in relearning (lapsed)
        else if (updatedCard.srs_level === 0 && updatedCard.learning_state === 'relearning') {
          // Calculate next state using relearning steps
          const nextState = calculateNextRelearningStep(
            currentInternalState.learningStepIndex !== null ? currentInternalState.learningStepIndex : 0,
            grade,
            settingsRef.current
          );
          
          if (nextState.nextStepIndex === 'graduatedFromRelearning') {
            // Card graduates from relearning back to review
            const relearningGraduationPayload = createRelearningGraduationPayload(
              grade,
              updatedCard.easiness_factor || settingsRef.current.defaultEasinessFactor,
              settingsRef.current
            );
            
            // Update card with graduation state - use camelCase from payload
            updatedCard.srs_level = relearningGraduationPayload.srsLevel || 1;
            updatedCard.learning_state = null;
            updatedCard.learning_step_index = null;
            updatedCard.interval_days = relearningGraduationPayload.intervalDays || 1;
            updatedCard.next_review_due = relearningGraduationPayload.nextReviewDue?.toISOString() || '';
            
            // Remove card from queue (completed in this session)
            const newQueue = [...sessionQueue];
            newQueue.splice(currentCardIndex, 1);
            setSessionQueue(newQueue);
          } else {
            // Card continues in relearning
            updatedCard.learning_step_index = nextState.nextStepIndex as number;
            updatedCard.next_review_due = nextState.nextDueTime.toISOString();
            
            // Update internal state
            currentInternalState.learningStepIndex = nextState.nextStepIndex as number;
            currentInternalState.dueTime = nextState.nextDueTime;
            
            // Update the card in the session queue
            const newQueue = [...sessionQueue];
            newQueue[currentCardIndex] = {
              card: updatedCard,
              internalState: currentInternalState
            };
            
            // Sort the queue by due time
            const sortedQueue = newQueue.sort((a, b) => 
              a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime()
            );
            
            setSessionQueue(sortedQueue);
          }
        }
        // Case 3: Card is in review
        else if (updatedCard.srs_level >= 1) {
          // Calculate next state using SM-2 algorithm - pass correct properties
          const sm2Result = calculateSm2State(
            {
              srsLevel: updatedCard.srs_level,
              easinessFactor: updatedCard.easiness_factor || settingsRef.current.defaultEasinessFactor,
              intervalDays: updatedCard.interval_days || 0,
              learningState: updatedCard.learning_state as LearningState,
              learningStepIndex: updatedCard.learning_step_index
            },
            grade,
            settingsRef.current
          );
          
          // Apply the calculated changes - use camelCase from payload
          Object.assign(updatedCard, {
            srs_level: sm2Result.srsLevel,
            easiness_factor: sm2Result.easinessFactor,
            interval_days: sm2Result.intervalDays,
            next_review_due: sm2Result.nextReviewDue?.toISOString() || '',
            learning_state: sm2Result.learningState,
            learning_step_index: sm2Result.learningStepIndex
          });
          
          if (grade === 1) {
            // Card lapsed to relearning
        setSessionResults(prev => ({
            ...prev,
              relapsedCount: prev.relapsedCount + 1
            }));
            
            // Card will stay in queue but update its state
            currentInternalState.learningStepIndex = updatedCard.learning_step_index || 0;
            currentInternalState.dueTime = new Date(updatedCard.next_review_due || Date.now());
            
            // Update the card in the session queue
            const newQueue = [...sessionQueue];
            newQueue[currentCardIndex] = {
              card: updatedCard,
              internalState: currentInternalState
            };
            
            // Sort the queue by due time
            const sortedQueue = newQueue.sort((a, b) => 
              a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime()
            );
            
            setSessionQueue(sortedQueue);
             } else {
            // Successful review - remove card from queue (completed in this session)
            const newQueue = [...sessionQueue];
            newQueue.splice(currentCardIndex, 1);
            setSessionQueue(newQueue);
          }
        }
        // Case 4: New card (srs_level = 0, learning_state = null)
        else if (updatedCard.srs_level === 0 && !updatedCard.learning_state) {
          // Initialize card for learning
          updatedCard.learning_state = 'learning';
          updatedCard.learning_step_index = 0;
          
          if (isStandardSm2) {
            // Standard SM-2 - set up with first step
            const firstStep = settingsRef.current.initialLearningStepsMinutes[0] || 1;
            const nextDueTime = new Date(Date.now() + firstStep * 60000);
            updatedCard.next_review_due = nextDueTime.toISOString();
            
            // Update internal state
            currentInternalState.learningStepIndex = 0;
            currentInternalState.dueTime = nextDueTime;
            
            if (grade === 1) {
              currentInternalState.failedAttemptsInLearn++;
              updatedCard.failed_attempts_in_learn = currentInternalState.failedAttemptsInLearn;
            } else if (grade === 2) {
              currentInternalState.hardAttemptsInLearn++;
              updatedCard.hard_attempts_in_learn = currentInternalState.hardAttemptsInLearn;
            }
            
            // Update the card in the session queue
            const newQueue = [...sessionQueue];
            newQueue[currentCardIndex] = {
              card: updatedCard,
              internalState: currentInternalState
            };
            
            // Sort the queue by due time
            const sortedQueue = newQueue.sort((a, b) => 
              a.internalState.dueTime.getTime() - b.internalState.dueTime.getTime()
            );
            
            setSessionQueue(sortedQueue);
          } else {
            // Custom learn mode - update streak based on grade
            if (grade === 1) {
              currentInternalState.streak = 0;
              currentInternalState.failedAttemptsInLearn++;
              updatedCard.failed_attempts_in_learn = currentInternalState.failedAttemptsInLearn;
            } else if (grade === 2) {
              currentInternalState.streak = Math.max(0, currentInternalState.streak);
              currentInternalState.hardAttemptsInLearn++;
              updatedCard.hard_attempts_in_learn = currentInternalState.hardAttemptsInLearn;
            } else {
              currentInternalState.streak++;
            }
            
            // Check if immediately graduated (Easy or reached threshold)
            if (currentInternalState.streak >= settingsRef.current.masteryThreshold || grade === 4) {
              // Graduate immediately
              const graduationPayload = createGraduationPayload(
                grade,
                currentInternalState.failedAttemptsInLearn,
                currentInternalState.hardAttemptsInLearn,
                settingsRef.current
              );
              
              // Update card with graduation state - use camelCase from payload
              updatedCard.srs_level = graduationPayload.srsLevel || 1;
              updatedCard.learning_state = null;
              updatedCard.learning_step_index = null;
              updatedCard.easiness_factor = graduationPayload.easinessFactor || settingsRef.current.defaultEasinessFactor;
              updatedCard.interval_days = graduationPayload.intervalDays || 1;
              updatedCard.next_review_due = graduationPayload.nextReviewDue?.toISOString() || '';
              updatedCard.failed_attempts_in_learn = 0;
              updatedCard.hard_attempts_in_learn = 0;
              
              setSessionResults(prev => ({
                ...prev,
                graduatedCount: prev.graduatedCount + 1
              }));
              
              // Remove card from queue
              const newQueue = [...sessionQueue];
              newQueue.splice(currentCardIndex, 1);
              setSessionQueue(newQueue);
            } else {
              // Handle re-queueing for continue learning
              const newQueue = [...sessionQueue];
              
              // Remove card from current position
              const cardToRequeue = newQueue.splice(currentCardIndex, 1)[0];
              
              // Update the card's internal state
              cardToRequeue.internalState = currentInternalState;
              cardToRequeue.card = updatedCard;
              
              if (grade <= 2) {
                // For Again/Hard, move card back in queue based on settings
                const reinsertPosition = Math.min(
                  currentCardIndex + settingsRef.current.customLearnRequeueGap,
                  newQueue.length
                );
                newQueue.splice(reinsertPosition, 0, cardToRequeue);
              } else {
                // For Good, move to back of queue
                newQueue.push(cardToRequeue);
              }
              
              setSessionQueue(newQueue);
            }
          }
        }
        
        // Save progress to database (debounced)
        debouncedUpdateProgress(updatedCard);
        
        // Update card status display based on the card's state
        updateCardStatusDisplay(updatedCard, currentInternalState);
        
        // Update UI after a short delay (animation)
        setTimeout(() => {
          setIsFlipped(false);
          setIsProcessingAnswer(false);
          
          // Check if queue is empty, if so, mark as complete
          if (sessionQueue.length === 0) {
            setIsComplete(true);
          } else {
            // Find the next card to show
            const nextIndex = findNextCardIndex();
            if (nextIndex >= 0) {
              setCurrentCardIndex(nextIndex);
            } else {
              // No card is currently due, schedule next check
              scheduleNextDueCheck();
            }
          }
        }, 500); // Animation delay
        
      } catch (err) {
        console.error('Error processing answer:', err);
        setIsProcessingAnswer(false);
      }
    }, [
      currentCard, 
      currentCardIndex, 
      debouncedUpdateProgress, 
      findNextCardIndex, 
      isComplete, 
      isProcessingAnswer, 
      scheduleNextDueCheck, 
      sessionQueue, 
      settingsRef
    ]);

    // Helper to update card status display
    const updateCardStatusDisplay = useCallback((card: CardWithTags, internalState: InternalCardState) => {
      if (!settingsRef.current) return;
      
      let statusText = '';
      
      if (card.srs_level === 0 && card.learning_state === 'learning') {
        if (settingsRef.current.studyAlgorithm === 'dedicated-learn') {
          statusText = `Streak: ${internalState.streak}/${settingsRef.current.masteryThreshold}`;
        } else {
          const stepIndex = card.learning_step_index || 0;
          const totalSteps = settingsRef.current.initialLearningStepsMinutes.length;
          statusText = `Step ${stepIndex + 1}/${totalSteps}`;
        }
      } else if (card.srs_level === 0 && card.learning_state === 'relearning') {
        const stepIndex = card.learning_step_index || 0;
        const totalSteps = settingsRef.current.relearningStepsMinutes.length;
        statusText = `Relearning: Step ${stepIndex + 1}/${totalSteps}`;
      } else if (card.srs_level >= 1) {
        statusText = `Level ${card.srs_level} • Interval: ${Math.round(card.interval_days || 0)} days`;
      } else {
        statusText = 'New';
      }
      
      setCurrentCardStatusDisplay(statusText);
    }, []); // No dependencies - settingsRef is always current

    // Update card status on card change
    useEffect(() => {
      if (currentCard && settingsRef.current) {
        updateCardStatusDisplay(currentCard.card, currentCard.internalState);
      }
    }, [currentCard, updateCardStatusDisplay, settingsRef]);

    // Clean up on unmount
    useEffect(() => {
      return () => {
        if (dueCheckTimerRef.current) {
          clearTimeout(dueCheckTimerRef.current);
        }
      };
    }, []);

    // Map our session results to the expected format for the return type
    const mappedSessionResults = {
      correct: sessionResults.correctCount,
      incorrect: sessionResults.incorrectCount,
      completedInSession: sessionResults.totalAnswered,
    };

    return {
      // Map to the expected return interface
      currentCard: currentCard?.card || null,
      isInitializing: isLoading,
      error,
      studyMode: studyMode,
      isComplete,
      totalCardsInSession: initialCardCount,
      currentCardNumber: currentCardIndex + 1,
      initialSelectionCount: initialCardCount,
      isProcessingAnswer,
      isFlipped,
      onFlip: handleFlip,
      sessionResults: mappedSessionResults,
      answerCard
    };
} 