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
import type { Tables } from '@/types/database'; // Import Tables type
import { appLogger, statusLogger } from '@/lib/logger';

// Add proper type for the card including joined deck data
type StudyCard = Tables<'cards'> & {
  decks?: {
    primary_language: string;
    secondary_language: string;
  } | null;
};

// Assuming ReviewGrade is defined or imported elsewhere
type ReviewGrade = 1 | 2 | 3 | 4;

const FLIP_DURATION_MS = 300; // Match CSS animation duration (adjust if needed)

// Add TypeScript declaration for window property
declare global {
  interface Window {
    ttsErrorShown?: boolean;
  }
}

export default function StudySessionPage() {
  const router = useRouter();
  
  const currentInput = useStudySessionStore((state) => state.currentInput);
  const currentMode = useStudySessionStore((state) => state.currentMode);

  const [isInitialized, setIsInitialized] = useState(false);

  const { settings, loading: isLoadingSettings } = useSettings(); 

  // Get flip state and action FROM the hook
  const { 
    currentCard, isInitializing, error, studyMode, 
    isComplete, totalCardsInSession, currentCardNumber, initialSelectionCount, 
    answerCard, sessionResults, isProcessingAnswer, 
    isFlipped, onFlip // Use state/action from hook
  } = useStudySession({ initialInput: currentInput, initialMode: currentMode });

  // Still need local transition state for visual flip animation disabling
  const [isTransitioningVisual, setIsTransitioningVisual] = useState(false);

  const { speak, ttsState } = useTTS({});
  const isLoadingPage = isInitializing || isLoadingSettings || !isInitialized;
  const prevSpokenStateRef = useRef<{ cardId: string; isFlipped: boolean } | null>(null);

  // Redirect if parameters aren't set after initial client-side check
  useEffect(() => {
    if (!isInitialized) {
        setIsInitialized(true);
        return; // Wait for initialization before checking
    }
    // Add short delay to allow store state to potentially propagate on fast refreshes
    const checkTimer = setTimeout(() => {
        if (!currentInput || !currentMode) {
          appLogger.warn("Study parameters not set, redirecting.");
          toast.warning("No study session active.", { description: "Redirecting to selection..."});
          router.replace('/study/select'); // Redirect to selection page
        }
    }, 50); // 50ms delay
    return () => clearTimeout(checkTimer);
  }, [isInitialized, currentInput, currentMode, router]);

  // --- TTS Trigger Effect (Refined Logic) --- 
  useEffect(() => {
      // Initial guard: ensures essential data is present and TTS is enabled.
      if (!currentCard || !settings || !settings.ttsEnabled || isLoadingPage || ttsState === 'loading') {
          return;
      }

      const actualCardId = currentCard.id;
      const actualIsFlipped = isFlipped;

      // Determine if a speech-worthy state change has occurred.
      const shouldSpeakDueToStateChange =
          prevSpokenStateRef.current?.cardId !== actualCardId ||
          prevSpokenStateRef.current?.isFlipped !== actualIsFlipped;

      if (!shouldSpeakDueToStateChange) {
          return; // No change in card or flip state relevant to speech since last time.
      }

      let textToSpeak: string | null | undefined = null;
      let langToUse: string | null = null;
      let speechLogContext = ""; // For clearer logging

      const studyCard = currentCard as StudyCard;

      // Determine text and language based on current card and flip state.
      // This logic runs if shouldSpeakDueToStateChange is true.
      if (prevSpokenStateRef.current?.cardId !== actualCardId) { // Card has changed or first card
          speechLogContext = actualIsFlipped ? "New Card - Answer" : "New Card - Question";
      } else { // Card is the same, so flip state must have changed
          speechLogContext = actualIsFlipped ? "Card Flipped - Answer" : "Card Flipped - Question";
      }

      textToSpeak = actualIsFlipped ? studyCard.answer : studyCard.question;
      langToUse = actualIsFlipped
          ? (studyCard.decks?.secondary_language ?? studyCard.decks?.primary_language ?? 'en-US')
          : (studyCard.decks?.primary_language ?? 'en-US');
      
      if (textToSpeak && langToUse) {
          appLogger.info(`[TTS Trigger] ${speechLogContext}: Speaking lang ${langToUse}. Text: "${textToSpeak.substring(0, 30)}..."`);
          speak(textToSpeak, langToUse).catch(error => {
              appLogger.error("Failed to speak text:", error);
              if (!window.ttsErrorShown) {
                  toast.error("Text-to-speech error", { 
                      description: "TTS functionality is unavailable. Check your settings.",
                      duration: 5000
                  });
                  window.ttsErrorShown = true;
              }
          });
          // Update the ref to reflect the state for which speech was just initiated.
          prevSpokenStateRef.current = { cardId: actualCardId, isFlipped: actualIsFlipped };
      } else if (shouldSpeakDueToStateChange) {
          // If a state change occurred that should have triggered speech, but text was empty,
          // still update the ref to prevent retrying for this empty state.
          prevSpokenStateRef.current = { cardId: actualCardId, isFlipped: actualIsFlipped };
          if (!textToSpeak) {
            appLogger.info(`[TTS Trigger] ${speechLogContext}: Determined no text to speak (empty question/answer).`);
          }
      }
       
  // Key dependencies: currentCard (for ID and content), isFlipped (for side),
  // settings (for ttsEnabled and languageDialects used by speak),
  // isLoadingPage (guard), speak (action), ttsState (guard and potential trigger).
  }, [currentCard, isFlipped, settings, isLoadingPage, speak, ttsState]);

  // --- Callbacks ---
  const handleFlip = useCallback(() => {
    if (isTransitioningVisual) return; // Prevent double-click during animation
    setIsTransitioningVisual(true);
    onFlip(); // Call the hook's flip action
    const timer = setTimeout(() => {
      setIsTransitioningVisual(false);
    }, FLIP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isTransitioningVisual, onFlip]); // Depend on local state and hook action

  // --- Render Logic ---

  // Use isLoadingPage for the main spinner
  if (isLoadingPage) { 
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
         // Extract results with correct property names
         const { correctCount = 0, incorrectCount = 0, totalAnswered = 0 } = sessionResults ?? {};
         const totalCardsCompleted = totalAnswered; // Use as a replacement for completedInSession
         const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

         if (studyMode === 'review') {
             title = "🎉 Review Complete! 🎉";
             // Use totalCardsCompleted for number reviewed in this specific session
             description = `You reviewed ${totalCardsCompleted} card${totalCardsCompleted === 1 ? '' : 's'}. Correct: ${correctCount}, Incorrect: ${incorrectCount} (${accuracy}% accuracy).`;
         } else { // Learn mode complete
             title = "🎉 Learn Session Complete! 🎉";
             description = `You learned ${totalCardsCompleted} card${totalCardsCompleted === 1 ? '' : 's'} in this session! Correct: ${correctCount}, Incorrect: ${incorrectCount}. Great work!`;
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
            isTransitioning={isTransitioningVisual || isProcessingAnswer} // Disable buttons during visual flip OR background processing
         />
      </div>

       {/* Add footer or controls if needed */}
    </div>
  );
}