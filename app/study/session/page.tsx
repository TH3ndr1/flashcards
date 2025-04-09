// app/study/session/page.tsx
'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStudySessionStore } from '@/store/studySessionStore'; // Import store
import { useStudySession } from '@/hooks/useStudySession'; // Import the main hook
import { StudyFlashcardView } from '@/components/study-flashcard-view'; // Use named import for StudyFlashcardView
import { Loader2 as IconLoader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress"; // For progress display
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { toast } from 'sonner'; // Added toast import
import { useSettings } from '@/providers/settings-provider'; // Import useSettings
import { useTTS } from "@/hooks/use-tts"; // Import useTTS here
// Import the specific types needed
import type { DbCard } from '@/types/database'; // Only need DbCard now
// REMOVED: import { mapDbCardToFlashCard } from '@/lib/actions/cardActions';

// Assuming ReviewGrade is defined or imported elsewhere
type ReviewGrade = 1 | 2 | 3 | 4;

const FLIP_DURATION_MS = 300; // Match CSS animation duration (adjust if needed)

export default function StudySessionPage() {
  const router = useRouter();
  
  // Use separate selectors for stability
  const currentInput = useStudySessionStore((state) => state.currentInput);
  const currentMode = useStudySessionStore((state) => state.currentMode);
  // No need to select clearStudyParameters here if it's only called from the hook

  // Use state to track if redirect check is needed after initial mount
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false); // State for card flip
  const [isTransitioning, setIsTransitioning] = useState(false); // Add transition state

  // Initialize the core study session hook
  const {
    currentCard, // This is now DbCard | null
    isLoading: isLoadingSession,
    error,
    studyMode,
    isComplete,
    totalCardsInSession,
    currentCardNumber,
    initialSelectionCount, // Get the initial count
    answerCard,
    sessionResults // Get results from hook
  } = useStudySession({
      initialInput: currentInput,
      initialMode: currentMode
  });

  // Fetch Settings
  const { settings, loading: isLoadingSettings } = useSettings();

  // Initialize TTS hook here
  const { speak, loading: ttsLoading } = useTTS();

  // Combined Loading State
  const isLoading = isLoadingSession || isLoadingSettings || !isInitialized;

  // Ref to track the previous card ID for TTS logic
  const prevCardIdRef = useRef<string | undefined | null>(null);

  // Redirect if parameters aren't set after initial client-side check
  useEffect(() => {
    if (!isInitialized) {
        setIsInitialized(true);
        return; // Wait for initialization before checking
    }
    // Add short delay to allow store state to potentially propagate on fast refreshes
    const checkTimer = setTimeout(() => {
        if (!currentInput || !currentMode) {
          console.warn("Study parameters not set, redirecting.");
          toast.warning("No study session active.", { description: "Redirecting to selection..."});
          router.replace('/study/select'); // Redirect to selection page
        }
    }, 50); // 50ms delay
    return () => clearTimeout(checkTimer);
  }, [isInitialized, currentInput, currentMode, router]);

  // --- Consolidated TTS Trigger Effect (Refined Logic) --- 
  useEffect(() => {
      const hasCardChanged = prevCardIdRef.current !== currentCard?.id;
      
      // Update ref *before* guard clauses for next render cycle check
      prevCardIdRef.current = currentCard?.id;

      // Guard conditions
      if (!currentCard || ttsLoading || !settings?.ttsEnabled || isLoading) {
          // console.log("[TTS Effect] Guards prevented TTS trigger.");
          return; 
      }
      
      let textToSpeak: string | null | undefined = null;
      let langToUse: string | null = null;

      // Determine what to speak
      if (hasCardChanged || !isFlipped) { 
          // NEW CARD or SAME CARD UNFLIPPED: Speak the question
          textToSpeak = currentCard.question;
          langToUse = currentCard.decks?.primary_language ?? 'en-US';
          // console.log(`[TTS Effect] Preparing Question: cardId=${currentCard.id}, hasChanged=${hasCardChanged}, isFlipped=${isFlipped}`);
      } else { 
          // SAME CARD and FLIPPED: Speak the answer
          textToSpeak = currentCard.answer;
          langToUse = currentCard.decks?.secondary_language ?? currentCard.decks?.primary_language ?? 'en-US';
          // console.log(`[TTS Effect] Preparing Answer: cardId=${currentCard.id}, hasChanged=${hasCardChanged}, isFlipped=${isFlipped}`);
      }

      // Only speak if text is valid and language is determined
      if (textToSpeak && langToUse) {
          // console.log(`[TTS Effect] Speaking: "${textToSpeak.substring(0,20)}..." in ${langToUse}`);
          speak(textToSpeak, langToUse);
      } else {
          // console.log("[TTS Effect] No text to speak or lang missing.");
      }
       
  // Minimal dependencies: card ID (to detect change), flip state, TTS setting, loading state, speak fn
  }, [currentCard?.id, isFlipped, settings?.ttsEnabled, isLoading, speak, ttsLoading]); 
  // Keep ttsLoading here to prevent starting speak if already speaking from prev render
  // Keep speak as it's a function defined outside

  // --- Callbacks ---
  // Flip handler with transition state
  const handleFlip = useCallback(() => {
    if (isTransitioning) return; // Prevent flipping during transition
    
    setIsTransitioning(true); 
    setIsFlipped(prev => !prev); 
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, FLIP_DURATION_MS);

    // Cleanup timer if component unmounts or card changes mid-transition
    return () => clearTimeout(timer);
  }, [isTransitioning]); // Depend on isTransitioning to avoid stale closures

  // --- Render Logic ---

  // Loading State
  if (isLoading) {
     return (
        <div className="flex flex-col justify-center items-center min-h-screen">
            <IconLoader className="h-10 w-10 animate-spin mb-4" />
            <p className="text-muted-foreground">Loading session...</p>
        </div>
    );
  }

  // Error State
  if (error) {
     return (
        <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
            <Alert variant="destructive" className="max-w-md">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Loading Session</AlertTitle>
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/study/select')} className="mt-4">Go Back</Button>
        </div>
    );
  }

  // Completion State - Updated with Results
  if (isComplete) {
     const noCardsFoundInitially = initialSelectionCount === 0;
     const sessionHadCards = initialSelectionCount > 0;

     let title = "Session Complete!";
     let description = "Well done!"; 

     if (noCardsFoundInitially) {
         title = "No Cards Found";
         description = "There were no cards matching your selection criteria.";
     } else if (sessionHadCards) { 
         // Extract results
         const { correct = 0, incorrect = 0, completedInSession = 0 } = sessionResults ?? {};
         const totalAnswered = correct + incorrect;
         const accuracy = totalAnswered > 0 ? Math.round((correct / totalAnswered) * 100) : 0;

         if (studyMode === 'review') {
             title = "🎉 Review Complete! 🎉";
             // initialSelectionCount might differ from completedInSession if user stops early?
             // Use completedInSession for number reviewed in this specific session.
             description = `You reviewed ${completedInSession} card${completedInSession === 1 ? '' : 's'}. Correct: ${correct}, Incorrect: ${incorrect} (${accuracy}% accuracy).`;
         } else { // Learn mode complete
             title = "🎉 Learn Session Complete! 🎉";
             description = `You learned ${completedInSession} card${completedInSession === 1 ? '' : 's'} in this session! Correct: ${correct}, Incorrect: ${incorrect}. Great work!`;
         }
     } // Handle initialSelectionCount === -1 (init error) if needed
     
     return (
        <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen text-center">
            <h1 className="text-3xl font-bold mb-4">{title}</h1>
            <p className="text-lg text-muted-foreground mb-6">{description}</p>
             <Button onClick={() => router.push('/study/select')} className="mt-4">Start New Session</Button>
        </div>
    );
  }

  // Check if currentCard is ready (it might be null briefly even if not loading/complete)
  if (!currentCard) {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen">
            <p className="text-muted-foreground">Error: Could not load current card.</p>
            <Button onClick={() => router.push('/study/select')} className="mt-4">Go Back</Button>
        </div>
    );
  }

  // Active Study State
  const progressValue = totalCardsInSession > 0 ? (currentCardNumber / totalCardsInSession) * 100 : 0;
  const progressText = `Card ${currentCardNumber} / ${totalCardsInSession}`;

  return (
    <div className="container mx-auto p-4 md:p-6 flex flex-col min-h-screen">
      {/* Header with Mode and Progress */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold capitalize">Study Mode: {studyMode}</h1>
        {totalCardsInSession > 0 && (
            <div className="flex items-center gap-2 mt-2">
                <Progress value={progressValue} className="w-full h-2" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {progressText}
                </span>
            </div>
        )}
      </div>

      {/* Main Study View Area */}
      <div className="flex-grow flex items-center justify-center">
          {/* Render StudyFlashcardView only if currentCard is valid */}
          <StudyFlashcardView
            card={currentCard} // Pass DbCard directly
            onAnswer={answerCard}
            // Pass real settings and flip state/handler
            settings={settings}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            // Pass derived progress text
            progressText={progressText}
            // Pass the transition state
            isTransitioning={isTransitioning}
         />
      </div>

       {/* Add footer or controls if needed */}
    </div>
  );
}