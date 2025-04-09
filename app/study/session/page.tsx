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
  
  const currentInput = useStudySessionStore((state) => state.currentInput);
  const currentMode = useStudySessionStore((state) => state.currentMode);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false); 
  const [isTransitioning, setIsTransitioning] = useState(false); 

  const { settings, loading: isLoadingSettings } = useSettings(); 

  // Define the reset function BEFORE useStudySession uses it
  const resetFlipState = useCallback(() => {
      setIsFlipped(false);
      setIsTransitioning(false);
      console.log("[StudySessionPage] Flip state reset.");
  }, []); // No dependencies needed

  // Initialize the core study session hook, passing the defined callback
  const { 
    currentCard, 
    isInitializing, // Use isInitializing from hook
    error, studyMode, 
    isComplete, totalCardsInSession, 
    currentCardNumber, initialSelectionCount, 
    answerCard, sessionResults, 
    isProcessingAnswer // Still needed for button disabling
  } = useStudySession({ 
      initialInput: currentInput, 
      initialMode: currentMode, 
      onNewCard: resetFlipState // Now valid
  });

  const { speak, loading: ttsLoading } = useTTS();
  const isLoadingPage = isInitializing || isLoadingSettings || !isInitialized;
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
      if (!currentCard || ttsLoading || !settings?.ttsEnabled || isLoadingPage) return;

      const cardIdHasChanged = prevCardIdRef.current !== currentCard.id;
      prevCardIdRef.current = currentCard.id;
      
      let textToSpeak: string | null | undefined = null;
      let langToUse: string | null = null;

      // Determine what to speak based on change or flip state
      if (cardIdHasChanged || !isFlipped) { 
          textToSpeak = currentCard.question;
          langToUse = currentCard.decks?.primary_language ?? 'en-US';
      } else if (isFlipped) { 
          textToSpeak = currentCard.answer;
          langToUse = currentCard.decks?.secondary_language ?? currentCard.decks?.primary_language ?? 'en-US';
      }

      if (textToSpeak && langToUse) {
          speak(textToSpeak, langToUse);
      }
       
  // Minimal dependencies: card ID, flip state, TTS enabled setting, and session loading state.
  // Crucially REMOVE ttsLoading and speak.
  }, [currentCard?.id, isFlipped, settings?.ttsEnabled, isLoadingPage]); 

  // --- Callbacks ---
  const handleFlip = useCallback(() => {
    if (isTransitioning) return; 
    setIsTransitioning(true); 
    setIsFlipped(prev => !prev); 
    const timer = setTimeout(() => { setIsTransitioning(false); }, FLIP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isTransitioning]); 

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
            isTransitioning={isTransitioning || isProcessingAnswer} // Disable buttons during flip AND processing
         />
      </div>

       {/* Add footer or controls if needed */}
    </div>
  );
}