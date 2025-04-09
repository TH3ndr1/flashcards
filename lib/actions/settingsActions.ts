"use server";

import { createActionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Database, Tables } from "@/types/database";
import type { ActionResult } from './types'; // Define or import ActionResult
// Import the Settings type used by the frontend/provider
import type { Settings, FontOption } from "@/providers/settings-provider"; 

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
 * Fetches settings for the current user (can remain a server action or be a service)
 * Keeping it here for consistency for now.
 */
export async function fetchSettingsAction(): Promise<ActionResult<DbSettings | null>> {
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }

        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
            
        if (error) {
            console.error("[fetchSettingsAction] Error:", error);
            return { data: null, error: new Error(error.message || "Failed to fetch settings.") };
        }
        return { data, error: null };

    } catch (error) {
        console.error('[fetchSettingsAction] Unexpected error:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error fetching settings') };
    }
}

/**
 * Server Action to update (upsert) user settings.
 */
export async function updateSettingsAction(
    updates: UpdateSettingsInput
): Promise<ActionResult<DbSettings | null>> { // Return updated DbSettings
    console.log(`[updateSettingsAction] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[updateSettingsAction] Auth error:', authError);
             return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }

        // Validate the partial updates
        const validation = updateSettingsSchema.safeParse(updates);
        if (!validation.success) {
             console.warn("[updateSettingsAction] Validation failed:", validation.error.errors);
             return { data: null, error: new Error(validation.error.errors[0].message) };
        }
        const validatedUpdates = validation.data;

        if (Object.keys(validatedUpdates).length === 0) {
             return { data: null, error: new Error("No valid fields provided for update.") };
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
        if (validatedUpdates.srs_algorithm !== undefined) dbPayload.srs_algorithm = validatedUpdates.srs_algorithm;
        if (validatedUpdates.languageDialects !== undefined) dbPayload.language_dialects = validatedUpdates.languageDialects;
        
        // Add updated_at timestamp
        dbPayload.updated_at = new Date().toISOString();
        
        console.log(`[updateSettingsAction] User: ${user.id}, Upserting payload:`, dbPayload);

        // Perform Upsert
        const { data: updatedSettings, error: upsertError } = await supabase
            .from('settings')
            .upsert({ ...dbPayload, user_id: user.id }, { onConflict: 'user_id' })
            .select()
            .single();

        if (upsertError) {
            console.error('[updateSettingsAction] Upsert error:', upsertError);
            return { data: null, error: new Error(upsertError.message || 'Failed to update settings.') };
        }
        
        if (!updatedSettings) {
             console.error('[updateSettingsAction] No data returned after upsert.');
             return { data: null, error: new Error('Failed to confirm settings update.') };
        }

        console.log(`[updateSettingsAction] Success for user: ${user.id}`);
        // Revalidate paths? Maybe revalidate layout if settings affect global UI
        // revalidatePath('/', 'layout');
        return { data: updatedSettings, error: null };

    } catch (error) {
        console.error('[updateSettingsAction] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error updating settings') };
    }
} 