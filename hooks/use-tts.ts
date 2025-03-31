"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSettings } from '@/providers/settings-provider';
// --- Import the new action ---
import { generateTtsAction } from '@/lib/actions/ttsActions';

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
            audioRef.current.onerror = (e) => {
                logTTSError('Audio playback error', (e.target as HTMLAudioElement)?.error);
                setTtsState('error');
                 onAudioEnd?.(); // Also call on end for errors? Consider desired behavior.
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

    // --- Speak Function (Modified to use Server Action) ---
    const speak = useCallback(async (text: string, languageCode: string) => {
        if (!text || !languageCode) {
            logTTSError('Missing text or language code for TTS.');
            return;
        }
        // Stop any currently playing audio before starting new request
        stop();

        console.log(`[TTS Hook]: Requesting speech for text "${text.substring(0,30)}...", lang: ${languageCode}`);
        setTtsState('loading');
        setCurrentLanguage(languageCode); // Store the language being spoken

        try {
            // --- Call the Server Action ---
            const { audioContent, error: ttsError } = await generateTtsAction(
                text,
                languageCode
                // TODO: Add gender/voice selection based on settings if needed later
            );

            if (ttsError || !audioContent) {
                throw new Error(ttsError || 'TTS Action returned no audio content.');
            }

            // --- Play the audio --- 
            if (audioRef.current) {
                const audioSrc = `data:audio/mp3;base64,${audioContent}`;
                audioRef.current.src = audioSrc;
                await audioRef.current.play();
                // State updates (playing/idle/error) are handled by the audio element's event listeners
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
    }, [settings, stop, onAudioEnd]); // Include stop and onAudioEnd

    return { ttsState, speak, stop, currentLanguage };
} 