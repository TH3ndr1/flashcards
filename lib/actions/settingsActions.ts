"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { DbSettings } from "@/types/database";

/**
 * Fetches the settings for the currently authenticated user.
 * If no settings exist, creates default settings ('sm2' algorithm).
 * 
 * @returns Promise<{ data: DbSettings | null, error: Error | null }>
 */
export async function getUserSettings(): Promise<{ data: DbSettings | null, error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("getUserSettings: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }

    try {
        // Attempt to fetch existing settings
        const { data: settings, error: fetchError } = await supabase
            .from("settings")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle<DbSettings>(); // Use maybeSingle to handle missing row gracefully

        if (fetchError) {
            console.error("getUserSettings: Error fetching settings:", fetchError);
            throw fetchError; // Throw to be caught by the outer catch block
        }

        // If settings exist, return them
        if (settings) {
            console.log("getUserSettings: Found existing settings for user:", user.id);
            return { data: settings, error: null };
        }

        // If no settings found, create default settings
        console.log("getUserSettings: No settings found for user:", user.id, "Creating defaults.");
        const { data: defaultSettings, error: insertError } = await supabase
            .from('settings')
            .insert({ 
                user_id: user.id, 
                srs_algorithm: 'sm2' // Default algorithm
                // Add other defaults if needed (e.g., tts_enabled: true)
            })
            .select()
            .single<DbSettings>();

        if (insertError) {
            console.error("getUserSettings: Error inserting default settings:", insertError);
            throw insertError;
        }

        console.log("getUserSettings: Default settings created successfully for user:", user.id);
        return { data: defaultSettings, error: null };

    } catch (error) {
        console.error("getUserSettings: Unexpected error:", error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to get or create user settings.") };
    }
}

/**
 * Updates the settings for the currently authenticated user.
 * Uses upsert to create settings if they don't exist.
 * 
 * @param updates Partial settings object. Only include fields to be updated.
 * @returns Promise<{ error: Error | null }>
 */
export async function updateUserSettings(updates: Partial<Omit<DbSettings, 'user_id' | 'created_at' | 'updated_at'>>): Promise<{ error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
         console.error("updateUserSettings: Auth error or no user", authError);
        return { error: authError || new Error("User not authenticated") };
    }

    // Ensure srs_algorithm is not accidentally changed from 'sm2' if not provided
    // For now, we only support 'sm2', so we might even enforce it here
    const finalUpdates: Partial<DbSettings> = {
        ...updates,
        srs_algorithm: 'sm2', // Enforce sm2 for now
        user_id: user.id, // Ensure user_id is always set for upsert
        updated_at: new Date().toISOString() // Manually set updated_at if trigger isn't used/reliable
    };

    // Remove user_id from the updates object passed to upsert if it conflicts with your upsert strategy
    // delete finalUpdates.user_id; // Depending on how upsert conflict resolution is set up

    console.log("updateUserSettings: Updating settings for user:", user.id, "with data:", finalUpdates);

    try {
        // Upsert ensures the row is created if it doesn't exist, or updated if it does.
        const { error } = await supabase
            .from('settings')
            .upsert(finalUpdates, { onConflict: 'user_id' }) // Specify conflict target
            .select() // Select to confirm (optional, upsert doesn't return by default in some versions)
            .single(); // Expect one row affected

        if (error) {
             console.error("updateUserSettings: Error upserting settings:", error);
            throw error;
        }

        console.log("updateUserSettings: Settings updated successfully for user:", user.id);
        
        // Revalidate the settings page cache after successful update
        revalidatePath("/settings"); // Adjust path if needed

        return { error: null };

    } catch (error) {
        console.error("updateUserSettings: Unexpected error:", error);
        return { error: error instanceof Error ? error : new Error("Failed to update user settings.") };
    }
} 