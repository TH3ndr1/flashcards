"use client";

import { useEffect, useRef } from 'react';
import { useTTS } from "./use-tts";
import type { FlashCard, Deck } from "@/types/deck";
import { TTS_DELAY_MS } from "@/lib/study-utils";

interface UseStudyTTSProps {
  /** Whether TTS functionality is enabled in settings. */
  isEnabled: boolean | undefined;
  /** Whether the main session/deck is currently loading. */
  isLoading: boolean;
  /** Whether a card flip/transition animation is in progress. */
  isTransitioning: boolean;
  /** The card currently displayed in the study session. */
  currentStudyCard: FlashCard | undefined;
  /** The language code of the question. */
  questionLang: string | null | undefined;
  /** The language code of the answer. */
  answerLang: string | null | undefined;
  /** Whether the current card is flipped to show the answer. */
  isFlipped: boolean;
}

/**
 * Hook dedicated to handling Text-to-Speech side effects during a study session.
 * It listens to relevant state changes and triggers speech accordingly.
 */
export function useStudyTTS({
  isEnabled,
  isLoading,
  isTransitioning,
  currentStudyCard,
  questionLang,
  answerLang,
  isFlipped,
}: UseStudyTTSProps): void { // This hook performs side effects, doesn't return state
  const { speak, setLanguage } = useTTS();
  const speakTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Add a ref to hold the timeout ID

  useEffect(() => {
    // --- Clear previous timeout --- 
    if (speakTimeoutRef.current) {
        clearTimeout(speakTimeoutRef.current);
        speakTimeoutRef.current = null;
        console.log('[useStudyTTS Cleanup] Cleared previous speak timeout.');
    }
    // --- End Clear previous timeout ---

    // Conditions under which speech should NOT occur
    if (!isEnabled || isLoading || isTransitioning || !currentStudyCard) {
      return;
    }

    // --- Add Entry Log ---
    console.log(`[useStudyTTS useEffect Run] isEnabled=${isEnabled}, isLoading=${isLoading}, isTransitioning=${isTransitioning}, cardId=${currentStudyCard?.id}, isFlipped=${isFlipped}`);
    // --- End Entry Log ---

    // Determine the text and language code based on the card's flipped state
    const textToSpeak = isFlipped ? currentStudyCard.answer : currentStudyCard.question;
    
    // --- Updated Language Logic ---
    let langCode: string | null | undefined;
    const cardSpecificLang = isFlipped ? currentStudyCard.answerLanguage : currentStudyCard.questionLanguage;
    const deckLang = isFlipped ? currentStudyCard.deckAnswerLanguage : currentStudyCard.deckQuestionLanguage;

    langCode = cardSpecificLang || deckLang; // Prioritize card-specific, then deck
    
    // Fallback to a default language (e.g., English) if no specific language is found
    const effectiveLangCode = langCode || 'en-US'; 
    
    // --- Add Logging ---
    console.log('[useStudyTTS Debug]', {
        cardId: currentStudyCard.id,
        isFlipped,
        cardSpecificLang,
        deckLang,
        chosenLangCode: langCode,
        effectiveLangCode,
        cardQuestionLang: currentStudyCard.questionLanguage,
        cardAnswerLang: currentStudyCard.answerLanguage,
        deckQuestionLang: currentStudyCard.deckQuestionLanguage,
        deckAnswerLang: currentStudyCard.deckAnswerLanguage,
    });
    // --- End Logging ---
    // --- End Updated Language Logic ---

    // Validate required data for TTS
    if (!textToSpeak) {
      console.warn("useStudyTTS: Missing text, cannot speak.");
      return;
    }

    // Configure the TTS engine and speak
    // Note: setLanguage might not be strictly needed if lang is passed to speak,
    // but keeping it might be useful if useTTS relies on currentLanguage state internally.
    setLanguage(effectiveLangCode);

    // Speak the text after a configured delay (allows for transitions)
    // Store the timeout ID in the ref
    speakTimeoutRef.current = setTimeout(() => {
      // Pass the determined language directly to speak
      speak(textToSpeak, effectiveLangCode);
      speakTimeoutRef.current = null; // Clear ref after execution
    }, TTS_DELAY_MS);

    // Cleanup: Clear the timeout if dependencies change before it fires
    return () => {
        if (speakTimeoutRef.current) {
            clearTimeout(speakTimeoutRef.current);
            speakTimeoutRef.current = null;
            console.log('[useStudyTTS Cleanup] Cleared speak timeout on unmount/re-run.');
        }
    };

    // Dependencies: Re-run effect if any of these values change
  }, [
    isEnabled, 
    isLoading, 
    isTransitioning, 
    currentStudyCard, 
    // Remove questionLang and answerLang from dependencies as they are derived
    isFlipped, 
    speak, 
    setLanguage
]);
} 