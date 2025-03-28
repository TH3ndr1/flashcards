"use client"

import { useState, useCallback } from "react"
import { useSettings } from "@/hooks/use-settings"

// Language code mapping for Google Cloud TTS
const LANGUAGE_CODES: Record<string, string> = {
  // ISO codes
  en: "en-US",
  nl: "nl-NL",
  fr: "fr-FR",
  // Full names
  english: "en-US",
  dutch: "nl-BE",
  french: "fr-FR",
}

export function useTTS() {
  const [loading, setLoading] = useState(false)
  const [currentLanguage, setCurrentLanguage] = useState<string>("en")
  const { settings } = useSettings()

  // Speak text using Google Cloud TTS
  const speak = useCallback(async (text: string, language?: string) => {
    if (!text.trim()) return

    try {
      setLoading(true)
      // Use provided language or fall back to current language
      const langToUse = language?.toLowerCase() || currentLanguage
      const mappedLanguage = LANGUAGE_CODES[langToUse] || "en-US"
      console.log('TTS speaking in language:', langToUse, '(mapped to:', mappedLanguage, ')')

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
  }, [])

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

