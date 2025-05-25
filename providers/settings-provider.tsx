"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
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
import { appLogger, statusLogger } from '@/lib/logger';
// -----------------------------------------


// Debug flag
const DEBUG = true;

// Debug logging function
const debug = (...args: any[]) => {
  if (DEBUG && process.env.NODE_ENV !== 'production') {
    appLogger.info('[Settings Provider Debug]:', ...args); // Use debug instead of warn
  }
};

// Define types
export type ThemePreference = "light" | "dark" | "system";
export type FontOption = "default" | "opendyslexic" | "atkinson";

// --- Updated Settings Interface ---
export interface Settings {
  appLanguage: string;
  cardFont: FontOption;
  showDifficulty: boolean;
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
  wordPaletteConfig: Record<string, Record<string, string>>; // Stores Palette IDs
  colorOnlyNonNative: boolean;
  showDeckProgress: boolean;
  themePreference: ThemePreference;

  studyAlgorithm: 'dedicated-learn' | 'standard-sm2';
  enableDedicatedLearnMode: boolean;
  masteryThreshold: number;
  customLearnRequeueGap: number;
  graduatingIntervalDays: number;
  easyIntervalDays: number;
  relearningStepsMinutes: number[];
  initialLearningStepsMinutes: number[];
  lapsedEfPenalty: number;
  learnAgainPenalty: number;
  learnHardPenalty: number;
  minEasinessFactor: number;
  defaultEasinessFactor: number;

  enableStudyTimer: boolean;
  studyTimerDurationMinutes: number;
  uiLanguage: string;                  // For UI internationalization
  deckListGroupingPreference: string;  // e.g., 'none', 'tag', 'language'
}

// Re-declare DB Type Alias to potentially help TS
type DbSettings = Tables<'settings'>;

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
  ttsEnabled: true,
  removeMasteredCards: false,
  languageDialects: {
    en: "en-GB", nl: "nl-NL", fr: "fr-FR", de: "de-DE", es: "es-ES", it: "it-IT",
  },
  enableBasicColorCoding: true,
  enableAdvancedColorCoding: false,
  wordPaletteConfig: DEFAULT_PALETTE_CONFIG,
  colorOnlyNonNative: true,
  showDeckProgress: true,
  themePreference: 'system',

  // --- NEW Study Algorithm Defaults ---
  studyAlgorithm: 'dedicated-learn',
  enableDedicatedLearnMode: true,
  masteryThreshold: 3,
  customLearnRequeueGap: 3,
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  relearningStepsMinutes: [10, 1440],
  initialLearningStepsMinutes: [1, 10],
  lapsedEfPenalty: 0.2,
  learnAgainPenalty: 0.2,
  learnHardPenalty: 0.05,
  minEasinessFactor: 1.3,
  defaultEasinessFactor: 2.5,

  enableStudyTimer: false,
  studyTimerDurationMinutes: 25,
  uiLanguage: "en",
  deckListGroupingPreference: "none",
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

        // Determine studyAlgorithm based on enable_dedicated_learn_mode for simplicity
        // You might want a dedicated 'study_algorithm' column in the DB later
        const studyAlgorithmFinal = (dbSettings.enable_dedicated_learn_mode ?? DEFAULT_SETTINGS.enableDedicatedLearnMode)
            ? 'dedicated-learn'
            : 'standard-sm2';

        const transformed: Settings = {
            appLanguage: dbSettings.app_language ?? DEFAULT_SETTINGS.appLanguage,
            languageDialects: languageDialectsFinal,
            ttsEnabled: dbSettings.tts_enabled ?? DEFAULT_SETTINGS.ttsEnabled,
            showDifficulty: dbSettings.show_difficulty ?? DEFAULT_SETTINGS.showDifficulty,
            enableStudyTimer: dbSettings.enable_study_timer ?? DEFAULT_SETTINGS.enableStudyTimer,
            studyTimerDurationMinutes: dbSettings.study_timer_duration_minutes ?? DEFAULT_SETTINGS.studyTimerDurationMinutes,
            uiLanguage: dbSettings.ui_language ?? DEFAULT_SETTINGS.uiLanguage,
            deckListGroupingPreference: dbSettings.deck_list_grouping_preference ?? DEFAULT_SETTINGS.deckListGroupingPreference,
            cardFont: cardFontFinal,
            enableBasicColorCoding: dbSettings.enable_basic_color_coding ?? DEFAULT_SETTINGS.enableBasicColorCoding,
            enableAdvancedColorCoding: dbSettings.enable_advanced_color_coding ?? DEFAULT_SETTINGS.enableAdvancedColorCoding,
            wordPaletteConfig: wordPaletteConfigFinal,
            colorOnlyNonNative: dbSettings.color_only_non_native ?? DEFAULT_SETTINGS.colorOnlyNonNative,
            showDeckProgress: dbSettings.show_deck_progress ?? DEFAULT_SETTINGS.showDeckProgress,
            themePreference: (dbSettings.theme_light_dark_mode ?? DEFAULT_SETTINGS.themePreference) as ThemePreference,

            // --- NEW Study Algorithm Mappings ---
            studyAlgorithm: studyAlgorithmFinal,
            enableDedicatedLearnMode: dbSettings.enable_dedicated_learn_mode ?? DEFAULT_SETTINGS.enableDedicatedLearnMode,
            masteryThreshold: dbSettings.mastery_threshold ?? DEFAULT_SETTINGS.masteryThreshold,
            customLearnRequeueGap: dbSettings.custom_learn_requeue_gap ?? DEFAULT_SETTINGS.customLearnRequeueGap,
            graduatingIntervalDays: dbSettings.graduating_interval_days ?? DEFAULT_SETTINGS.graduatingIntervalDays,
            easyIntervalDays: dbSettings.easy_interval_days ?? DEFAULT_SETTINGS.easyIntervalDays,
            // Ensure arrays are handled correctly, provide default if null/invalid
            relearningStepsMinutes: Array.isArray(dbSettings.relearning_steps_minutes) ? dbSettings.relearning_steps_minutes : DEFAULT_SETTINGS.relearningStepsMinutes,
            initialLearningStepsMinutes: Array.isArray(dbSettings.initial_learning_steps_minutes) ? dbSettings.initial_learning_steps_minutes : DEFAULT_SETTINGS.initialLearningStepsMinutes,
            // Ensure numbers are handled correctly
            lapsedEfPenalty: typeof dbSettings.lapsed_ef_penalty === 'number' ? dbSettings.lapsed_ef_penalty : DEFAULT_SETTINGS.lapsedEfPenalty,
            learnAgainPenalty: typeof dbSettings.learn_again_penalty === 'number' ? dbSettings.learn_again_penalty : DEFAULT_SETTINGS.learnAgainPenalty,
            learnHardPenalty: typeof dbSettings.learn_hard_penalty === 'number' ? dbSettings.learn_hard_penalty : DEFAULT_SETTINGS.learnHardPenalty,
            minEasinessFactor: typeof dbSettings.min_easiness_factor === 'number' ? dbSettings.min_easiness_factor : DEFAULT_SETTINGS.minEasinessFactor,
            defaultEasinessFactor: typeof dbSettings.default_easiness_factor === 'number' ? dbSettings.default_easiness_factor : DEFAULT_SETTINGS.defaultEasinessFactor,
        };
        debug('transformDbSettingsToSettings: Transformation result:', transformed);
        return transformed;
    } catch (e) {
        appLogger.error("Error transforming DbSettings:", e);
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
          appLogger.error("Failed to load settings:", error);
          debug('Error loading settings, using defaults', DEFAULT_SETTINGS);
          toast.error("Failed to load settings", { description: error || "Using default settings." });
          setSettings({ ...DEFAULT_SETTINGS });
        } else {
          const finalSettings = transformDbSettingsToSettings(dbSettings); // Uses updated transform
          debug('Setting user settings state', finalSettings);
          setSettings(finalSettings);
        }
      } catch (unexpectedError) {
        appLogger.error("Unexpected error during settings load:", unexpectedError);
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
    debug('updateSettings called with:', updates);
    if (!user) {
      toast.error("Not logged in", { description: "Cannot save settings." });
      return { data: null, error: "User not authenticated" };
    }
    // Prevent full settings object from being passed if only partial update
    const currentNonNullSettings = settings ?? { ...DEFAULT_SETTINGS };
    const newSettingsCandidate = { ...currentNonNullSettings, ...updates };

    // Here, we map only the fields that exist on DbSettings
    // This requires knowing the structure of your 'settings' table
    // Example mapping (adjust to your actual DB schema):
    const dbUpdates: Partial<DbSettings> = {
        app_language: newSettingsCandidate.appLanguage,
        card_font: newSettingsCandidate.cardFont,
        show_difficulty: newSettingsCandidate.showDifficulty,
        tts_enabled: newSettingsCandidate.ttsEnabled,
        language_dialects: newSettingsCandidate.languageDialects as Json, // Cast to Json
        enable_basic_color_coding: newSettingsCandidate.enableBasicColorCoding,
        enable_advanced_color_coding: newSettingsCandidate.enableAdvancedColorCoding,
        word_palette_config: newSettingsCandidate.wordPaletteConfig as Json, // Cast to Json
        color_only_non_native: newSettingsCandidate.colorOnlyNonNative,
        show_deck_progress: newSettingsCandidate.showDeckProgress,
        theme_light_dark_mode: newSettingsCandidate.themePreference,

        enable_dedicated_learn_mode: newSettingsCandidate.enableDedicatedLearnMode,
        mastery_threshold: newSettingsCandidate.masteryThreshold,
        custom_learn_requeue_gap: newSettingsCandidate.customLearnRequeueGap,
        graduating_interval_days: newSettingsCandidate.graduatingIntervalDays,
        easy_interval_days: newSettingsCandidate.easyIntervalDays,
        relearning_steps_minutes: newSettingsCandidate.relearningStepsMinutes as unknown as Json, // Cast for DB
        initial_learning_steps_minutes: newSettingsCandidate.initialLearningStepsMinutes as unknown as Json, // Cast for DB
        lapsed_ef_penalty: newSettingsCandidate.lapsedEfPenalty,
        learn_again_penalty: newSettingsCandidate.learnAgainPenalty,
        learn_hard_penalty: newSettingsCandidate.learnHardPenalty,
        min_easiness_factor: newSettingsCandidate.minEasinessFactor,
        default_easiness_factor: newSettingsCandidate.defaultEasinessFactor,

        enable_study_timer: newSettingsCandidate.enableStudyTimer,
        study_timer_duration_minutes: newSettingsCandidate.studyTimerDurationMinutes,
        ui_language: newSettingsCandidate.uiLanguage,
        deck_list_grouping_preference: newSettingsCandidate.deckListGroupingPreference,
    };

    // Pass dbUpdates inside an object with the key 'updates'
    const { data: updatedDbSettings, error } = await updateUserSettings({ updates: dbUpdates });
    if (error) {
      toast.error("Failed to save settings", { description: error });
      return { data: null, error };
    }
    if (updatedDbSettings) {
        const finalSettings = transformDbSettingsToSettings(updatedDbSettings);
        setSettings(finalSettings);
        toast.success("Settings saved!");
        return { data: updatedDbSettings, error: null };
    }
    return { data: null, error: "Failed to update settings, no data returned." };
  }, [user, settings]); // Added settings to dependency array of useCallback

  // Memoize the context value
  const contextValue = useMemo(() => ({
    settings,
    updateSettings,
    loading
  }), [settings, updateSettings, loading]);

  debug('SettingsProvider rendering with loading:', loading, 'and settings:', settings);
  return (
    <SettingsContext.Provider value={contextValue}>
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