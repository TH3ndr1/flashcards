// lib/actions/settingsActions.ts
"use server";

import { createActionClient } from '@/lib/supabase/server';
// import { revalidatePath } from 'next/cache';
import { z } from 'zod';
// Ensure types/database includes the new settings columns
import type { Database, Tables, Json, TablesUpdate } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';
// Import the Settings type used by the frontend/provider
// import type { Settings, FontOption } from "@/providers/settings-provider"; // No longer directly needed for 'updates' type
import { appLogger, statusLogger } from '@/lib/logger';

type DbSettings = Tables<'settings'>;

// Zod schema can remain for validation if needed, but ensure it matches DB columns
const updateSettingsDbSchema = z.object({
  app_language: z.string().optional(),
  card_font: z.enum(["default", "opendyslexic", "atkinson"]).optional(),
  show_difficulty: z.boolean().optional().nullable(),
  mastery_threshold: z.number().int().min(1).max(10).optional().nullable(),
  tts_enabled: z.boolean().optional().nullable(),
  srs_algorithm: z.enum(['sm2', 'fsrs']).optional(), // Example, adjust to actual column
  language_dialects: z.record(z.string()).optional().nullable(),
  enable_basic_color_coding: z.boolean().optional().nullable(),
  enable_advanced_color_coding: z.boolean().optional().nullable(),
  word_palette_config: z.record(z.record(z.string())).optional().nullable(),
  color_only_non_native: z.boolean().optional().nullable(),
  show_deck_progress: z.boolean().optional().nullable(),
  theme_light_dark_mode: z.string().optional().nullable(), // Assuming themePreference is stored as string
  enable_dedicated_learn_mode: z.boolean().optional().nullable(),
  custom_learn_requeue_gap: z.number().int().optional().nullable(),
  graduating_interval_days: z.number().int().optional().nullable(),
  easy_interval_days: z.number().int().optional().nullable(),
  relearning_steps_minutes: z.array(z.number().int()).optional().nullable(),
  initial_learning_steps_minutes: z.array(z.number().int()).optional().nullable(),
  lapsed_ef_penalty: z.number().optional().nullable(),
  learn_again_penalty: z.number().optional().nullable(),
  learn_hard_penalty: z.number().optional().nullable(),
  min_easiness_factor: z.number().optional().nullable(),
  default_easiness_factor: z.number().optional().nullable(),
  enable_study_timer: z.boolean().optional().nullable(),
  study_timer_duration_minutes: z.number().int().optional().nullable(),
  ui_language: z.string().optional().nullable(),
  deck_list_grouping_mode: z.enum(['none', 'language', 'tag_id']).optional().nullable(),
  deck_list_active_tag_group_id: z.string().uuid().nullable().optional(),
  deck_list_sort_field: z.enum(['name', 'created_at']).optional().nullable(),
  deck_list_sort_direction: z.enum(['asc', 'desc']).optional().nullable(),
  // Add any other DbSettings fields here
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
 * Updates user settings. Expects payload with snake_case keys matching DB columns.
 */
export async function updateUserSettings({
  updates,
}: {
  updates: TablesUpdate<'settings'>; // Expect snake_case keys directly matching DB
}): Promise<ActionResult<DbSettings | null>> {
    appLogger.info(`[updateUserSettings] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             appLogger.error('[updateUserSettings] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        // The 'updates' object should now directly contain snake_case keys
        // and values ready for the database.
        // Optional: Validate 'updates' against updateSettingsDbSchema if strict validation is needed.
        // For example:
        // const parseResult = updateSettingsDbSchema.safeParse(updates);
        // if (!parseResult.success) {
        //   appLogger.error('[updateUserSettings] Validation error:', parseResult.error.flatten());
        //   return { data: null, error: "Invalid settings format." };
        // }
        // const dbPayload = parseResult.data;

        // For now, assuming 'updates' is already well-formed Partial<DbSettings>
        const dbPayload: TablesUpdate<'settings'> = { ...updates };


        if (Object.keys(dbPayload).length === 0) {
             appLogger.info("[updateUserSettings] No valid fields provided for update.");
             // Optionally, still fetch and return current settings, or return an error/specific message.
             const { data: currentSettingsIfNoUpdate } = await getUserSettings();
             return { data: currentSettingsIfNoUpdate, error: null }; // Or: {data: null, error: "No changes to apply"}
        }

        // Add updated_at timestamp
        dbPayload.updated_at = new Date().toISOString();

        appLogger.info(`[updateUserSettings] User: ${user.id}, Upserting payload:`, dbPayload);

        // Perform Upsert
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