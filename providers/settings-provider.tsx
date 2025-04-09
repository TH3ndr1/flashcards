"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { detectSystemLanguage } from "@/lib/utils";
import { fetchSettingsAction, updateSettingsAction } from "@/lib/actions/settingsActions";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";
import type { DbSettings } from "@/types/database";

// Debug flag
const DEBUG = true;

// Debug logging function
const debug = (...args: any[]) => {
  // Only log if DEBUG is true AND not in production environment
  if (DEBUG && process.env.NODE_ENV !== 'production') {
    console.warn('[Settings Debug]:', ...args);
  }
};

// Define a type for available fonts
export type FontOption = "default" | "opendyslexic" | "atkinson";

// Define a type for settings
export interface Settings {
  appLanguage: string;
  cardFont: FontOption;
  showDifficulty: boolean;
  masteryThreshold: number;
  ttsEnabled: boolean;
  removeMasteredCards?: boolean;
  srs_algorithm: 'sm2' | 'fsrs';
  languageDialects: {
    en: string;
    nl: string;
    fr: string;
    de: string;
    es: string;
    it: string;
  };
}

interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (updates: Partial<Settings>) => Promise<ActionResult<DbSettings | null>>;
  loading: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  appLanguage: "en",
  cardFont: "default",
  showDifficulty: true,
  masteryThreshold: 3,
  ttsEnabled: true,
  removeMasteredCards: false,
  srs_algorithm: 'sm2',
  languageDialects: {
    en: "en-GB",
    nl: "nl-NL",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    it: "it-IT",
  },
};

// Helper to transform DbSettings (snake_case) to Settings (camelCase, frontend type)
const transformDbSettingsToSettings = (dbSettings: DbSettings | null): Settings | null => {
    if (!dbSettings) return null;
    try {
        const cardFontValue = dbSettings.card_font as FontOption | null;
        const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');
        const cardFontFinal = isValidFont && cardFontValue ? cardFontValue : 'default';
        const srsAlgoValue = dbSettings.srs_algorithm === 'fsrs' ? 'fsrs' : 'sm2';

        // Assuming DEFAULT_DIALECTS exists
        const DEFAULT_DIALECTS = { en:'', nl:'', fr:'', de:'', es:'', it:'' };

        return {
            appLanguage: dbSettings.app_language ?? 'en',
            languageDialects: { ...DEFAULT_DIALECTS, ...(dbSettings.language_dialects as Record<string, string> || {}) },
            ttsEnabled: dbSettings.tts_enabled ?? true,
            showDifficulty: dbSettings.show_difficulty ?? true,
            masteryThreshold: dbSettings.mastery_threshold ?? 3, // DEFAULT_MASTERY_THRESHOLD
            cardFont: cardFontFinal,
            srs_algorithm: srsAlgoValue,
            // removeMasteredCards: dbSettings.remove_mastered_cards ?? false, // If field exists
        };
    } catch (e) {
        console.error("Error transforming DbSettings:", e);
        return null; // Return null or default on transform error
    }
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  updateSettings: async () => ({ data: null, error: new Error("Provider not initialized") }),
  loading: true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  debug('SettingsProvider initializing');

  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Log initial mount
  useEffect(() => {
    debug('SettingsProvider mounted');
    return () => debug('SettingsProvider unmounting');
  }, []);

  // Fetch settings using the Action
  useEffect(() => {
    debug('Settings load effect triggered', { userId: user?.id });
    
    if (!user) {
        debug('No user, skipping settings load');
        setSettings(null); 
        setLoading(false); 
        return;
    }

    const loadSettings = async () => {
      setLoading(true); 
      try {
        debug('Loading settings via action for user', user.id);
        // Call fetchSettingsAction
        const { data: dbSettings, error } = await fetchSettingsAction(); 

        if (error) {
          console.error("Failed to load settings:", error);
          debug('Error loading settings, using defaults', DEFAULT_SETTINGS);
          toast.error("Failed to load settings", { description: error.message || "Using default settings." });
          setSettings(DEFAULT_SETTINGS);
        } else {
          const transformed = transformDbSettingsToSettings(dbSettings);
          if (transformed) {
               debug('Setting user settings from action', transformed);
               setSettings(transformed);
          } else {
               debug('No settings found or transform failed, using defaults', DEFAULT_SETTINGS);
               setSettings(DEFAULT_SETTINGS);
          }
        }
      } catch (unexpectedError) {
        console.error("Unexpected error during settings load:", unexpectedError);
        debug('Unexpected error, using defaults', DEFAULT_SETTINGS);
         toast.error("Error", {
          description: "An unexpected error occurred while loading settings. Using default values.",
        });
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]); // Dependency is just user now

  // Update settings using the Action
  const updateSettings = useCallback(async (
    updates: Partial<Settings>
  ): Promise<ActionResult<DbSettings | null>> => {
    debug('Updating settings via action', { current: settings, updates });
    if (!settings || !user) {
      debug('Cannot update settings - missing settings or user');
      const error = new Error("Cannot save settings: user or current settings missing.");
      toast.warning("Cannot save settings", { description: error.message });
      return { data: null, error };
    }
    
    // Optimistic update
    const previousSettings = settings;
    setSettings(prev => prev ? { ...prev, ...updates } : null);
    
    try {
      // Call the server action
      const result = await updateSettingsAction(updates);

      if (result.error) {
        console.error("Failed to update settings via action:", result.error);
        debug('Settings action update failed', { error: result.error });
        toast.error("Error Saving Settings", { description: result.error.message || "Could not save settings." });
        // Revert optimistic update on error
        setSettings(previousSettings); 
        return { data: null, error: result.error }; // Return error from action
      } else {
        debug('Settings action update successful', result.data);
        // Optimistic update already applied, just return success
        // Optionally transform result.data back to Settings type if needed
        return { data: result.data, error: null }; 
      }
    } catch (unexpectedError) {
      console.error("Unexpected error during settings action call:", unexpectedError);
      debug('Unexpected settings update error');
      const error = unexpectedError instanceof Error ? unexpectedError : new Error("An unexpected error occurred.");
      toast.error("Error Saving Settings", { description: error.message });
      // Revert optimistic update
      setSettings(previousSettings);
      return { data: null, error };
    }
  }, [settings, user]); // Dependencies are settings and user

  // Log settings changes
  useEffect(() => {
    debug('Settings state changed', { settings, loading });
  }, [settings, loading]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
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