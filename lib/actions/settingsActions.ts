"use server";

import { createActionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database, Tables } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types'; // Corrected import path
// Import the Settings type used by the frontend/provider
import type { Settings, FontOption } from "@/providers/settings-provider"; 
import { convertPayloadToCamelCase } from '@/lib/utils'; // Import the conversion utility

// Define ActionResult locally if needed
// interface ActionResult<T> { data: T | null; error: Error | null; }

type DbSettings = Tables<'settings'>;

// Zod schema for UPDATING settings (all fields optional)
// Use refine for complex validation if needed
const updateSettingsSchema = z.object({
  appLanguage: z.string().optional(),
  cardFont: z.enum(["default", "opendyslexic", "atkinson"]).optional(),
  showDifficulty: z.boolean().optional(),
  masteryThreshold: z.number().int().positive().optional(),
  ttsEnabled: z.boolean().optional(),
  removeMasteredCards: z.boolean().optional(),
  srs_algorithm: z.enum(['sm2', 'fsrs']).optional(),
  languageDialects: z.record(z.string()).optional(), // Basic check for object
}).partial(); // Ensure all fields are optional for update

type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/**
 * Server actions for managing user settings.
 * 
 * This module provides:
 * - User settings management
 * - SRS algorithm configuration
 * - Study mode preferences
 * - TTS preferences
 * 
 * @module settingsActions
 */

/**
 * Fetches user settings.
 * 
 * @returns {Promise<Settings>} The user's settings
 * @throws {Error} If settings fetch fails or user is not authenticated
 */
export async function getUserSettings(): Promise<Settings> {
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            throw new Error(authError?.message || 'Not authenticated');
        }

        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
            
        if (error) {
            console.error("[getUserSettings] Error:", error);
            throw new Error(error.message || "Failed to fetch settings.");
        }
        // Convert snake_case DB result to camelCase Settings type
        const settingsResult = data ? convertPayloadToCamelCase(data) : null;
        return settingsResult as Settings; // Cast after conversion

    } catch (error) {
        console.error('[getUserSettings] Unexpected error:', error);
        throw error instanceof Error ? error : new Error('Unknown error fetching settings');
    }
}

/**
 * Updates user settings.
 * 
 * @param {Object} params - Settings update parameters
 * @param {Partial<Settings>} params.updates - Partial settings object containing fields to update
 * @returns {Promise<Settings>} The updated settings
 * @throws {Error} If settings update fails or user is not authenticated
 */
export async function updateUserSettings({
  updates,
}: {
  updates: Partial<Settings>;
}): Promise<Settings> {
    console.log(`[updateUserSettings] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[updateUserSettings] Auth error:', authError);
             throw new Error(authError?.message || 'Not authenticated');
        }

        // Validate the partial updates
        const validation = updateSettingsSchema.safeParse(updates);
        if (!validation.success) {
             console.warn("[updateUserSettings] Validation failed:", validation.error.errors);
             throw new Error(validation.error.errors[0].message);
        }
        const validatedUpdates = validation.data;

        if (Object.keys(validatedUpdates).length === 0) {
             throw new Error("No valid fields provided for update.");
        }

        // Map frontend camelCase settings to DB snake_case columns
        const dbPayload: Partial<DbSettings> = {};
        if (validatedUpdates.appLanguage !== undefined) dbPayload.app_language = validatedUpdates.appLanguage;
        if (validatedUpdates.cardFont !== undefined) dbPayload.card_font = validatedUpdates.cardFont;
        if (validatedUpdates.showDifficulty !== undefined) dbPayload.show_difficulty = validatedUpdates.showDifficulty;
        if (validatedUpdates.masteryThreshold !== undefined) dbPayload.mastery_threshold = validatedUpdates.masteryThreshold;
        if (validatedUpdates.ttsEnabled !== undefined) dbPayload.tts_enabled = validatedUpdates.ttsEnabled;
        // Add removeMasteredCards if it exists in your DB schema
        // if (validatedUpdates.removeMasteredCards !== undefined) dbPayload.remove_mastered_cards = validatedUpdates.removeMasteredCards;
        // TODO: Uncomment the next line once 'srs_algorithm' column is added to the 'settings' table and types are regenerated.
        // if (validatedUpdates.srs_algorithm !== undefined) dbPayload.srs_algorithm = validatedUpdates.srs_algorithm;
        // if (validatedUpdates.languageDialects !== undefined) dbPayload.language_dialects = validatedUpdates.languageDialects; // Assuming JSONB or text column
        
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
            throw new Error(upsertError.message || 'Failed to update settings.');
        }
        
        if (!updatedSettings) {
             console.error('[updateUserSettings] No data returned after upsert.');
             throw new Error('Failed to confirm settings update.');
        }

        console.log(`[updateUserSettings] Success for user: ${user.id}`);
        // Revalidate paths? Maybe revalidate layout if settings affect global UI
        // revalidatePath('/', 'layout');
        // Convert snake_case DB result to camelCase Settings type before returning
        const updatedSettingsCamel = convertPayloadToCamelCase(updatedSettings);
        return updatedSettingsCamel as Settings;

    } catch (error) {
        console.error('[updateUserSettings] Caught unexpected error:', error);
        throw error instanceof Error ? error : new Error('Unknown error updating settings');
    }
} 