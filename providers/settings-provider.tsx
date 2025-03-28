"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import { detectSystemLanguage } from "@/lib/utils";
import { fetchSettings, updateSettings as updateSettingsService } from "@/lib/settingsService";

// Define a type for settings
export interface Settings {
  id: string;
  userId: string;
  appLanguage: string;
  ttsEnabled: boolean;
  showDifficulty: boolean;
  masteryThreshold: number;
  languageDialects: {
    en: string;
    nl: string;
    fr: string;
    de: string;
    es: string;
    it: string;
  };
}

// Default settings function returns default settings using system language and a random id.
const DEFAULT_SETTINGS = (userId: string): Settings => ({
  id: crypto.randomUUID(),
  userId,
  appLanguage: detectSystemLanguage(),
  ttsEnabled: true,
  showDifficulty: true,
  masteryThreshold: 3,
  languageDialects: {
    en: 'en-GB',  // Default to UK English
    nl: 'nl-NL',  // Default to Netherlands Dutch
    fr: 'fr-FR',  // Default to France French
    de: 'de-DE',  // Default to Germany German
    es: 'es-ES',  // Default to Spain Spanish
    it: 'it-IT',  // Default to Italy Italian
  },
});

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const fetchedSettings = await fetchSettings(supabase, user.id);
        if (fetchedSettings) {
          setSettings(fetchedSettings);
        } else {
          // Fallback to default settings if none are found
          setSettings(DEFAULT_SETTINGS(user.id));
        }
      } catch (err: any) {
        console.error("Error in settings provider:", err);
        setError(err.message || "Error loading settings");
        setSettings(DEFAULT_SETTINGS(user.id));
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user, supabase]);

  const saveSettings = async (newSettings: Partial<Settings>) => {
    if (!settings || !user) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await updateSettingsService(supabase, user.id, updated);
    } catch (err: any) {
      console.error("Failed to update settings:", err);
      setError(err.message || "Error updating settings");
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        error,
        updateSettings: saveSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// Custom hook to use the settings context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
} 