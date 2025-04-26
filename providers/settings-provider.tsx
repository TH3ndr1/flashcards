"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getUserSettings, updateUserSettings } from "@/lib/actions/settingsActions";
import { toast } from "sonner";
import type { Database, Tables, Json } from "@/types/database"; // Ensure this is updated
import type { ActionResult } from '@/lib/actions/types'; // Ensure path is correct
// --- Import Palette types and defaults ---
import {
    DEFAULT_PALETTE_CONFIG,
    // DEFAULT_WORD_COLORS // No longer needed here if palettes cover defaults
} from "@/lib/palettes"; // Adjust path if needed
// -----------------------------------------


// Debug flag
const DEBUG = true;

// Debug logging function
const debug = (...args: any[]) => {
  if (DEBUG && process.env.NODE_ENV !== 'production') {
    console.debug('[Settings Provider Debug]:', ...args); // Use debug instead of warn
  }
};

// Define types
export type FontOption = "default" | "opendyslexic" | "atkinson";

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
  enableBasicColorCoding: boolean;
  enableAdvancedColorCoding: boolean;
  // --- Changed from wordColorConfig to wordPaletteConfig ---
  wordPaletteConfig: Record<string, Record<string, string>>; // Stores Palette IDs
  // ---------------------------------------------------------
}

// DB Type Alias
type DbSettings = Tables<'settings'>; // Assumes types/database.ts includes new columns

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
  enableBasicColorCoding: true,
  enableAdvancedColorCoding: false,
  // --- Use imported palette defaults ---
  wordPaletteConfig: DEFAULT_PALETTE_CONFIG,
  // ------------------------------------
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

        // --- Handle Palette Config ---
        // Read the new snake_case column from the DB type
        const dbPaletteConfig = dbSettings.word_palette_config as Record<string, Record<string, string>> | null;
        // Merge DB config over the imported defaults
        const wordPaletteConfigFinal = dbPaletteConfig ? { ...DEFAULT_PALETTE_CONFIG, ...dbPaletteConfig } : { ...DEFAULT_PALETTE_CONFIG };
        // --------------------------

        const transformed: Settings = {
            appLanguage: dbSettings.app_language ?? DEFAULT_SETTINGS.appLanguage,
            languageDialects: languageDialectsFinal,
            ttsEnabled: dbSettings.tts_enabled ?? DEFAULT_SETTINGS.ttsEnabled,
            showDifficulty: dbSettings.show_difficulty ?? DEFAULT_SETTINGS.showDifficulty,
            masteryThreshold: dbSettings.mastery_threshold ?? DEFAULT_SETTINGS.masteryThreshold,
            cardFont: cardFontFinal,
            enableBasicColorCoding: dbSettings.enable_basic_color_coding ?? DEFAULT_SETTINGS.enableBasicColorCoding,
            enableAdvancedColorCoding: dbSettings.enable_advanced_color_coding ?? DEFAULT_SETTINGS.enableAdvancedColorCoding,
            // --- Assign transformed palette config ---
            wordPaletteConfig: wordPaletteConfigFinal,
            // --------------------------------------
        };
        debug('transformDbSettingsToSettings: Transformation result:', transformed);
        return transformed;
    } catch (e) {
        console.error("Error transforming DbSettings:", e);
        debug('transformDbSettingsToSettings: Error during transformation, returning default.');
        return { ...DEFAULT_SETTINGS }; // Return copy on error
    }
};

// Context Definition (Unchanged)
export const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  updateSettings: async () => ({ data: null, error: "Context not initialized" }),
  loading: true,
});

// SettingsProvider Component (Logic unchanged, uses updated types/defaults)
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  debug('SettingsProvider initializing');
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Settings Effect (Unchanged)
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
          const finalSettings = transformDbSettingsToSettings(dbSettings); // Uses updated transform
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

  // Update Settings Callback (Unchanged)
  const updateSettings = useCallback(async (
    updates: Partial<Settings> // Accepts Partial<Settings> with wordPaletteConfig
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
      // Action needs to handle mapping wordPaletteConfig -> word_palette_config
      const { data, error } = await updateUserSettings({ updates: updates });

      if (error) {
        console.error("Failed to update settings via action:", error);
        debug('Settings action update failed, reverting optimistic update', { error });
        toast.error("Error Saving Settings", { description: error || "Could not save settings." });
        setSettings(previousSettings);
        return { data: null, error: error };
      } else {
        debug('Settings action update successful, optimistic update confirmed', data);
        // OPTIONAL: Re-transform DB data if needed
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
  }, [settings, user]); // Dependencies

  // Log state changes (Unchanged)
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