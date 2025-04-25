"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getUserSettings, updateUserSettings } from "@/lib/actions/settingsActions";
import { toast } from "sonner";
import type { Database, Tables, Json } from "@/types/database"; // Ensure this is updated after migration
import type { ActionResult } from '@/lib/actions/types'; // Ensure path is correct

// Debug flag
const DEBUG = true;

// Debug logging function
const debug = (...args: any[]) => {
  if (DEBUG && process.env.NODE_ENV !== 'production') {
    console.warn('[Settings Provider Debug]:', ...args);
  }
};

// Define types
export type FontOption = "default" | "opendyslexic" | "atkinson";

// Define Default Word Colors (using updated defaults from previous step)
export const DEFAULT_WORD_COLORS: Record<string, Record<string, string>> = {
  Noun: { Male: '#a7c7e7', Female: '#fdd8b1', Default: '#d1d1d1' },
  Verb: { Default: '#b2e0b2' },
  Adjective: { Male: '#fdfd96', Female: '#fdfd96', Default: '#fdfd96' },
  Adverb: { Default: '#ffb3ba' },
  Pronoun: { Male: '#b0e0e6', Female: '#b0e0e6', Default: '#b0e0e6' },
  Preposition: { Default: '#e6e6fa' },
  Interjection: { Default: '#fafad2' },
  Other: { Default: '#cccccc' },
};

// --- Updated Settings Interface ---
export interface Settings {
  appLanguage: string;
  cardFont: FontOption;
  showDifficulty: boolean;
  masteryThreshold: number;
  ttsEnabled: boolean;
  removeMasteredCards?: boolean;
  languageDialects: { // Non-nullable
    en: string;
    nl: string;
    fr: string;
    de: string;
    es: string;
    it: string;
  };
  // --- NEW: Replaced single toggle with two ---
  enableBasicColorCoding: boolean;
  enableAdvancedColorCoding: boolean;
  // -----------------------------------------
  wordColorConfig: Record<string, Record<string, string>>; // Non-nullable
}

// DB Type Alias
type DbSettings = Tables<'settings'>; // Assumes types/database.ts generated after migration

interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (updates: Partial<Settings>) => Promise<ActionResult<DbSettings | null>>;
  loading: boolean;
}

// --- Updated Default Settings ---
export const DEFAULT_SETTINGS: Settings = {
  appLanguage: "en",
  cardFont: "default",
  showDifficulty: true,
  masteryThreshold: 3,
  ttsEnabled: true,
  removeMasteredCards: false,
  languageDialects: {
    en: "en-GB", nl: "nl-NL", fr: "fr-FR", de: "de-DE", es: "es-ES", it: "it-IT",
  },
  // --- NEW: Updated defaults for toggles ---
  enableBasicColorCoding: true,    // Basic enabled by default
  enableAdvancedColorCoding: false, // Advanced disabled by default
  // -------------------------------------
  wordColorConfig: DEFAULT_WORD_COLORS,
};

// --- Updated Transformation Function ---
const transformDbSettingsToSettings = (dbSettings: DbSettings | null): Settings => {
    if (!dbSettings) {
        debug('transformDbSettingsToSettings: No DB settings provided, returning default.');
        return { ...DEFAULT_SETTINGS }; // Return a copy
    }
    try {
        debug('transformDbSettingsToSettings: Transforming DB settings:', dbSettings);
        const cardFontValue = dbSettings.card_font as FontOption | null;
        const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');
        const cardFontFinal = isValidFont && cardFontValue ? cardFontValue : DEFAULT_SETTINGS.cardFont;

        const dbDialects = dbSettings.language_dialects as Record<string, string> | null;
        const languageDialectsFinal = { ...(DEFAULT_SETTINGS.languageDialects), ...(dbDialects ?? {}) };

        const dbColorConfig = dbSettings.word_color_config as Record<string, Record<string, string>> | null;
        const wordColorConfigFinal = dbColorConfig ? { ...DEFAULT_WORD_COLORS, ...dbColorConfig } : { ...DEFAULT_WORD_COLORS };

        const transformed: Settings = {
            appLanguage: dbSettings.app_language ?? DEFAULT_SETTINGS.appLanguage,
            languageDialects: languageDialectsFinal,
            ttsEnabled: dbSettings.tts_enabled ?? DEFAULT_SETTINGS.ttsEnabled,
            showDifficulty: dbSettings.show_difficulty ?? DEFAULT_SETTINGS.showDifficulty,
            masteryThreshold: dbSettings.mastery_threshold ?? DEFAULT_SETTINGS.masteryThreshold,
            cardFont: cardFontFinal,
            // --- Map NEW DB Fields ---
            // Use ?? operator with DEFAULT_SETTINGS to handle null from DB correctly
            enableBasicColorCoding: dbSettings.enable_basic_color_coding ?? DEFAULT_SETTINGS.enableBasicColorCoding,
            enableAdvancedColorCoding: dbSettings.enable_advanced_color_coding ?? DEFAULT_SETTINGS.enableAdvancedColorCoding,
            // ------------------------
            wordColorConfig: wordColorConfigFinal,
        };
        debug('transformDbSettingsToSettings: Transformation result:', transformed);
        return transformed;
    } catch (e) {
        console.error("Error transforming DbSettings:", e);
        debug('transformDbSettingsToSettings: Error during transformation, returning default.');
        return { ...DEFAULT_SETTINGS }; // Return default on error
    }
};

// Context Definition (Unchanged)
export const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  updateSettings: async () => ({ data: null, error: "Context not initialized" }),
  loading: true,
});

// SettingsProvider Component (Unchanged core logic, relies on transform)
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  debug('SettingsProvider initializing');
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Settings Effect (Unchanged logic)
  useEffect(() => {
    debug('Settings load effect triggered', { userId: user?.id });
    if (!user) {
      debug('No user, setting settings to null and loading to false');
      setSettings(null);
      setLoading(false);
      return;
    }
    let isMounted = true;
    const loadSettings = async () => {
      debug('Setting loading true');
      if (isMounted) setLoading(true);
      try {
        debug('Loading settings via action for user', user.id);
        const { data: dbSettings, error } = await getUserSettings();
        if (!isMounted) { debug("Component unmounted during settings load"); return; }

        if (error) {
          console.error("Failed to load settings:", error);
          debug('Error loading settings, using defaults', DEFAULT_SETTINGS);
          toast.error("Failed to load settings", { description: error || "Using default settings." });
          setSettings({ ...DEFAULT_SETTINGS });
        } else {
          const finalSettings = transformDbSettingsToSettings(dbSettings); // Handles null/defaults
          debug('Setting user settings state', finalSettings);
          setSettings(finalSettings);
        }
      } catch (unexpectedError) {
        console.error("Unexpected error during settings load:", unexpectedError);
        debug('Unexpected error, using defaults', DEFAULT_SETTINGS);
        toast.error("Error", { description: "An unexpected error occurred while loading settings. Using default values." });
        if (isMounted) setSettings({ ...DEFAULT_SETTINGS });
      } finally {
        debug('Setting loading false');
        if (isMounted) setLoading(false);
      }
    };
    loadSettings();
    return () => { isMounted = false; debug("Settings load effect cleanup"); };
  }, [user]);

  // Update Settings Callback (Unchanged logic - assumes action handles mapping)
  const updateSettings = useCallback(async (
    updates: Partial<Settings>
  ): Promise<ActionResult<DbSettings | null>> => {
    debug('updateSettings called', { current: settings, updates });
    if (!user) {
         debug('Cannot update settings - no user');
         toast.warning("Cannot save settings", { description: "You must be logged in." });
         return { data: null, error: "Not authenticated" };
    }
    if (!settings) {
        debug('Cannot update settings - current settings are null/not loaded');
        toast.warning("Cannot save settings", { description: "Settings not loaded yet." });
        return { data: null, error: "Settings not loaded" };
    }

    const previousSettings = { ...settings };
    debug('Applying optimistic update');
    setSettings(prev => prev ? { ...prev, ...updates } : null);

    try {
      debug('Calling updateUserSettings action with updates:', updates);
      // Pass the object containing the 'updates' key
      const { data, error } = await updateUserSettings({ updates: updates });

      if (error) {
        console.error("Failed to update settings via action:", error);
        debug('Settings action update failed, reverting optimistic update', { error });
        toast.error("Error Saving Settings", { description: error || "Could not save settings." });
        setSettings(previousSettings);
        return { data: null, error: error };
      } else {
        debug('Settings action update successful, optimistic update confirmed', data);
        // OPTIONAL: Re-transform DB data if absolute consistency needed
        // setSettings(transformDbSettingsToSettings(data));
        return { data, error: null };
      }
    } catch (unexpectedError) {
      console.error("Unexpected error during settings action call:", unexpectedError);
      debug('Unexpected settings update error, reverting optimistic update');
      const errorMsg = unexpectedError instanceof Error ? unexpectedError.message : "An unexpected error occurred.";
      toast.error("Error Saving Settings", { description: errorMsg });
      setSettings(previousSettings);
      return { data: null, error: errorMsg };
    }
  }, [settings, user]);

  // Log state changes (unchanged)
  useEffect(() => { debug('Settings state changed', { settings, loading }); }, [settings, loading]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

// useSettings Hook (Unchanged)
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}