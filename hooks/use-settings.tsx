"use client"

import { useState, useEffect, useCallback } from "react"
import { useSupabase } from "@/hooks/use-supabase"
import { useAuth } from "@/hooks/use-auth"

export interface Settings {
  id?: string
  userId: string
  appLanguage: string
  preferredVoices: {
    english: string | null
    dutch: string | null
    french: string | null
  }
  createdAt?: string
  updatedAt?: string
}

// Detect system language
const detectSystemLanguage = (): string => {
  if (typeof window === "undefined") return "en"

  const browserLang = navigator.language.toLowerCase()

  if (browserLang.startsWith("nl")) return "nl"
  if (browserLang.startsWith("fr")) return "fr"
  return "en"
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const { supabase } = useSupabase()
  const { user } = useAuth()

  // Load settings from Supabase or localStorage
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Try to get settings from Supabase or localStorage
        const { data, error } = await supabase.from("settings").select("*").eq("user_id", user.id).single()

        if (error && error.code !== "PGRST116") {
          // PGRST116 is "no rows returned" error
          console.error("Error fetching settings:", error)
        }

        if (data) {
          // Convert from snake_case to camelCase
          setSettings({
            id: data.id,
            userId: data.user_id,
            appLanguage: data.app_language,
            preferredVoices: data.preferred_voices,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          })
        } else {
          // Create default settings if none exist
          const systemLanguage = detectSystemLanguage()
          const defaultSettings: Omit<Settings, "id" | "createdAt" | "updatedAt"> = {
            userId: user.id,
            appLanguage: systemLanguage,
            preferredVoices: {
              english: null,
              dutch: null,
              french: null,
            },
          }

          const { data: newSettings, error: createError } = await supabase
            .from("settings")
            .insert([
              {
                user_id: defaultSettings.userId,
                app_language: defaultSettings.appLanguage,
                preferred_voices: defaultSettings.preferredVoices,
              },
            ])
            .select()
            .single()

          if (createError) {
            console.error("Error creating settings:", createError)
          }

          if (newSettings) {
            setSettings({
              id: newSettings.id,
              userId: newSettings.user_id,
              appLanguage: newSettings.app_language,
              preferredVoices: newSettings.preferred_voices,
              createdAt: newSettings.created_at,
              updatedAt: newSettings.updated_at,
            })
          } else {
            // If we couldn't create settings in Supabase, use the default ones
            setSettings({
              id: crypto.randomUUID(),
              ...defaultSettings,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
        }
      } catch (error) {
        console.error("Error in settings hook:", error)

        // Fallback to default settings
        const systemLanguage = detectSystemLanguage()
        setSettings({
          id: crypto.randomUUID(),
          userId: user.id,
          appLanguage: systemLanguage,
          preferredVoices: {
            english: null,
            dutch: null,
            french: null,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [supabase, user])

  // Update settings
  const updateSettings = useCallback(
    async (newSettings: Partial<Settings>) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      try {
        if (settings?.id) {
          const { error } = await supabase
            .from("settings")
            .update({
              app_language: newSettings.appLanguage,
              preferred_voices: newSettings.preferredVoices,
              updated_at: new Date().toISOString(),
            })
            .eq("id", settings.id)

          if (error) {
            console.error("Error updating settings:", error)
          }
        }

        // Update local state regardless of Supabase success
        setSettings((prev) => {
          if (!prev) return null
          return {
            ...prev,
            ...newSettings,
            updatedAt: new Date().toISOString(),
          }
        })

        return true
      } catch (error) {
        console.error("Error updating settings:", error)

        // Still update local state even if Supabase fails
        setSettings((prev) => {
          if (!prev) return null
          return {
            ...prev,
            ...newSettings,
            updatedAt: new Date().toISOString(),
          }
        })

        return true
      }
    },
    [supabase, user, settings],
  )

  return {
    settings,
    loading,
    updateSettings,
  }
}

