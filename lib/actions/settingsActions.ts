// lib/actions/settingsActions.ts
"use server";

import { createActionClient } from '@/lib/supabase/server';
// import { revalidatePath } from 'next/cache';
import { z } from 'zod';
// Ensure types/database includes the new settings columns
import type { Database, Tables, Json } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';
// Import the Settings type used by the frontend/provider
import type { Settings, FontOption } from "@/providers/settings-provider";
import { appLogger, statusLogger } from '@/lib/logger';

type DbSettings = Tables<'settings'>;

// --- UPDATED Zod Schema ---
const updateSettingsSchema = z.object({
  appLanguage: z.string().optional(),
  cardFont: z.enum(["default", "opendyslexic", "atkinson"]).optional(),
  showDifficulty: z.boolean().optional().nullable(),
  masteryThreshold: z.number().int().min(1).max(10).optional().nullable(),
  ttsEnabled: z.boolean().optional().nullable(),
  srs_algorithm: z.enum(['sm2', 'fsrs']).optional(),
  languageDialects: z.record(z.string()).optional().nullable(),
  enableBasicColorCoding: z.boolean().optional().nullable(),
  enableAdvancedColorCoding: z.boolean().optional().nullable(),
  // --- Replaced wordColorConfig with wordPaletteConfig ---
  wordPaletteConfig: z.record(z.record(z.string())).optional().nullable(), // Expects { PoS: { Gender: PaletteID }}
  // ------------------------------------------------------
}).partial();


// getUserSettings function (Remains unchanged)
export async function getUserSettings(): Promise<ActionResult<DbSettings | null>> {
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { data: null, error: authError?.message || 'Not authenticated' };

        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) return { data: null, error: error.message || "Failed to fetch settings." };
        return { data: data, error: null };

    } catch (error: any) {
        return { data: null, error: error.message || 'Unknown error fetching settings' };
    }
}

/**
 * Updates user settings.
 */
export async function updateUserSettings({
  updates,
}: {
  updates: Partial<Settings>; // Expect camelCase from provider
}): Promise<ActionResult<DbSettings | null>> {
    appLogger.info(`[updateUserSettings] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             appLogger.error('[updateUserSettings] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        // Manual Mapping from frontend camelCase to DB snake_case
        const dbPayload: Partial<DbSettings> = {};

        // Map fields 
        if ('appLanguage' in updates && updates.appLanguage !== undefined) dbPayload.app_language = updates.appLanguage;
        if ('cardFont' in updates && updates.cardFont !== undefined) dbPayload.card_font = updates.cardFont;
        if ('showDifficulty' in updates && updates.showDifficulty !== undefined) dbPayload.show_difficulty = updates.showDifficulty;
        if ('ttsEnabled' in updates && updates.ttsEnabled !== undefined) dbPayload.tts_enabled = updates.ttsEnabled;
        if ('languageDialects' in updates && updates.languageDialects !== undefined) dbPayload.language_dialects = updates.languageDialects as Json;
        if ('colorOnlyNonNative' in updates && updates.colorOnlyNonNative !== undefined) dbPayload.color_only_non_native = updates.colorOnlyNonNative;
        if ('enableBasicColorCoding' in updates && updates.enableBasicColorCoding !== undefined) dbPayload.enable_basic_color_coding = updates.enableBasicColorCoding;
        if ('enableAdvancedColorCoding' in updates && updates.enableAdvancedColorCoding !== undefined) dbPayload.enable_advanced_color_coding = updates.enableAdvancedColorCoding;
        if ('wordPaletteConfig' in updates && updates.wordPaletteConfig !== undefined) dbPayload.word_palette_config = updates.wordPaletteConfig as Json;
        if ('showDeckProgress' in updates && updates.showDeckProgress !== undefined) dbPayload.show_deck_progress = updates.showDeckProgress;
        if ('themePreference' in updates && updates.themePreference !== undefined) dbPayload.theme_light_dark_mode = String(updates.themePreference);

        // --- NEW Study Algorithm Mappings ---
        // Note: studyAlgorithm itself might not map directly if derived from enableDedicatedLearnMode
        if ('enableDedicatedLearnMode' in updates && updates.enableDedicatedLearnMode !== undefined) dbPayload.enable_dedicated_learn_mode = updates.enableDedicatedLearnMode;
        if ('masteryThreshold' in updates && updates.masteryThreshold !== undefined) dbPayload.mastery_threshold = updates.masteryThreshold;
        if ('customLearnRequeueGap' in updates && updates.customLearnRequeueGap !== undefined) dbPayload.custom_learn_requeue_gap = updates.customLearnRequeueGap;
        if ('graduatingIntervalDays' in updates && updates.graduatingIntervalDays !== undefined) dbPayload.graduating_interval_days = updates.graduatingIntervalDays;
        if ('easyIntervalDays' in updates && updates.easyIntervalDays !== undefined) dbPayload.easy_interval_days = updates.easyIntervalDays;
        if ('relearningStepsMinutes' in updates && updates.relearningStepsMinutes !== undefined) dbPayload.relearning_steps_minutes = updates.relearningStepsMinutes;
        if ('initialLearningStepsMinutes' in updates && updates.initialLearningStepsMinutes !== undefined) dbPayload.initial_learning_steps_minutes = updates.initialLearningStepsMinutes;
        if ('lapsedEfPenalty' in updates && updates.lapsedEfPenalty !== undefined) dbPayload.lapsed_ef_penalty = updates.lapsedEfPenalty;
        if ('learnAgainPenalty' in updates && updates.learnAgainPenalty !== undefined) dbPayload.learn_again_penalty = updates.learnAgainPenalty;
        if ('learnHardPenalty' in updates && updates.learnHardPenalty !== undefined) dbPayload.learn_hard_penalty = updates.learnHardPenalty;
        if ('minEasinessFactor' in updates && updates.minEasinessFactor !== undefined) dbPayload.min_easiness_factor = updates.minEasinessFactor;
        if ('defaultEasinessFactor' in updates && updates.defaultEasinessFactor !== undefined) dbPayload.default_easiness_factor = updates.defaultEasinessFactor;
        // ------------------------------------
        if ('enableStudyTimer' in updates && updates.enableStudyTimer !== undefined) {dbPayload.enable_study_timer = updates.enableStudyTimer;}
        if ('studyTimerDurationMinutes' in updates && updates.studyTimerDurationMinutes !== undefined) {dbPayload.study_timer_duration_minutes = updates.studyTimerDurationMinutes;}
        if ('uiLanguage' in updates && updates.uiLanguage !== undefined) {dbPayload.ui_language = updates.uiLanguage;}
        if ('deckListGroupingPreference' in updates && updates.deckListGroupingPreference !== undefined) {dbPayload.deck_list_grouping_preference = updates.deckListGroupingPreference;}

        if (Object.keys(dbPayload).length === 0) {
             appLogger.info("[updateUserSettings] No valid fields provided for update after mapping.");
             const { data: currentSettings } = await getUserSettings();
             return { data: currentSettings, error: null };
        }

        // Add updated_at timestamp
        dbPayload.updated_at = new Date().toISOString();

        appLogger.info(`[updateUserSettings] User: ${user.id}, Upserting payload:`, dbPayload);

        // Perform Upsert (unchanged logic)
        const { data: updatedSettings, error: upsertError } = await supabase
            .from('settings')
            .upsert({ ...dbPayload, user_id: user.id }, { onConflict: 'user_id' })
            .select()
            .single();

        if (upsertError) {
            appLogger.error('[updateUserSettings] Upsert error:', upsertError);
            return { data: null, error: upsertError.message || 'Failed to update settings.' };
        }

        if (!updatedSettings) {
             appLogger.error('[updateUserSettings] No data returned after upsert.');
             return { data: null, error: 'Failed to confirm settings update.' };
        }

        appLogger.info(`[updateUserSettings] Success for user: ${user.id}`);
        return { data: updatedSettings, error: null }; // Return raw DB data

    } catch (error: any) {
        appLogger.error('[updateUserSettings] Caught unexpected error:', error);
        return { data: null, error: error.message || 'Unknown error updating settings' };
    }
}