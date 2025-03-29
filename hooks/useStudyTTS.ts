"use client";

import { useEffect } from 'react';
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
  /** The full deck object (needed for language codes). */
  deck: Deck | null;
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
  deck,
  isFlipped,
}: UseStudyTTSProps): void { // This hook performs side effects, doesn't return state
  const { speak, setLanguage } = useTTS();

  useEffect(() => {
    // Conditions under which speech should NOT occur
    if (!isEnabled || isLoading || isTransitioning || !currentStudyCard || !deck) {
      return;
    }

    // Determine the text and language code based on the card's flipped state
    const textToSpeak = isFlipped ? currentStudyCard.answer : currentStudyCard.question;
    const langCode = isFlipped ? deck.answerLanguage : deck.questionLanguage;

    // Validate required data for TTS
    if (!textToSpeak || !langCode) {
      console.warn("useStudyTTS: Missing text or language code, cannot speak.");
      return;
    }

    // Configure the TTS engine
    setLanguage(langCode);

    // Speak the text after a configured delay (allows for transitions)
    const speakTimeout = setTimeout(() => {
      speak(textToSpeak);
    }, TTS_DELAY_MS);

    // Cleanup: Clear the timeout if dependencies change before it fires
    return () => clearTimeout(speakTimeout);

    // Dependencies: Re-run effect if any of these values change
  }, [isEnabled, isLoading, isTransitioning, currentStudyCard, deck, isFlipped, speak, setLanguage]);
} 