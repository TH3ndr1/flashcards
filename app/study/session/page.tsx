// app/study/session/page.tsx
'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStudySessionStore } from '@/store/studySessionStore';
import { useStudySession, type UseStudySessionReturn } from '@/hooks/useStudySession';
import { StudyFlashcardView, type StudyFlashcardViewProps } from '@/components/study-flashcard-view';
import { Loader2 as IconLoader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { toast } from 'sonner';
import { useSettings } from '@/providers/settings-provider';
import { useTTS } from "@/hooks/use-tts";
import type { SessionType, StudyCardDb } from '@/types/study';
import { appLogger } from '@/lib/logger';

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

  const [isPageInitialized, setIsPageInitialized] = useState(false);

  const { settings, loading: isLoadingSettings } = useSettings();

  const {
    currentCard,
    isInitializing,
    error,
    sessionType,
    isComplete,
    totalCardsInSession,
    currentCardNumberInSession,
    initialQueryCount,
    answerCard,
    sessionResults,
    isProcessingAnswer,
    isFlipped,
    onFlip,
    currentCardStatusDisplay,
    showContinueReviewPrompt,
    onContinueReview
  }: UseStudySessionReturn = useStudySession({
    initialInput: currentInputFromStore,
    sessionType: sessionTypeFromStore
  });

  const [isTransitioningVisual, setIsTransitioningVisual] = useState(false);
  const { speak, stop, ttsState } = useTTS({});

  // Refs for TTS logic
  const prevCardIdRef = useRef<string | null | undefined>(null);
  const prevIsFlippedRef = useRef(isFlipped); // Tracks previous flip state for edge detection
  const speakInitiatedForQuestionRef = useRef(false); // Has speak been called for current Q?
  const speakInitiatedForAnswerRef = useRef(false);   // Has speak been called for current A?

  const isLoadingPage = isInitializing || isLoadingSettings || !isPageInitialized;

  // Effect to check for necessary study parameters and redirect if missing
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


  // Effect to reset visual transition and TTS "spoken" flags when currentCard.id changes
  useEffect(() => {
    if (currentCard?.id !== prevCardIdRef.current) {
        appLogger.info(`[SessionPage] Card ID changed. Resetting all TTS spoken flags.`);
        speakInitiatedForQuestionRef.current = false;
        speakInitiatedForAnswerRef.current = false;
        prevCardIdRef.current = currentCard?.id;
        setIsTransitioningVisual(false);
    } else if (!isFlipped && prevIsFlippedRef.current) { // Just flipped from Answer back to Question
        appLogger.info(`[SessionPage] Flipped back to question for card ${currentCard?.id}. Resetting answer spoken flag.`);
        // Only reset answer flag, question might have been spoken and we might want it again
        speakInitiatedForAnswerRef.current = false;
        // To allow question to re-speak, reset its flag too if desired
        // speakInitiatedForQuestionRef.current = false; // <-- Add this line to re-speak question
    }
}, [currentCard?.id, isFlipped]); // prevIsFlippedRef is not needed here, it's for the next render

// TTS Effect for Speaking Question
useEffect(() => {
    const cardForTTS = currentCard as StudyCardDb | null;
    // Speak if: TTS enabled, card exists, not loading, ON FRONT, AND (it's a new card OR we just flipped back to front)
    // The speakInitiated flag is to prevent re-speak due to other state changes (like ttsState) while on the same card face.
    if (!settings?.ttsEnabled || !cardForTTS || ttsState === 'loading' || isLoadingPage || isFlipped) {
        if (isFlipped && speakInitiatedForQuestionRef.current) {
             // If we flipped away from question after it spoke, reset its flag so it can speak again if we flip back
             // speakInitiatedForQuestionRef.current = false; // This might be too aggressive
        }
        return;
    }

    // Condition to speak:
    // 1. Card ID has changed and question hasn't been initiated for this new card.
    // 2. OR, we just flipped TO the question side (isFlipped is false, prevIsFlippedRef was true)
    //    AND the question hasn't been initiated yet in this "front-facing" instance.
    const justFlippedToQuestion = !isFlipped && prevIsFlippedRef.current; // Detects flip from back to front

    if (!speakInitiatedForQuestionRef.current || justFlippedToQuestion) {
        const textToSpeak = cardForTTS.question;
        const langToUse = cardForTTS.decks?.primary_language ?? 'en';

        if (textToSpeak && langToUse) {
            appLogger.info(`[SessionPage TTS - Question] Requesting speak for card ${cardForTTS.id}. Reason: ${!speakInitiatedForQuestionRef.current ? "New card/init" : "Flipped to Q"}`);
            speakInitiatedForQuestionRef.current = true;
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
}, [currentCard, isFlipped, settings?.ttsEnabled, isLoadingPage, speak, stop, ttsState]); // prevIsFlippedRef managed in its own effect

// TTS Effect for Speaking Answer (this one is likely fine as is)
useEffect(() => {
    const cardForTTS = currentCard as StudyCardDb | null;
    if (!settings?.ttsEnabled || !cardForTTS || ttsState === 'loading' || isLoadingPage || !isFlipped || speakInitiatedForAnswerRef.current) {
        return;
    }

    if (isFlipped && !prevIsFlippedRef.current) { // Only speak on transition to back
        const textToSpeak = cardForTTS.answer;
        // ... (rest of answer speaking logic)
        const langToUse = cardForTTS.decks?.secondary_language ?? cardForTTS.decks?.primary_language ?? 'en';
        if (textToSpeak && langToUse) {
            appLogger.info(`[SessionPage TTS - Answer] Requesting speak for card ${cardForTTS.id}`);
            speakInitiatedForAnswerRef.current = true;
            stop();
            speak(textToSpeak, langToUse)
                .catch( /* ... */);
        }
    }
}, [currentCard, isFlipped, settings?.ttsEnabled, isLoadingPage, speak, stop, ttsState]);

// Effect to update prevIsFlippedRef (runs after all other effects for the render)
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

  // --- Render Logic ---
  if (isLoadingPage) {
     return (
        <div className="flex flex-col justify-center items-center min-h-screen">
            <IconLoader className="h-10 w-10 animate-spin mb-4" />
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

  const progressValue = totalCardsInSession > 0 ? (sessionResults.totalAnswered / totalCardsInSession) * 100 : 0;
  const cardPositionText = `Card ${currentCardNumberInSession} / ${totalCardsInSession}`;

  let displaySessionTitle = 'Practice Session';
  if (sessionType === 'learn-only') {
      displaySessionTitle = 'Learning Session';
  } else if (sessionType === 'review-only') {
      displaySessionTitle = 'Review Session (SRS)';
  } else if (sessionType === 'unified') {
      displaySessionTitle = showContinueReviewPrompt ? 'Learning Phase Complete' : 'Practice Session (Unified)';
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