// app/study/session/page.tsx
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
// Import the specific types needed
import type { DbCard } from '@/types/database'; // Only need DbCard now
// REMOVED: import { mapDbCardToFlashCard } from '@/lib/actions/cardActions';

// Assuming ReviewGrade is defined or imported elsewhere
type ReviewGrade = 1 | 2 | 3 | 4;

const FLIP_DURATION_MS = 300; // Match CSS animation duration (adjust if needed)

export default function StudySessionPage() {
  const router = useRouter();
  const { currentInput, currentMode, clearStudyParameters } = useStudySessionStore(
    (state) => ({
      currentInput: state.currentInput,
      currentMode: state.currentMode,
      clearStudyParameters: state.clearStudyParameters,
    })
  );

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
    answerCard
  } = useStudySession({
      initialInput: currentInput,
      initialMode: currentMode
  });

  // Fetch Settings
  const { settings, loading: isLoadingSettings } = useSettings();

  // Combined Loading State
  const isLoading = isLoadingSession || isLoadingSettings || !isInitialized;

  // Redirect if parameters aren't set after initial client-side check
  useEffect(() => {
    if (!isInitialized) {
        setIsInitialized(true);
        return; // Wait for initialization before checking
    }
    if (!currentInput || !currentMode) {
      console.warn("Study parameters not set, redirecting.");
      toast.warning("No study session active.", { description: "Redirecting to selection..."});
      router.replace('/study/select'); // Redirect to selection page
    }
  }, [isInitialized, currentInput, currentMode, router]);

  // Clear parameters when the component unmounts
  useEffect(() => {
    return () => {
      clearStudyParameters();
      console.log("Study parameters cleared on unmount.");
    };
  }, [clearStudyParameters]);

  // Reset flip state and transition state when card changes
  useEffect(() => {
    if (currentCard?.id) { 
        setIsFlipped(false);
        setIsTransitioning(false); // Also reset transition state
    }
  }, [currentCard?.id]);

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

  // Completion State
  if (isComplete) {
     const initiallyHadCards = totalCardsInSession > 0;
     return (
        <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen text-center">
            <h1 className="text-2xl font-bold mb-4">
                {initiallyHadCards ? "🎉 Session Complete! 🎉" : "No Cards Found"}
            </h1>
            <p className="text-muted-foreground mb-6">
                 {initiallyHadCards
                    ? `You finished studying ${totalCardsInSession} card${totalCardsInSession === 1 ? '' : 's'}.`
                    : "There were no cards matching your selection criteria (or none due for review)."}
            </p>
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