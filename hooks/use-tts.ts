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
    speak: (text: string, languageCode: string, gender?: 'NEUTRAL' | 'MALE' | 'FEMALE') => Promise<void>;
    preload: (text: string, languageCode: string, gender?: 'NEUTRAL' | 'MALE' | 'FEMALE') => void;
    stop: () => void;
    currentLanguage: string | null;
}

// --- Helper function to log errors (Keep as is) ---
function logTTSError(message: string, error?: any) {
    appLogger.error(`[TTS Hook Error]: ${message}`, error instanceof Error ? error.message : error || '');
    // Optionally send to an error tracking service
}

export function useTTS({ onAudioStart, onAudioEnd }: UseTTSProps): UseTTSResult {
    const [ttsState, setTtsState] = useState<TTSState>('idle');
    const { settings } = useSettings();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState<string | null>(null);
    // Cache for preloaded audio — key: `${mappedLang}::${gender}::${text}`
    const audioCacheRef = useRef<Map<string, string>>(new Map());

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

    // --- Language mapping helper ---
    const mapLanguage = useCallback((language: string): string => {
        const langToUse = language?.toLowerCase() || 'en';
        const baseLanguage = langToUse.split('-')[0];
        return settings?.languageDialects?.[baseLanguage as keyof typeof settings.languageDialects] ||
               LANGUAGE_CODES[langToUse] ||
               'en-GB';
    }, [settings]);

    // --- Preload: fetch audio and cache without playing ---
    const preload = useCallback((text: string, language: string, gender?: 'NEUTRAL' | 'MALE' | 'FEMALE') => {
        if (!text || !language) return;
        const mappedLanguage = mapLanguage(language);
        const cacheKey = `${mappedLanguage}::${gender ?? 'NEUTRAL'}::${text}`;
        if (audioCacheRef.current.has(cacheKey)) return; // already cached
        // Mark as in-flight by inserting a sentinel to prevent duplicate fetches
        audioCacheRef.current.set(cacheKey, '');
        generateTtsAction(text, mappedLanguage, gender ?? 'NEUTRAL')
            .then(({ audioContent }) => {
                if (audioContent) {
                    audioCacheRef.current.set(cacheKey, audioContent);
                } else {
                    audioCacheRef.current.delete(cacheKey);
                }
            })
            .catch(() => audioCacheRef.current.delete(cacheKey));
    }, [mapLanguage]);

    // --- Speak Function ---
    const speak = useCallback(async (text: string, language: string, gender?: 'NEUTRAL' | 'MALE' | 'FEMALE') => {
        if (!text || !language) {
            logTTSError('Missing text or language code for TTS.');
            return;
        }

        // Stop any currently playing audio before starting new request
        stop();

        try {
            setTtsState('loading');

            const mappedLanguage = mapLanguage(language);
            setCurrentLanguage(mappedLanguage);

            // Check preload cache
            const cacheKey = `${mappedLanguage}::${gender ?? 'NEUTRAL'}::${text}`;
            let audioContent: string | null = null;

            const cached = audioCacheRef.current.get(cacheKey);
            if (cached) {
                audioContent = cached;
                audioCacheRef.current.delete(cacheKey);
                appLogger.info(`[TTS] Cache hit for key: ${cacheKey.substring(0, 60)}`);
            } else {
                // Fetch from server
                const result = await generateTtsAction(text, mappedLanguage, gender ?? 'NEUTRAL');
                audioContent = result.audioContent;
                if (result.error) {
                    throw new Error(result.error);
                }
            }

            if (!audioContent) {
                throw new Error('TTS Action returned no audio content.');
            }

            // --- Play the audio and wait until it finishes ---
            if (audioRef.current) {
                const audioSrc = `data:audio/mp3;base64,${audioContent}`;
                audioRef.current.src = audioSrc;
                await audioRef.current.play();
                // Wait for playback to end, be stopped/paused, or error out
                await new Promise<void>((resolve) => {
                    const audio = audioRef.current;
                    if (!audio) { resolve(); return; }
                    const cleanup = () => {
                        audio.removeEventListener('ended', cleanup);
                        audio.removeEventListener('pause', cleanup);
                        audio.removeEventListener('error', cleanup);
                        resolve();
                    };
                    audio.addEventListener('ended', cleanup, { once: true });
                    audio.addEventListener('pause', cleanup, { once: true });
                    audio.addEventListener('error', cleanup, { once: true });
                });
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
    }, [stop, onAudioEnd, mapLanguage]);

    return { ttsState, speak, preload, stop, currentLanguage };
} 