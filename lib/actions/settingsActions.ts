// lib/actions/settingsActions.ts
"use server";

import { createActionClient } from '@/lib/supabase/server';
// import { revalidatePath } from 'next/cache';
import { z } from 'zod';
// --- FIX: Ensure types/database includes the new settings columns ---
import type { Database, Tables, Json } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';
import type { Settings, FontOption } from "@/providers/settings-provider";

type DbSettings = Tables<'settings'>;

// --- UPDATED Zod Schema ---
// Add the new boolean flags. Keep nullable() if DB columns allow null.
const updateSettingsSchema = z.object({
  appLanguage: z.string().optional(),
  cardFont: z.enum(["default", "opendyslexic", "atkinson"]).optional(),
  showDifficulty: z.boolean().optional().nullable(),
  masteryThreshold: z.number().int().min(1).max(10).optional().nullable(),
  ttsEnabled: z.boolean().optional().nullable(),
  srs_algorithm: z.enum(['sm2', 'fsrs']).optional(),
  languageDialects: z.record(z.string()).optional().nullable(),
  // --- NEW Fields ---
  enableBasicColorCoding: z.boolean().optional().nullable(), // Allow nullable from DB
  enableAdvancedColorCoding: z.boolean().optional().nullable(), // Allow nullable from DB
  // -----------------
  wordColorConfig: z.record(z.record(z.string())).optional().nullable(),
}).partial();

// getUserSettings function (Remains unchanged)
export async function getUserSettings(): Promise<ActionResult<DbSettings | null>> {
    // ... (existing implementation) ...
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

        if ('appLanguage' in updates && updates.appLanguage !== undefined) dbPayload.app_language = updates.appLanguage;
        if ('cardFont' in updates && updates.cardFont !== undefined) dbPayload.card_font = updates.cardFont;
        if ('showDifficulty' in updates && updates.showDifficulty !== undefined) dbPayload.show_difficulty = updates.showDifficulty;
        if ('masteryThreshold' in updates && updates.masteryThreshold !== undefined) dbPayload.mastery_threshold = updates.masteryThreshold;
        if ('ttsEnabled' in updates && updates.ttsEnabled !== undefined) dbPayload.tts_enabled = updates.ttsEnabled;
        // if ('srs_algorithm' in updates && updates.srs_algorithm !== undefined) dbPayload.srs_algorithm = updates.srs_algorithm;
        if ('languageDialects' in updates && updates.languageDialects !== undefined) dbPayload.language_dialects = updates.languageDialects as Json;

        // --- Map NEW Fields ---
        if ('enableBasicColorCoding' in updates && updates.enableBasicColorCoding !== undefined) {
             dbPayload.enable_basic_color_coding = updates.enableBasicColorCoding;
        }
        if ('enableAdvancedColorCoding' in updates && updates.enableAdvancedColorCoding !== undefined) {
             dbPayload.enable_advanced_color_coding = updates.enableAdvancedColorCoding;
        }
        // ---------------------
        if ('wordColorConfig' in updates && updates.wordColorConfig !== undefined) {
             dbPayload.word_color_config = updates.wordColorConfig as Json;
        }

        if (Object.keys(dbPayload).length === 0) {
             console.log("[updateUserSettings] No valid fields provided for update after mapping.");
             const { data: currentSettings } = await getUserSettings(); // Return current settings if no update
             return { data: currentSettings, error: null };
        }

        // Add updated_at timestamp
        dbPayload.updated_at = new Date().toISOString();

        console.log(`[updateUserSettings] User: ${user.id}, Upserting payload:`, dbPayload);

        // Perform Upsert
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