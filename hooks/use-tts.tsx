"use client"

import { useState, useCallback } from "react"
import { useSettings } from "@/hooks/use-settings"
import type { Settings } from "@/hooks/use-settings"

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

export function useTTS() {
  const [loading, setLoading] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState<string>("en")
  const { settings } = useSettings()

  // Speak text using Google Cloud TTS
  const speak = useCallback(async (text: string, language?: string) => {
    // Check if TTS is enabled in settings, return early if disabled
    if (!settings?.ttsEnabled) {
      console.log('TTS is disabled in settings');
      return;
    }

    if (!text.trim()) return

    try {
      setLoading(true)
      // Use provided language or fall back to current language
      const langToUse = language?.toLowerCase() || currentLanguage
      // Get the base language code (en, nl, fr, etc.)
      const baseLanguage = langToUse.split('-')[0] as keyof Settings['languageDialects']
      // Get the dialect from settings if available, otherwise use default mapping
      const mappedLanguage = settings?.languageDialects?.[baseLanguage] || 
                            LANGUAGE_CODES[langToUse] || 
                            "en-GB"
      console.log('TTS Debug:', {
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
        throw new Error('Failed to generate speech')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      // Clean up the URL after the audio has played
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        setLoading(false)
      }

      // Handle errors during playback
      audio.onerror = (error) => {
        console.error('Audio playback error:', error)
        URL.revokeObjectURL(audioUrl)
        setLoading(false)
      }

      await audio.play()
    } catch (error) {
      console.error('TTS Error:', error)
      setLoading(false)
    }
  }, [currentLanguage, settings])

  const setLanguage = useCallback((lang: string) => {
    console.log('Setting TTS language to:', lang)
    setCurrentLanguage(lang.toLowerCase())
  }, [])

  return {
    speak,
    setLanguage,
    loading,
    // These are kept for compatibility with existing code
    voices: [],
    selectedVoice: null,
    setSelectedVoice: () => {},
  }
}

