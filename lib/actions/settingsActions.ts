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
  updates: Partial<Settings>; // Expect camelCase from provider, including wordPaletteConfig
}): Promise<ActionResult<DbSettings | null>> {
    console.log(`[updateUserSettings] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[updateUserSettings] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        // Manual Mapping from frontend camelCase to DB snake_case
        const dbPayload: Partial<DbSettings> = {};

        // Map fields 
        if ('appLanguage' in updates && updates.appLanguage !== undefined) dbPayload.app_language = updates.appLanguage;
        if ('cardFont' in updates && updates.cardFont !== undefined) dbPayload.card_font = updates.cardFont;
        if ('showDifficulty' in updates && updates.showDifficulty !== undefined) dbPayload.show_difficulty = updates.showDifficulty;
        if ('masteryThreshold' in updates && updates.masteryThreshold !== undefined) dbPayload.mastery_threshold = updates.masteryThreshold;
        if ('ttsEnabled' in updates && updates.ttsEnabled !== undefined) dbPayload.tts_enabled = updates.ttsEnabled;
        if ('languageDialects' in updates && updates.languageDialects !== undefined) dbPayload.language_dialects = updates.languageDialects as Json;

        if ('colorOnlyNonNative' in updates && updates.colorOnlyNonNative !== undefined) {
            dbPayload.color_only_non_native = updates.colorOnlyNonNative;
        }

        if ('enableBasicColorCoding' in updates && updates.enableBasicColorCoding !== undefined) {
             dbPayload.enable_basic_color_coding = updates.enableBasicColorCoding;
        }
        if ('enableAdvancedColorCoding' in updates && updates.enableAdvancedColorCoding !== undefined) {
             dbPayload.enable_advanced_color_coding = updates.enableAdvancedColorCoding;
        }

        // --- Map NEW Palette Config ---
        // Remove old mapping
        // if ('wordColorConfig' in updates && updates.wordColorConfig !== undefined) { ... }
        // Add new mapping
        if ('wordPaletteConfig' in updates && updates.wordPaletteConfig !== undefined) {
             dbPayload.word_palette_config = updates.wordPaletteConfig as Json; // Save the object containing palette IDs
        }
        // -----------------------------

        if (Object.keys(dbPayload).length === 0) {
             console.log("[updateUserSettings] No valid fields provided for update after mapping.");
             const { data: currentSettings } = await getUserSettings();
             return { data: currentSettings, error: null };
        }

        // Add updated_at timestamp
        dbPayload.updated_at = new Date().toISOString();

        console.log(`[updateUserSettings] User: ${user.id}, Upserting payload:`, dbPayload);

        // Perform Upsert (unchanged logic)
        const { data: updatedSettings, error: upsertError } = await supabase
            .from('settings')
            .upsert({ ...dbPayload, user_id: user.id }, { onConflict: 'user_id' })
            .select()
            .single();

        if (upsertError) {
            console.error('[updateUserSettings] Upsert error:', upsertError);
            return { data: null, error: upsertError.message || 'Failed to update settings.' };
        }

        if (!updatedSettings) {
             console.error('[updateUserSettings] No data returned after upsert.');
             return { data: null, error: 'Failed to confirm settings update.' };
        }

        console.log(`[updateUserSettings] Success for user: ${user.id}`);
        return { data: updatedSettings, error: null }; // Return raw DB data

    } catch (error: any) {
        console.error('[updateUserSettings] Caught unexpected error:', error);
        return { data: null, error: error.message || 'Unknown error updating settings' };
    }
}