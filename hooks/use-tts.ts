"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettings } from '@/providers/settings-provider';
import { appLogger, statusLogger } from '@/lib/logger';
// --- Import the new action ---
import { generateTtsAction } from '@/lib/actions/ttsActions';

// Language code mapping for fallbacks
const LANGUAGE_CODES: Record<string, string> = {
  // ISO codes with dialects
  // English dialects
  en: "en-GB",  // Default to UK English
  "en-GB": "en-GB",
  "en-US": "en-US",
  
  // Dutch dialects
  nl: "nl-NL",  // Default to Netherlands Dutch
  "nl-BE": "nl-BE",
  "nl-NL": "nl-NL",
  
  // French dialects
  fr: "fr-FR",  // Default to France French
  "fr-BE": "fr-BE",
  "fr-FR": "fr-FR",
  "fr-CH": "fr-CH",
  
  // German dialects
  de: "de-DE",  // Default to Germany German
  "de-DE": "de-DE",
  "de-AT": "de-AT",
  "de-CH": "de-CH",
  
  // Spanish dialect
  es: "es-ES",  // Default to Spain Spanish
  "es-ES": "es-ES",
  
  // Italian dialects
  it: "it-IT",  // Default to Italy Italian
  "it-IT": "it-IT",
  "it-CH": "it-CH",
  
  // Full names (for backward compatibility)
  english: "en-GB",
  dutch: "nl-NL",
  french: "fr-FR",
  german: "de-DE",
  spanish: "es-ES",
  italian: "it-IT",
};

// --- Interfaces (Keep as is) ---
interface UseTTSProps {
    onAudioStart?: () => void;
    onAudioEnd?: () => void;
}

type TTSState = 'idle' | 'loading' | 'playing' | 'error';

interface UseTTSResult {
    ttsState: TTSState;
    speak: (text: string, languageCode: string) => Promise<void>;
    stop: () => void;
    currentLanguage: string | null;
}

// --- Helper function to log errors (Keep as is) ---
function logTTSError(message: string, error?: any) {
    console.error(`[TTS Hook Error]: ${message}`, error instanceof Error ? error.message : error || '');
    // Optionally send to an error tracking service
}

export function useTTS({ onAudioStart, onAudioEnd }: UseTTSProps): UseTTSResult {
    const [ttsState, setTtsState] = useState<TTSState>('idle');
    const { settings } = useSettings();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState<string | null>(null);

    // --- Ensure Audio Element Exists (Keep as is) ---
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onplay = () => {
                setTtsState('playing');
                onAudioStart?.(); // Call callback if provided
            };
            audioRef.current.onended = () => {
                setTtsState('idle');
                onAudioEnd?.(); // Call callback if provided
            };
            audioRef.current.onerror = () => {
                // Access the error property from the audio element itself
                const error = audioRef.current?.error;
                logTTSError('Audio playback error', error?.message || 'Unknown audio error');
                setTtsState('error');
                onAudioEnd?.(); // Also call on end for errors
            };
        }
        // Cleanup function to pause and clear src on unmount
        return () => {
            if (audioRef.current) {
                 audioRef.current.pause();
                 audioRef.current.removeAttribute('src'); // Clear source
            }
        };
    }, [onAudioStart, onAudioEnd]); // Dependencies for callbacks

    // --- Stop Function (Keep as is) ---
    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0; // Reset playback position
             audioRef.current.removeAttribute('src'); // Clear source to prevent re-play if src changes
            setTtsState('idle');
            onAudioEnd?.(); // Ensure end callback is called on explicit stop
        }
    }, [onAudioEnd]);

    // --- Speak Function (Simplified version based on old client implementation) ---
    const speak = useCallback(async (text: string, language: string) => {
        if (!text || !language) {
            logTTSError('Missing text or language code for TTS.');
            return;
        }
        
        // Use console.log instead of console.error to avoid Next.js error handling
        console.log(`[TTS Debug] Original language: "${language}"`);
        console.log(`[TTS Debug] Settings:`, settings);
        
        // Stop any currently playing audio before starting new request
        stop();

        try {
            setTtsState('loading');
            
            // Get basic language info - directly use the working client-side implementation logic
            const langToUse = language?.toLowerCase() || 'en';
            const baseLanguage = langToUse.split('-')[0];
            
            // DIRECTLY PORT THE WORKING VERSION
            // This is the exact language mapping logic from the working client implementation
            console.log(`[TTS Debug] Base language: "${baseLanguage}"`);
            
            // Create a copy of the EXACT implementation from the working version
            const mappedLanguage = settings?.languageDialects?.[baseLanguage as keyof typeof settings.languageDialects] || 
                                  LANGUAGE_CODES[langToUse] || 
                                  "en-GB";
                                  
            console.log(`[TTS Debug] Mapped language: "${mappedLanguage}"`);
            console.log(`[TTS Debug] Final mapping: ${language} → ${mappedLanguage}`);
            
            setCurrentLanguage(mappedLanguage);

            // Call the server action with mapped language
            const { audioContent, error: ttsError } = await generateTtsAction(
                text,
                mappedLanguage // Use the mapped language
            );

            if (ttsError || !audioContent) {
                throw new Error(ttsError || 'TTS Action returned no audio content.');
            }

            // --- Play the audio --- 
            if (audioRef.current) {
                const audioSrc = `data:audio/mp3;base64,${audioContent}`;
                audioRef.current.src = audioSrc;
                await audioRef.current.play();
            } else {
                throw new Error("Audio element not available.");
            }

        } catch (error: any) {
            logTTSError('TTS Error (action call or playback)', error);
            if (audioRef.current) {
                audioRef.current.removeAttribute('src'); // Clear src on error
            }
            setTtsState('error');
            onAudioEnd?.(); // Ensure end callback fires on error
        }
    }, [settings, stop, onAudioEnd]);

    return { ttsState, speak, stop, currentLanguage };
} 