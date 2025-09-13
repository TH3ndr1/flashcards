// app/study/session/page.tsx
'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useStudySessionStore } from '@/store/studySessionStore';
import { useStudySession, type UseStudySessionReturn } from '@/hooks/useStudySession';
import { Loader2 as IconLoader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { toast } from 'sonner';
import { useSettings } from '@/providers/settings-provider';
import { useTTS } from "@/hooks/use-tts";
import type { SessionType, StudyCardDb, SessionResults } from '@/types/study'; // Added SessionResults
import { appLogger } from '@/lib/logger';

// Dynamically import StudyFlashcardView
const StudyFlashcardView = dynamic(() => 
  import('@/components/study-flashcard-view').then(mod => mod.StudyFlashcardView),
  {
    loading: () => (
      <div className="w-full max-w-2xl h-80 flex items-center justify-center">
        <IconLoader className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
    ssr: false // StudyFlashcardView uses client-side hooks like useTheme, useTTS extensively
  }
);

const FLIP_DURATION_MS = 300;

declare global {
  interface Window {
    ttsErrorShown?: boolean;
  }
}

export default function StudySessionPage() {
  const router = useRouter();

  const currentInputFromStore = useStudySessionStore((state) => state.currentInput);
  const sessionTypeFromStore = useStudySessionStore((state) => state.currentSessionType);
  const srsEnabledFromStore = useStudySessionStore((state) => state.srsEnabledForSession);

  const [isPageInitialized, setIsPageInitialized] = useState(false);

  const { settings, loading: isLoadingSettings } = useSettings();

  const {
    currentCard,
    isInitializing,
    error,
    sessionType,
    isComplete,
    totalCardsInSession, // This is initialEligibleCardCount from the hook
    // currentCardNumberInSession, // We will derive a new one based on refined progress
    initialQueryCount,
    answerCard,
    sessionResults, // Full SessionResults object
    isProcessingAnswer,
    isFlipped,
    onFlip,
    currentCardStatusDisplay,
    showContinueReviewPrompt,
    onContinueReview,
    unifiedSessionPhase // Destructure this new property
  }: UseStudySessionReturn = useStudySession({
    initialInput: currentInputFromStore,
    sessionType: sessionTypeFromStore,
    srsEnabled: srsEnabledFromStore
  });

  const [isTransitioningVisual, setIsTransitioningVisual] = useState(false);
  const { speak, stop, ttsState } = useTTS({});

  const prevCardIdRef = useRef<string | null | undefined>(null);
  const prevIsFlippedRef = useRef(isFlipped);
  const speakInitiatedForQuestionRef = useRef(false);
  const speakInitiatedForAnswerRef = useRef(false);

  const isLoadingPage = isInitializing || isLoadingSettings || !isPageInitialized;

  useEffect(() => {
    if (!isPageInitialized) {
        setIsPageInitialized(true);
        return;
    }
    const checkTimer = setTimeout(() => {
        if (!isLoadingSettings && !isInitializing && (!currentInputFromStore || !sessionTypeFromStore)) {
          appLogger.warn("[SessionPage ParamCheckEffect] REDIRECTING to /study/select due to missing params.", { currentInputFromStore, sessionTypeFromStore });
          toast.warning("No study session active.", { description: "Redirecting to selection..."});
          router.replace('/study/select');
        } else {
          appLogger.info("[SessionPage ParamCheckEffect] Conditions for redirect NOT MET or still loading.", {isLoadingSettings, isInitializing, currentInputFromStore, sessionTypeFromStore});
        }
    }, 250);
    return () => {
        appLogger.info("[SessionPage ParamCheckEffect] Cleanup.");
        clearTimeout(checkTimer);
    };
  }, [isPageInitialized, currentInputFromStore, sessionTypeFromStore, router, isLoadingSettings, isInitializing]);

  useEffect(() => {
    if (currentCard?.id !== prevCardIdRef.current) {
        setIsTransitioningVisual(false);
        speakInitiatedForQuestionRef.current = false;
        speakInitiatedForAnswerRef.current = false;
        // Don't update prevCardIdRef here - let the TTS effects handle it
        // This ensures the first card TTS can detect it's a new card
    }
  }, [currentCard?.id]);

  // Reset TTS refs when flip state changes to allow TTS on subsequent flips
  useEffect(() => {
    if (isFlipped !== prevIsFlippedRef.current) {
        speakInitiatedForQuestionRef.current = false;
        speakInitiatedForAnswerRef.current = false;
    }
  }, [isFlipped]);

  useEffect(() => {
    const cardForTTS = currentCard as StudyCardDb | null;
    if (!settings?.ttsEnabled || !cardForTTS || ttsState === 'loading' || isLoadingPage || isFlipped || speakInitiatedForQuestionRef.current) {
      return;
    }
    // Trigger TTS when showing question side (on flip state change OR first time showing)
    if (!isFlipped && (isFlipped !== prevIsFlippedRef.current || currentCard?.id !== prevCardIdRef.current)) {
        const textToSpeak = cardForTTS.question;
        const langToUse = cardForTTS.decks?.primary_language ?? 'en';
        if (textToSpeak && langToUse) {
          appLogger.info(`[SessionPage TTS - Question] Requesting speak for card ${cardForTTS.id}`);
          speakInitiatedForQuestionRef.current = true;
          // Update the card ID ref to track that we've processed this card
          prevCardIdRef.current = currentCard?.id;
          stop();
          speak(textToSpeak, langToUse)
            .catch(ttsError => {
              appLogger.error("[SessionPage TTS - Question] Failed to speak text:", ttsError);
              if (typeof window !== 'undefined' && !window.ttsErrorShown) {
                toast.error("Text-to-speech error", { description: "TTS for question failed." });
                window.ttsErrorShown = true;
              }
              speakInitiatedForQuestionRef.current = false;
            });
        }
    }
  }, [currentCard, isFlipped, settings?.ttsEnabled, isLoadingPage, speak, stop, ttsState]);

  useEffect(() => {
    const cardForTTS = currentCard as StudyCardDb | null;
    if (!settings?.ttsEnabled || !cardForTTS || ttsState === 'loading' || isLoadingPage || !isFlipped || speakInitiatedForAnswerRef.current) {
      return;
    }
    // Trigger TTS when showing answer side (whenever flip state changes to show answer)
    if (isFlipped && isFlipped !== prevIsFlippedRef.current) {
        const textToSpeak = cardForTTS.answer;
        const langToUse = cardForTTS.decks?.secondary_language ?? cardForTTS.decks?.primary_language ?? 'en';
        if (textToSpeak && langToUse) {
            appLogger.info(`[SessionPage TTS - Answer] Requesting speak for card ${cardForTTS.id}`);
            speakInitiatedForAnswerRef.current = true;
            stop();
            speak(textToSpeak, langToUse)
                .catch(ttsError => {
                    appLogger.error("[SessionPage TTS - Answer] Failed to speak text:", ttsError);
                    if (typeof window !== 'undefined' && !window.ttsErrorShown) {
                        toast.error("Text-to-speech error", { description: "TTS for answer failed." });
                        window.ttsErrorShown = true;
                    }
                    speakInitiatedForAnswerRef.current = false;
                });
        }
    }
  }, [currentCard, isFlipped, settings?.ttsEnabled, isLoadingPage, speak, stop, ttsState]);

  useEffect(() => {
    prevIsFlippedRef.current = isFlipped;
  });

  const handleFlip = useCallback(() => {
    if (isTransitioningVisual || isProcessingAnswer) return;
    setIsTransitioningVisual(true);
    onFlip();
    const timer = setTimeout(() => {
      setIsTransitioningVisual(false);
    }, FLIP_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isTransitioningVisual, onFlip, isProcessingAnswer]);


  // --- REFINED PROGRESS CALCULATION ---
  const { progressValue, cardPositionText } = useMemo(() => {
    const results = sessionResults as SessionResults; // Ensure sessionResults is not null

    if (totalCardsInSession === 0) {
      return { progressValue: 0, cardPositionText: "No cards" };
    }

    let currentProgressCount = 0;
    const maxProgressCount = totalCardsInSession;

    if (sessionType === 'learn-only' || (sessionType === 'unified' && unifiedSessionPhase === 'learning')) {
      currentProgressCount = results.graduatedFromLearnCount;
    } else if (sessionType === 'review-only' || (sessionType === 'unified' && unifiedSessionPhase === 'review')) {
      // For review, each card answered (correctly or incorrectly) is considered "processed" for this pass
      // If unified, totalAnswered includes learning phase. We need a way to track review phase answers.
      // For now, using totalAnswered for review-only, and a more complex calculation for unified-review might be needed.
      // Let's assume for review-only, totalAnswered IS the progress for this phase.
      // For unified review phase, this might show total progress of entire session.
      // A simple way for unified review is to count non-learning cards answered or total - learning cards answered.
      // This needs refinement if precise phase progress is desired for unified review.
      // Using totalAnswered might be misleading if it doesn't reset between phases of unified.
      // Let's use totalAnswered for now, and acknowledge this might need phase-specific counters in SessionResults.
      currentProgressCount = results.totalAnswered; // This will be cumulative for unified
    } else {
      currentProgressCount = results.totalAnswered; // Fallback
    }

    const displayProgressCount = Math.min(currentProgressCount, maxProgressCount);
    const calculatedProgressValue = maxProgressCount > 0 ? (displayProgressCount / maxProgressCount) * 100 : 0;
    const currentCardDisplayNum = displayProgressCount + (isComplete || showContinueReviewPrompt ? 0 : 1);


    return {
      progressValue: calculatedProgressValue,
      cardPositionText: `Card ${Math.min(currentCardDisplayNum, maxProgressCount)} / ${maxProgressCount}`
    };
  }, [sessionType, unifiedSessionPhase, sessionResults, totalCardsInSession, isComplete, showContinueReviewPrompt]);
  // --- END OF REFINED PROGRESS CALCULATION ---


  if (isLoadingPage) {
     return (
        <div className="flex flex-col justify-center items-center min-h-screen">
            <IconLoader className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading session...</p>
        </div>
    );
  }

  if (error) {
     return (
        <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
            <Alert variant="destructive" className="max-w-md">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Error Loading Session</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/study/select')} className="mt-4">Go Back</Button>
        </div>
    );
  }

  if (showContinueReviewPrompt) {
    return (
        <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen text-center">
            <h1 className="text-2xl font-bold mb-3">Learning Phase Complete!</h1>
            <p className="text-muted-foreground mb-6">Ready to review cards based on Spaced Repetition?</p>
            <div className="flex gap-4">
                <Button onClick={onContinueReview} size="lg">Continue to Review</Button>
                <Button variant="outline" size="lg" onClick={() => router.push('/study/select')}>End Session</Button>
            </div>
        </div>
    );
  }

  if (isComplete) {
     const noCardsFoundInitially = initialQueryCount === 0;
     const sessionHadCards = initialQueryCount > 0;
     let title = "Session Complete!";
     let description = "Well done!";

     if (noCardsFoundInitially) {
         title = "No Cards Found";
         description = "There were no cards matching your selection criteria for this session type.";
     } else if (sessionHadCards) {
         const { correctCount = 0, incorrectCount = 0, hardCount = 0, graduatedFromLearnCount = 0, graduatedFromRelearnCount = 0, totalAnswered = 0 } = sessionResults || {};
         const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
         if (sessionType === 'review-only') {
             title = "🎉 Review Complete! 🎉";
             description = `You reviewed ${totalAnswered} card${totalAnswered === 1 ? '' : 's'}. Correct: ${correctCount}, Hard: ${hardCount}, Incorrect: ${incorrectCount}. Accuracy: ${accuracy}%.`;
         } else if (sessionType === 'learn-only') {
             title = "🎉 Learning Complete! 🎉";
             description = `Processed ${totalAnswered} card interactions. Graduated: ${graduatedFromLearnCount}. Correct: ${correctCount}, Hard: ${hardCount}, Incorrect: ${incorrectCount}.`;
         } else { // unified
             title = "🎉 Practice Session Complete! 🎉";
             description = `Total interactions: ${totalAnswered}. Graduated Learn: ${graduatedFromLearnCount}, Graduated Relearn: ${graduatedFromRelearnCount}. Overall Correct: ${correctCount}, Hard: ${hardCount}, Incorrect: ${incorrectCount}.`;
         }
     }
     return (
        <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen text-center">
            <h1 className="text-3xl font-bold mb-4">{title}</h1>
            <p className="text-lg text-muted-foreground mb-6">{description}</p>
             <Button onClick={() => router.push('/study/select')} className="mt-4">Start New Session</Button>
        </div>
    );
  }

  if (!currentCard) {
    return (
        <div className="flex flex-col justify-center items-center min-h-screen">
            {currentCardStatusDisplay ? (
                <p className="text-muted-foreground">{currentCardStatusDisplay}</p>
            ) : (
                <p className="text-muted-foreground">Loading next card...</p>
            )}
            <Button onClick={() => router.push('/study/select')} className="mt-4">Go Back</Button>
        </div>
    );
  }

  // Use the new progressValue and cardPositionText from the useMemo hook
  // const progressValue = totalCardsInSession > 0 ? (sessionResults.totalAnswered / totalCardsInSession) * 100 : 0;
  // const cardPositionText = `Card ${currentCardNumberInSession} / ${totalCardsInSession}`;

  let displaySessionTitle = 'Practice Session';
  if (sessionType === 'learn-only') {
      displaySessionTitle = 'Learning Session';
  } else if (sessionType === 'review-only') {
      displaySessionTitle = 'Review Session (SRS)';
  } else if (sessionType === 'unified') {
      displaySessionTitle = showContinueReviewPrompt
        ? 'Learning Phase Complete'
        : unifiedSessionPhase === 'learning'
          ? 'Practice Session (Learning)'
          : 'Practice Session (Reviewing)';
  }


  return (
    <div className="container mx-auto p-4 md:p-6 flex flex-col min-h-screen">
      <div className="mb-4">
        <h1 className="text-xl font-semibold capitalize">
            {displaySessionTitle}
        </h1>
        {totalCardsInSession > 0 && (
            <div className="flex items-center gap-2 mt-2">
                <Progress value={progressValue} className="w-full h-2" />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {cardPositionText}
                </span>
            </div>
        )}
        {currentCardStatusDisplay && (
            <p className="text-xs text-muted-foreground mt-1">{currentCardStatusDisplay}</p>
        )}
      </div>
      <div className="flex-grow flex items-center justify-center">
          <StudyFlashcardView
            card={currentCard}
            onAnswer={answerCard}
            settings={settings}
            isFlipped={isFlipped}
            onFlip={handleFlip}
            progressText={currentCardStatusDisplay ?? undefined}
            isTransitioning={isTransitioningVisual || isProcessingAnswer}
         />
      </div>
    </div>
  );
}