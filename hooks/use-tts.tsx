"use client"

import { useState, useCallback } from "react"
import { useSettings } from "@/providers/settings-provider"
import type { Settings } from "@/providers/settings-provider"

// Language code mapping for Google Cloud TTS
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
}

// Conditional logging helpers
const logTTS = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[TTS Hook]:', ...args);
    }
};
const logTTSError = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error('[TTS Hook Error]:', ...args);
    }
};

export function useTTS() {
  const [loading, setLoading] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState<string>("en")
  const { settings } = useSettings()

  // Speak text using Google Cloud TTS
  const speak = useCallback(async (text: string, language?: string): Promise<{ success: boolean; error: Error | null }> => {
    // Check if TTS is enabled in settings, return early if disabled
    if (!settings?.ttsEnabled) {
      logTTS('TTS is disabled in settings');
      return { success: false, error: new Error("TTS is disabled in settings") };
    }

    if (!text.trim()) {
       logTTS('Speak called with empty text.');
       return { success: true, error: null }; // Not an error, just nothing to do
    }

    let audio: HTMLAudioElement | null = null;
    let audioUrl: string | null = null;

    try {
      setLoading(true)
      const langToUse = language?.toLowerCase() || currentLanguage
      const baseLanguage = langToUse.split('-')[0] as keyof Settings['languageDialects']
      const mappedLanguage = settings?.languageDialects?.[baseLanguage] || 
                            LANGUAGE_CODES[langToUse] || 
                            "en-GB"
      logTTS('TTS Debug:', {
        providedLanguage: language,
        currentLanguage,
        baseLanguage,
        settingsDialects: settings?.languageDialects,
        selectedDialect: settings?.languageDialects?.[baseLanguage],
        fallbackDialect: LANGUAGE_CODES[langToUse],
        finalMappedLanguage: mappedLanguage
      })

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language: mappedLanguage,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text(); // Attempt to get error details
        logTTSError(`Failed to generate speech. Status: ${response.status}`, errorBody);
        throw new Error(`Failed to generate speech. Status: ${response.status}`);
      }

      const audioBlob = await response.blob()
      audioUrl = URL.createObjectURL(audioBlob)
      audio = new Audio(audioUrl)

      return new Promise((resolve) => {
         // Clean up the URL after the audio has played
         audio!.onended = () => {
           logTTS("Audio playback finished.");
           if (audioUrl) URL.revokeObjectURL(audioUrl);
           setLoading(false);
           resolve({ success: true, error: null });
         };
   
         // Handle errors during playback
         audio!.onerror = (event) => {
           const error = audio?.error || event;
           logTTSError('Audio playback error:', error);
           if (audioUrl) URL.revokeObjectURL(audioUrl);
           setLoading(false);
           resolve({ success: false, error: new Error(`Audio playback failed: ${error?.message || String(error)}`) });
         };
         
         // Start playback
         logTTS("Starting audio playback...");
         audio!.play().catch(playError => { // Catch potential immediate play errors
             logTTSError("Error initiating audio playback:", playError);
             if (audioUrl) URL.revokeObjectURL(audioUrl);
             setLoading(false);
             resolve({ success: false, error: playError instanceof Error ? playError : new Error("Failed to start audio playback") });
         });
      });

    } catch (error) {
      logTTSError('TTS Error (fetch or setup):', error);
      if (audioUrl) URL.revokeObjectURL(audioUrl); // Cleanup if URL was created before error
      setLoading(false);
      return { success: false, error: error instanceof Error ? error : new Error("An unexpected error occurred during TTS processing") };
    }
  }, [currentLanguage, settings, logTTS, logTTSError]) // Added loggers

  const setLanguage = useCallback((lang: string) => {
    logTTS('Setting TTS language to:', lang)
    setCurrentLanguage(lang.toLowerCase())
  }, [logTTS]) // Added logger

  return {
    speak, // Now returns Promise<{ success, error }>
    setLanguage,
    loading,
    // These are kept for compatibility with existing code
    voices: [],
    selectedVoice: null,
    setSelectedVoice: () => {},
  }
}

