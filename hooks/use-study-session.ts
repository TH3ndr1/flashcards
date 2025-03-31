"use client"; // Hooks interacting with client-side state need this

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import type { FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider"; 
import { useSettings } from "@/providers/settings-provider"; // Use settings context directly
import { useStudyTTS } from "./useStudyTTS";
import { useSupabase } from '@/hooks/use-supabase';
import { Card } from '@/types/card';
import type { StudyQueryCriteria } from "@/types/study";
import type { DbCard } from "@/types/database";

// --- Actions --- 
import { resolveStudyQuery } from "@/lib/actions/studyQueryActions";
import { updateCardProgress, CardProgressUpdate } from "@/lib/actions/progressActions";
import { getCardsByIds } from "@/lib/actions/cardActions";

// --- SRS Logic ---
import { calculateNextSrsState, type ReviewGrade, type Sm2UpdatePayload, type Sm2InputCardState } from "@/lib/srs";

// --- Utilities & Constants ---
import { 
    DEFAULT_MASTERY_THRESHOLD, 
    FLIP_ANIMATION_MIDPOINT_MS, 
    STUDY_SAVE_DEBOUNCE_MS
} from "@/lib/study-utils"; // Assuming constants are here
import { debounce } from "@/lib/utils"; // Assuming a general debounce utility exists

/**
 * Input criteria for initiating a study session.
 * Can be direct criteria or the ID of a saved study set.
 */
export type StudySessionCriteria = StudyQueryCriteria | { studySetId: string };

/**
 * Props for the useStudySession hook.
 */
interface UseStudySessionProps {
  /** The criteria defining which cards to study. */
  criteria: StudyQueryCriteria | undefined;
  // Settings are now fetched from context within the hook
  // settings: Settings | null; // Removed from props
}

/**
 * The state and actions returned by the useStudySession hook.
 */
interface StudySessionState {
  // Core State
  studyCards: FlashCard[];
  currentStudyCard: FlashCard | undefined;
  isFlipped: boolean;
  isLoading: boolean;
  error: string | null;
  isTransitioning: boolean;
  isSessionInitialized: boolean; // Flag to know if initial load succeeded
  isSessionComplete: boolean; // Is the current session queue finished?

  // Derived Information
  currentCardIndex: number; // Index within the current studyCards array
  studyQueueCount: number; // Count of cards currently in the study session queue
  // --- Potentially Add More Derived State --- 
  // e.g., masteredCountInSession, overallProgress (might need different calculation)

  // Action Functions
  /** Initializes or restarts the session based on new criteria. */
  startSession: (newCriteria: StudyQueryCriteria) => void;
  /** Flips the current card between question and answer. */
  flipCard: () => void;
  /** Records the user's answer grade (1-4) and moves to the next card. */
  answerCard: (grade: ReviewGrade) => void;
  // --- Keep relevant actions, remove/rethink others --- 
  // practiceDifficultCards: () => void; // Replaced by calling startSession with new criteria
  // resetDeckProgress: () => Promise<void>; // Deck-specific, potentially move out
}

/**
 * Custom hook to manage the state and logic for a query-based flashcard study session with SRS.
 *
 * @param {UseStudySessionProps} props - Contains the study criteria.
 * @returns {StudySessionState} An object containing the session state and action functions.
 */
export function useStudySession({
  criteria: initialCriteria,
}: UseStudySessionProps): StudySessionState {
  const { settings } = useSettings(); // Get settings from context
  const { supabase } = useSupabase();

  const [currentCriteria, setCurrentCriteria] = useState<StudyQueryCriteria | undefined>(initialCriteria);
  const [studyCards, setStudyCards] = useState<FlashCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Debounced Save Action --- 
  const debouncedSaveProgress = useMemo(() => {
    // Define the function to be debounced
    const saveFunction = async (cardId: string, payload: CardProgressUpdate) => {
      console.log(`[Debounced Save] Saving progress for card: ${cardId}`);
      const { error: saveError } = await updateCardProgress(cardId, payload);
      if (saveError) {
        console.error("[Debounced Save] Failed to save progress:", saveError);
        toast.error("Save Error", { description: "Could not save study progress. Changes may be lost." });
        // Optionally: Implement retry logic or notify user more prominently
      }
    };
    // Return the debounced version
    return debounce(saveFunction, STUDY_SAVE_DEBOUNCE_MS || 2000); // Use constant or default
  }, []); // Re-create debounce function only if necessary (likely never)

  // --- Action: Start/Restart Session ---
  const startSession = useCallback((newCriteria: StudyQueryCriteria) => {
    console.log("--- [useStudySession] startSession CALLED with new criteria: ---", newCriteria);
    // Reset states before setting new criteria to trigger effect
    setIsLoading(true);
    setError(null);
    setIsSessionInitialized(false);
    setStudyCards([]);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    // Now set criteria to trigger the useEffect - use a shallow copy!
    setCurrentCriteria({ ...newCriteria });
  }, []); // Empty dependency array is correct here

  // --- Effect: Initialize/Re-initialize Session --- 
  useEffect(() => {
    const initializeSession = async () => {
      console.log("--- [useStudySession] initializeSession EFFECT START --- Criteria:", currentCriteria);
      if (!currentCriteria) {
        console.log("useStudySession: No criteria provided, skipping initialization.");
        setIsLoading(false); // Ensure loading is false if no criteria
        return;
      }

      console.log("useStudySession: Initializing session with criteria:", currentCriteria);
      setIsLoading(true);
      setError(null);
      setIsSessionInitialized(false); // Mark as not initialized until successful

      try {
        // 1. Resolve card IDs (still using Server Action)
        const { data: resolveData, error: resolveError } = await resolveStudyQuery(currentCriteria);
        if (resolveError || !resolveData) {
          throw resolveError || new Error("Failed to resolve study query.");
        }
        console.log(`useStudySession: Resolved ${resolveData.cardIds.length} card IDs.`);

        if (resolveData.cardIds.length === 0) {
          setStudyCards([]);
          setCurrentCardIndex(0);
          setIsSessionInitialized(true);
          setIsLoading(false); // Set loading false for empty session
          console.log("useStudySession: No cards resolved, session initialized empty.");
          return; 
        }

        // 2. Fetch card details
        console.log(`[useStudySession] Fetching card details for IDs:`, resolveData.cardIds);
        const { data: fetchedCardsData, error: fetchError } = await getCardsByIds(resolveData.cardIds);
        
        console.log("[useStudySession] Fetch cards action result:", { fetchedCardsData, fetchError });
        
        if (fetchError) {
            console.error("Error fetching cards (Action):", fetchError);
            throw fetchError; // Let the main catch block handle it
        }
        
        // Directly use the data from the action, which should be FlashCard[] or null
        const fetchedCards: FlashCard[] = fetchedCardsData || []; // Use fetched data or empty array if null

        if (fetchedCards.length === 0 && resolveData.cardIds.length > 0) {
            // This might indicate an issue if IDs were resolved but no cards returned
            console.warn("useStudySession: Card IDs resolved, but no card data fetched.");
            // Depending on desired behavior, could throw an error or continue with empty set
        }
        console.log(`useStudySession: Fetched data for ${fetchedCards.length} cards via Action.`);

        // 3. Mapping is now handled by the Server Action, no need to map here
        // const fetchedCards = dbCards.map(mapDbCardToFlashCard); // Remove this line
        
        // TODO: Implement sorting/prioritization based on resolveData.priorities if needed
        
        setStudyCards(fetchedCards);
        setCurrentCardIndex(0); // Reset index
        setIsFlipped(false); // Ensure first card is not flipped
        setIsSessionInitialized(true);
        setError(null); // Clear any previous error

      } catch (initError) {
        console.error("useStudySession: Error during session initialization:", initError);
        setError(initError instanceof Error ? initError.message : "Unknown initialization error");
        setStudyCards([]); // Clear cards on error
        setCurrentCardIndex(0);
        setIsSessionInitialized(false); // Mark as failed initialization
      } finally {
        console.log("--- [useStudySession] initializeSession EFFECT FINALLY --- Setting isLoading=false");
        setIsLoading(false); 
      }
    };

    initializeSession();

    // No cleanup needed that would cancel fetches if criteria change rapidly?

  }, [currentCriteria]); // Re-run ONLY when criteria change

  // --- Core State Access --- 
  const currentStudyCard = useMemo(() => studyCards?.[currentCardIndex], [studyCards, currentCardIndex]);
  const studyQueueCount = useMemo(() => studyCards.length, [studyCards]);

  // --- Completion Check --- 
  const isSessionComplete = useMemo(() => {
    // Considered complete if initialized, not loading, and queue is empty OR index is out of bounds
    return isSessionInitialized && !isLoading && (studyQueueCount === 0 || currentCardIndex >= studyQueueCount);
  }, [isSessionInitialized, isLoading, studyQueueCount, currentCardIndex]);

  // --- TTS Integration --- 
  useStudyTTS({
    isEnabled: settings?.ttsEnabled ?? true, 
    isLoading: isLoading, 
    isTransitioning,
    currentStudyCard,
    // Pass languages from the card object (could be null)
    questionLang: currentStudyCard?.questionLanguage, 
    answerLang: currentStudyCard?.answerLanguage,   
    isFlipped,
  });

  // --- Action: Flip Card --- 
  const flipCard = useCallback(() => {
    if (isTransitioning || !currentStudyCard) return;
    setIsFlipped((prev) => !prev);
  }, [isTransitioning, currentStudyCard]);

  // --- Action: Answer Card --- 
  const answerCard = useCallback(async (grade: ReviewGrade) => {
    if (isTransitioning || !currentStudyCard || !settings) return;

    console.log(`useStudySession: Answering card ${currentStudyCard.id} with grade ${grade}`);
    setIsTransitioning(true);

    // 1. Prepare current card state for SRS calculation
    // Ensure mapping uses snake_case from FlashCard prop to camelCase for Sm2InputCardState
    console.log("[useStudySession answerCard] Input card state:", {
        srs_level: currentStudyCard.srs_level, 
        easiness_factor: currentStudyCard.easiness_factor,
        interval_days: currentStudyCard.interval_days,
    });
    const srsInputState: Sm2InputCardState = {
        srsLevel: currentStudyCard.srs_level ?? 0, 
        easinessFactor: currentStudyCard.easiness_factor,
        intervalDays: currentStudyCard.interval_days,
    };
    const algorithm = settings?.srs_algorithm || 'sm2'; // Use srs_algorithm from Settings

    // 2. Calculate new SRS state
    let updatePayload: Sm2UpdatePayload; 
    try {
        updatePayload = calculateNextSrsState(srsInputState, grade, algorithm);
        console.log(`useStudySession: Calculated SRS update for ${currentStudyCard.id}:`, updatePayload);
    } catch (calcError) {
        console.error(`useStudySession: Error calculating SRS state for card ${currentStudyCard.id}:`, calcError);
        toast.error("SRS Calculation Error", { description: "Could not calculate next review state." });
        setIsTransitioning(false);
        return;
    }

    // 3. Prepare full update payload for the database action
    const progressUpdateData: CardProgressUpdate = {
        srs_level: updatePayload.srsLevel,
        easiness_factor: updatePayload.easinessFactor,
        interval_days: updatePayload.intervalDays,
        next_review_due: updatePayload.nextReviewDue.toISOString(), 
        last_review_grade: updatePayload.lastReviewGrade,
        last_reviewed_at: new Date().toISOString(), 
        // Use camelCase names matching FlashCard type for counts
        attempt_count: (currentStudyCard.attemptCount ?? 0) + 1, 
        correct_count: (currentStudyCard.correctCount ?? 0) + (grade >= 3 ? 1 : 0),
        incorrect_count: (currentStudyCard.incorrectCount ?? 0) + (grade < 3 ? 1 : 0),
    };

    // 4. Schedule debounced save to backend
    debouncedSaveProgress(currentStudyCard.id, progressUpdateData);

    // 5. Update local state IMMEDIATELY for UI responsiveness
    const updatedCardLocally: FlashCard = {
        ...currentStudyCard,
        srs_level: updatePayload.srsLevel,
        easiness_factor: updatePayload.easinessFactor,
        interval_days: updatePayload.intervalDays,
        next_review_due: updatePayload.nextReviewDue, 
        last_review_grade: updatePayload.lastReviewGrade,
        last_reviewed_at: new Date(), 
        // Use camelCase names matching FlashCard type
        attemptCount: progressUpdateData.attempt_count ?? currentStudyCard.attemptCount,
        correctCount: progressUpdateData.correct_count ?? currentStudyCard.correctCount,
        incorrectCount: progressUpdateData.incorrect_count ?? currentStudyCard.incorrectCount,
    };
    const nextStudyCards = studyCards.map((card, index) => 
        index === currentCardIndex ? updatedCardLocally : card
    );
    setStudyCards(nextStudyCards);

    // 6. Determine next card index (simple sequential for now)
    // TODO: Implement more sophisticated logic? (e.g., remove mastered cards from queue?)
    const nextIndex = currentCardIndex + 1;

    // 7. Transition to next card visually
    setTimeout(() => {
      setCurrentCardIndex(nextIndex); // Update index after animation midpoint
      setIsFlipped(false);
      setIsTransitioning(false);
      console.log(`useStudySession: Moving to card index ${nextIndex} in study list of length ${nextStudyCards.length}`);
      // Check if the next index is the end of the queue
      if (nextIndex >= nextStudyCards.length) {
           console.log("useStudySession: Reached end of current study queue.");
           // State update for isSessionComplete will handle UI changes
      }
    }, FLIP_ANIMATION_MIDPOINT_MS); // Use constant for timing

  }, [currentStudyCard, isTransitioning, settings, debouncedSaveProgress]);

  return {
    // Core State
    studyCards,
    currentStudyCard,
    isFlipped,
    isLoading,
    error,
    isTransitioning,
    isSessionInitialized,
    isSessionComplete,

    // Derived Information
    currentCardIndex,
    studyQueueCount,

    // Action Functions
    startSession,
    flipCard,
    answerCard,
  };
}

// --- Remove the local mapDbCardToFlashCard function ---
// It's now redundant as the getCardsByIds action handles mapping. 