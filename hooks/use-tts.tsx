"use client"

import { useState, useEffect, useCallback } from "react"
import { useSettings } from "@/hooks/use-settings"

// Language code mapping
const LANGUAGE_CODES = {
  english: ["en", "en-US", "en-GB", "en-AU"],
  dutch: ["nl", "nl-NL", "nl-BE"],
  french: ["fr", "fr-FR", "fr-CA", "fr-BE"],
}

export function useTTS() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [language, setLanguage] = useState<string>("english")
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()

  // Initialize available voices
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setLoading(false)
        return
      }

      const availableVoices = window.speechSynthesis.getVoices()
      if (availableVoices.length > 0) {
        console.log(
          "Available voices:",
          availableVoices.map((v) => `${v.name} (${v.lang})`),
        )
        setVoices(availableVoices)
        setLoading(false)
      }
    }

    // Chrome loads voices asynchronously
    if (typeof window !== "undefined" && window.speechSynthesis) {
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [])

  // Set appropriate voice when language changes or settings load
  useEffect(() => {
    if (voices.length === 0 || !settings) return

    const preferredVoiceUri = settings.preferredVoices?.[language as keyof typeof settings.preferredVoices]

    if (preferredVoiceUri) {
      // Try to use the preferred voice from settings
      const preferredVoice = voices.find((v) => v.voiceURI === preferredVoiceUri)
      if (preferredVoice) {
        console.log(`Using preferred voice for ${language}: ${preferredVoice.name}`)
        setSelectedVoice(preferredVoice)
        return
      }
    }

    // Fallback to language-based selection
    const langCodes = LANGUAGE_CODES[language as keyof typeof LANGUAGE_CODES] || LANGUAGE_CODES.english

    // Try to find a voice that matches one of the language codes
    let foundVoice = null

    // First try to find a voice that starts with the exact language code
    for (const code of langCodes) {
      foundVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(code.toLowerCase()))
      if (foundVoice) break
    }

    // If no exact match, try to find a voice that contains the language code
    if (!foundVoice) {
      for (const code of langCodes) {
        foundVoice = voices.find((voice) => voice.lang.toLowerCase().includes(code.toLowerCase().split("-")[0]))
        if (foundVoice) break
      }
    }

    // If still no match, use the first voice or keep the current one
    if (!foundVoice && voices.length > 0) {
      foundVoice = voices[0]
    }

    if (foundVoice) {
      console.log(`Selected voice for ${language}: ${foundVoice.name} (${foundVoice.lang})`)
      setSelectedVoice(foundVoice)
    }
  }, [voices, language, settings])

  // Speak text using the selected voice
  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return

      // Cancel any ongoing speech
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)

      if (selectedVoice) {
        utterance.voice = selectedVoice

        // Set language explicitly to match the voice
        utterance.lang = selectedVoice.lang

        // Adjust speech parameters based on language
        if (language === "dutch") {
          utterance.rate = 0.9 // Slightly slower for Dutch
        } else if (language === "french") {
          utterance.rate = 0.9 // Slightly slower for French
          utterance.pitch = 1.1 // Slightly higher pitch for French
        }
      }

      console.log(`Speaking with voice: ${selectedVoice?.name || "default"}, language: ${utterance.lang}`)
      window.speechSynthesis.speak(utterance)
    },
    [selectedVoice, language],
  )

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    speak,
    setLanguage,
    loading,
  }
}

