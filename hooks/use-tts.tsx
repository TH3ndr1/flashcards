"use client"

import { useState, useCallback } from "react"
import { useSettings } from "@/hooks/use-settings"

// Language code mapping for Google Cloud TTS
const LANGUAGE_CODES = {
  english: "en-US",
  dutch: "nl-NL",
  french: "fr-FR",
}

export function useTTS() {
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState<string>("english")
  const { settings } = useSettings()

  // Speak text using Google Cloud TTS
  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return

    try {
      setLoading(true)

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language,
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
  }, [language])

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

