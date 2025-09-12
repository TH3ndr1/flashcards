"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
// Alias the imported server action to avoid naming conflict
import { updateUserSettings as updateUserSettingsServerAction, getUserSettings } from "@/lib/actions/settingsActions";
import { toast } from "sonner";
import type { Tables, Json, TablesUpdate } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';
import { DEFAULT_PALETTE_CONFIG } from "@/lib/palettes";
import { appLogger } from '@/lib/logger'; // Removed statusLogger as it wasn't used here

const DEBUG = true;
const debug = (...args: unknown[]) => {
  if (DEBUG && process.env.NODE_ENV !== 'production') {
    appLogger.info('[Settings Provider Debug]:', ...args);
  }
};

export type ThemePreference = "light" | "dark" | "system";
export type FontOption = "default" | "opendyslexic" | "atkinson";

export interface Settings {
  appLanguage: string;
  cardFont: FontOption;
  showDifficulty: boolean;
  ttsEnabled: boolean;
  removeMasteredCards?: boolean;
  languageDialects: {
    en: string; nl: string; fr: string; de: string; es: string; it: string;
  };
  enableBasicColorCoding: boolean;
  enableAdvancedColorCoding: boolean;
  wordPaletteConfig: Record<string, Record<string, string>>;
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
  uiLanguage: string;
  deckListGroupingMode: 'none' | 'language' | 'tag_id';
  deckListActiveTagGroupId: string | null; // Store UUID as string, can be null
  deckListSortField: 'name' | 'created_at';
  deckListSortDirection: 'asc' | 'desc';

  // --- New PDF Export Settings ---
  enablePdfWordColorCoding: boolean;
  pdfCardContentFontSize: number;
  showCardStatusIconsInPdf: boolean;

  // --- Kid-friendly SRS tuning ---
  firstReviewBaseDays: number; // Base for first review interval (level 1 -> 2)
  earlyReviewMaxDays: number;  // Cap for intervals while srs_level <= 3
}

type DbSettings = Tables<'settings'>;
type DbSettingsUpdate = TablesUpdate<'settings'>; // For partial updates

interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (updates: Partial<Settings>) => Promise<ActionResult<DbSettings | null>>;
  loading: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  appLanguage: "en",
  cardFont: "default",
  showDifficulty: true,
  ttsEnabled: true,
  removeMasteredCards: false,
  languageDialects: { en: "en-GB", nl: "nl-NL", fr: "fr-FR", de: "de-DE", es: "es-ES", it: "it-IT" },
  enableBasicColorCoding: true,
  enableAdvancedColorCoding: false,
  wordPaletteConfig: DEFAULT_PALETTE_CONFIG,
  colorOnlyNonNative: true,
  showDeckProgress: true,
  themePreference: 'system',
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
  minEasinessFactor: 1.5,
  defaultEasinessFactor: 2.3,
  enableStudyTimer: false,
  studyTimerDurationMinutes: 25,
  uiLanguage: 'en',
  deckListGroupingMode: 'none',
  deckListActiveTagGroupId: null, // Default to null as no tag is pre-selected
  deckListSortField: 'name',
  deckListSortDirection: 'asc',

  // --- Defaults for New PDF Export Settings ---
  enablePdfWordColorCoding: true,
  pdfCardContentFontSize: 10,
  showCardStatusIconsInPdf: true,

  // --- Kid-friendly SRS tuning defaults ---
  firstReviewBaseDays: 4,
  earlyReviewMaxDays: 14,
};

const transformSettingsToDbUpdates = (updates: Partial<Settings>): DbSettingsUpdate => {
  const dbUpdates: DbSettingsUpdate = {};

  if (updates.appLanguage !== undefined) dbUpdates.app_language = updates.appLanguage;
  if (updates.cardFont !== undefined) dbUpdates.card_font = updates.cardFont;
  if (updates.showDifficulty !== undefined) dbUpdates.show_difficulty = updates.showDifficulty;
  if (updates.ttsEnabled !== undefined) dbUpdates.tts_enabled = updates.ttsEnabled;
  // removeMasteredCards is not in DbSettings based on current schema, assuming it's a client-only or derived setting.
  // If it were to be saved, a corresponding snake_case field (e.g., remove_mastered_cards) would be needed.
  if (updates.languageDialects !== undefined) dbUpdates.language_dialects = updates.languageDialects as Json;
  if (updates.enableBasicColorCoding !== undefined) dbUpdates.enable_basic_color_coding = updates.enableBasicColorCoding;
  if (updates.enableAdvancedColorCoding !== undefined) dbUpdates.enable_advanced_color_coding = updates.enableAdvancedColorCoding;
  if (updates.wordPaletteConfig !== undefined) dbUpdates.word_palette_config = updates.wordPaletteConfig as Json;
  if (updates.colorOnlyNonNative !== undefined) dbUpdates.color_only_non_native = updates.colorOnlyNonNative;
  if (updates.showDeckProgress !== undefined) dbUpdates.show_deck_progress = updates.showDeckProgress;
  if (updates.themePreference !== undefined) dbUpdates.theme_light_dark_mode = updates.themePreference;

  // Note: studyAlgorithm is derived into enable_dedicated_learn_mode in transformDbSettingsToSettings.
  // We should update enable_dedicated_learn_mode based on studyAlgorithm.
  if (updates.studyAlgorithm !== undefined) {
    dbUpdates.enable_dedicated_learn_mode = updates.studyAlgorithm === 'dedicated-learn';
  }
  // Direct mapping if enableDedicatedLearnMode is explicitly passed (though studyAlgorithm is preferred source of truth)
  if (updates.enableDedicatedLearnMode !== undefined) dbUpdates.enable_dedicated_learn_mode = updates.enableDedicatedLearnMode;
  
  if (updates.masteryThreshold !== undefined) dbUpdates.mastery_threshold = updates.masteryThreshold;
  if (updates.customLearnRequeueGap !== undefined) dbUpdates.custom_learn_requeue_gap = updates.customLearnRequeueGap;
  if (updates.graduatingIntervalDays !== undefined) dbUpdates.graduating_interval_days = updates.graduatingIntervalDays;
  if (updates.easyIntervalDays !== undefined) dbUpdates.easy_interval_days = updates.easyIntervalDays;
  if (updates.relearningStepsMinutes !== undefined) dbUpdates.relearning_steps_minutes = updates.relearningStepsMinutes;
  if (updates.initialLearningStepsMinutes !== undefined) dbUpdates.initial_learning_steps_minutes = updates.initialLearningStepsMinutes;
  if (updates.lapsedEfPenalty !== undefined) dbUpdates.lapsed_ef_penalty = updates.lapsedEfPenalty;
  if (updates.learnAgainPenalty !== undefined) dbUpdates.learn_again_penalty = updates.learnAgainPenalty;
  if (updates.learnHardPenalty !== undefined) dbUpdates.learn_hard_penalty = updates.learnHardPenalty;
  if (updates.minEasinessFactor !== undefined) dbUpdates.min_easiness_factor = updates.minEasinessFactor;
  if (updates.defaultEasinessFactor !== undefined) dbUpdates.default_easiness_factor = updates.defaultEasinessFactor;
  // firstReviewBaseDays and earlyReviewMaxDays are client-only settings for now

  if (updates.enableStudyTimer !== undefined) dbUpdates.enable_study_timer = updates.enableStudyTimer;
  if (updates.studyTimerDurationMinutes !== undefined) dbUpdates.study_timer_duration_minutes = updates.studyTimerDurationMinutes;
  if (updates.uiLanguage !== undefined) dbUpdates.ui_language = updates.uiLanguage;
  if (updates.deckListGroupingMode !== undefined) dbUpdates.deck_list_grouping_mode = updates.deckListGroupingMode; // Ensure this matches DB column
  if (updates.deckListActiveTagGroupId !== undefined) dbUpdates.deck_list_active_tag_group_id = updates.deckListActiveTagGroupId; // New mapping
  if (updates.deckListSortField !== undefined) dbUpdates.deck_list_sort_field = updates.deckListSortField;
  if (updates.deckListSortDirection !== undefined) dbUpdates.deck_list_sort_direction = updates.deckListSortDirection;
  
  // --- PDF Export Settings ---
  if (updates.enablePdfWordColorCoding !== undefined) dbUpdates.enable_pdf_word_color_coding = updates.enablePdfWordColorCoding;
  if (updates.pdfCardContentFontSize !== undefined) dbUpdates.pdf_card_content_font_size = updates.pdfCardContentFontSize;
  if (updates.showCardStatusIconsInPdf !== undefined) dbUpdates.show_card_status_icons_in_pdf = updates.showCardStatusIconsInPdf;
  
  return dbUpdates;
};

const transformDbSettingsToSettings = (dbSettings: DbSettings | null): Settings => {
    if (!dbSettings) {
        debug('transformDbSettingsToSettings: No DB settings provided, returning default.');
        return { 
            ...DEFAULT_SETTINGS 
        };
    }
    try {
        debug('transformDbSettingsToSettings: Transforming DB settings:', dbSettings);
        const cardFontValue = dbSettings.card_font as FontOption | null;
        const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');
        const cardFontFinal = isValidFont && cardFontValue ? cardFontValue : DEFAULT_SETTINGS.cardFont;

        const dbDialects = dbSettings.language_dialects as Record<string, string> | null;
        const languageDialectsFinal = { ...(DEFAULT_SETTINGS.languageDialects), ...(dbDialects ?? {}) };

        const dbPaletteConfig = dbSettings.word_palette_config as Record<string, Record<string, string>> | null;
        const wordPaletteConfigFinal = dbPaletteConfig ? { ...DEFAULT_PALETTE_CONFIG, ...dbPaletteConfig } : { ...DEFAULT_PALETTE_CONFIG };

        const studyAlgorithmFinal = (dbSettings.enable_dedicated_learn_mode ?? DEFAULT_SETTINGS.enableDedicatedLearnMode)
            ? 'dedicated-learn'
            : 'standard-sm2';

        // Validate step arrays from DB; fall back to defaults if empty/invalid
        const relearnStepsFinal = Array.isArray(dbSettings.relearning_steps_minutes)
            ? (dbSettings.relearning_steps_minutes.filter((n: unknown) => typeof n === 'number' && (n as number) > 0) as number[])
            : [];
        const initialStepsFinal = Array.isArray(dbSettings.initial_learning_steps_minutes)
            ? (dbSettings.initial_learning_steps_minutes.filter((n: unknown) => typeof n === 'number' && (n as number) > 0) as number[])
            : [];

        const transformed: Settings = {
            appLanguage: dbSettings.app_language ?? DEFAULT_SETTINGS.appLanguage,
            languageDialects: languageDialectsFinal,
            ttsEnabled: dbSettings.tts_enabled ?? DEFAULT_SETTINGS.ttsEnabled,
            showDifficulty: dbSettings.show_difficulty ?? DEFAULT_SETTINGS.showDifficulty,
            cardFont: cardFontFinal,
            enableBasicColorCoding: dbSettings.enable_basic_color_coding ?? DEFAULT_SETTINGS.enableBasicColorCoding,
            enableAdvancedColorCoding: dbSettings.enable_advanced_color_coding ?? DEFAULT_SETTINGS.enableAdvancedColorCoding,
            wordPaletteConfig: wordPaletteConfigFinal,
            colorOnlyNonNative: dbSettings.color_only_non_native ?? DEFAULT_SETTINGS.colorOnlyNonNative,
            showDeckProgress: dbSettings.show_deck_progress ?? DEFAULT_SETTINGS.showDeckProgress,
            themePreference: (dbSettings.theme_light_dark_mode ?? DEFAULT_SETTINGS.themePreference) as ThemePreference,
            studyAlgorithm: studyAlgorithmFinal,
            enableDedicatedLearnMode: dbSettings.enable_dedicated_learn_mode ?? DEFAULT_SETTINGS.enableDedicatedLearnMode,
            masteryThreshold: dbSettings.mastery_threshold ?? DEFAULT_SETTINGS.masteryThreshold,
            customLearnRequeueGap: dbSettings.custom_learn_requeue_gap ?? DEFAULT_SETTINGS.customLearnRequeueGap,
            graduatingIntervalDays: dbSettings.graduating_interval_days ?? DEFAULT_SETTINGS.graduatingIntervalDays,
            easyIntervalDays: dbSettings.easy_interval_days ?? DEFAULT_SETTINGS.easyIntervalDays,
            relearningStepsMinutes: relearnStepsFinal.length > 0 ? relearnStepsFinal : DEFAULT_SETTINGS.relearningStepsMinutes,
            initialLearningStepsMinutes: initialStepsFinal.length > 0 ? initialStepsFinal : DEFAULT_SETTINGS.initialLearningStepsMinutes,
            lapsedEfPenalty: typeof dbSettings.lapsed_ef_penalty === 'number' ? dbSettings.lapsed_ef_penalty : DEFAULT_SETTINGS.lapsedEfPenalty,
            learnAgainPenalty: typeof dbSettings.learn_again_penalty === 'number' ? dbSettings.learn_again_penalty : DEFAULT_SETTINGS.learnAgainPenalty,
            learnHardPenalty: typeof dbSettings.learn_hard_penalty === 'number' ? dbSettings.learn_hard_penalty : DEFAULT_SETTINGS.learnHardPenalty,
            minEasinessFactor: typeof dbSettings.min_easiness_factor === 'number' ? dbSettings.min_easiness_factor : DEFAULT_SETTINGS.minEasinessFactor,
            defaultEasinessFactor: typeof dbSettings.default_easiness_factor === 'number' ? dbSettings.default_easiness_factor : DEFAULT_SETTINGS.defaultEasinessFactor,
            enableStudyTimer: dbSettings.enable_study_timer ?? DEFAULT_SETTINGS.enableStudyTimer,
            studyTimerDurationMinutes: dbSettings.study_timer_duration_minutes ?? DEFAULT_SETTINGS.studyTimerDurationMinutes,
            uiLanguage: dbSettings.ui_language ?? DEFAULT_SETTINGS.uiLanguage,
            
            deckListGroupingMode: (dbSettings.deck_list_grouping_mode === 'none' || dbSettings.deck_list_grouping_mode === 'language' || dbSettings.deck_list_grouping_mode === 'tag_id') 
                                    ? dbSettings.deck_list_grouping_mode 
                                    : DEFAULT_SETTINGS.deckListGroupingMode,
            deckListActiveTagGroupId: dbSettings.deck_list_active_tag_group_id ?? DEFAULT_SETTINGS.deckListActiveTagGroupId, // Handles null from DB
            
            deckListSortField: (dbSettings.deck_list_sort_field === 'name' || dbSettings.deck_list_sort_field === 'created_at')
                                ? dbSettings.deck_list_sort_field
                                : DEFAULT_SETTINGS.deckListSortField,
            deckListSortDirection: (dbSettings.deck_list_sort_direction === 'asc' || dbSettings.deck_list_sort_direction === 'desc')
                                    ? dbSettings.deck_list_sort_direction
                                    : DEFAULT_SETTINGS.deckListSortDirection,
            
            removeMasteredCards: DEFAULT_SETTINGS.removeMasteredCards, 

            // --- PDF Export Settings ---
            enablePdfWordColorCoding: dbSettings.enable_pdf_word_color_coding ?? DEFAULT_SETTINGS.enablePdfWordColorCoding,
            pdfCardContentFontSize: dbSettings.pdf_card_content_font_size ?? DEFAULT_SETTINGS.pdfCardContentFontSize,
            showCardStatusIconsInPdf: dbSettings.show_card_status_icons_in_pdf ?? DEFAULT_SETTINGS.showCardStatusIconsInPdf,

            // Kid-friendly SRS tuning (client-only for now)
            firstReviewBaseDays: DEFAULT_SETTINGS.firstReviewBaseDays,
            earlyReviewMaxDays: DEFAULT_SETTINGS.earlyReviewMaxDays,
        };
        debug('transformDbSettingsToSettings: Transformation result:', transformed);
        return transformed;
    } catch (e) {
        appLogger.error("Error transforming DbSettings:", e);
        debug('transformDbSettingsToSettings: Error during transformation, returning default.');
        return { 
            ...DEFAULT_SETTINGS 
        };
    }
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  updateSettings: async () => ({ data: null, error: "Context not initialized" }),
  loading: true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  debug('SettingsProvider initializing');
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    debug('Settings load effect triggered', { userId: user?.id });
    if (!user) {
      debug('No user, setting settings to null and loading to false');
      setSettings(null); // Or set to DEFAULT_SETTINGS if preferred for logged-out state
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
          const finalSettings = transformDbSettingsToSettings(dbSettings);
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

// providers/settings-provider.tsx (Corrected updateSettings callback)

const updateSettings = useCallback(async (
  updates: Partial<Settings> // Expects camelCase partial updates
): Promise<ActionResult<DbSettings | null>> => {
  debug('updateSettings callback in provider called with:', updates);
  if (!user) {
    toast.error("Not logged in", { description: "Cannot save settings." });
    return { data: null, error: "User not authenticated" };
  }

  // Store previous state for potential revert
  const previousSettings = settings ? { ...settings } : null; 
  
  // Optimistically update the local state
  setSettings(prev => {
    if (prev) {
      return { ...prev, ...updates };
    }
    // If prev is null (settings not yet loaded), apply updates to default settings
    // This case should be rare if updateSettings is called after initial load.
    return { ...DEFAULT_SETTINGS, ...updates }; 
  });

  // Call the server action, passing the camelCase partial updates.
  // The server action (Task 0.5) is responsible for mapping these to snake_case for the DB.
  const dbUpdatesPayload = transformSettingsToDbUpdates(updates);
  const { data: updatedDbSettingsFromAction, error } = await updateUserSettingsServerAction({ updates: dbUpdatesPayload });

  if (error) {
    toast.error("Failed to save settings", { description: error });
    setSettings(previousSettings); // Revert optimistic update on error
    return { data: null, error };
  }

  if (updatedDbSettingsFromAction) {
      // The server action returns the updated DbSettings (snake_case from DB)
      // Transform it back to frontend Settings (camelCase) to update our state accurately
      const finalSettings = transformDbSettingsToSettings(updatedDbSettingsFromAction);
      
      // Preserve PDF settings that are not persisted to database yet
      if (updates.enablePdfWordColorCoding !== undefined) {
        finalSettings.enablePdfWordColorCoding = updates.enablePdfWordColorCoding;
      }
      if (updates.pdfCardContentFontSize !== undefined) {
        finalSettings.pdfCardContentFontSize = updates.pdfCardContentFontSize;
      }
      if (updates.showCardStatusIconsInPdf !== undefined) {
        finalSettings.showCardStatusIconsInPdf = updates.showCardStatusIconsInPdf;
      }
      
      setSettings(finalSettings); // Confirm update with transformed data from DB + preserved PDF settings
      // toast.success("Settings saved!"); // Toast can be here or in the component calling this
      return { data: updatedDbSettingsFromAction, error: null };
  }
  
  // This case implies the action succeeded (no error) but returned no data, which is unexpected.
  appLogger.warn("updateSettings: Action succeeded but returned no data. Reverting optimistic update.");
  setSettings(previousSettings); 
  return { data: null, error: "Failed to update settings: action returned no data." };

}, [user, settings]);

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

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}