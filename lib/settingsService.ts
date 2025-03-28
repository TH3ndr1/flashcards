// File: lib/settingsService.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Settings } from '@/hooks/use-settings';

/**
 * Fetches the settings for a given user from the Supabase "settings" table.
 * Returns null if no settings are found.
 */
export async function fetchSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching settings:', error);
    throw error;
  }

  if (!data) return null;

  // Transform data from snake_case to camelCase:
  const transformedData: Settings = {
    id: data.id,
    userId: data.user_id,
    appLanguage: data.app_language,
  };

  return transformedData;
}

/**
 * Updates (or upserts) the settings for a given user in the Supabase "settings" table.
 * This function uses an upsert to create the settings record if it doesn't exist.
 */
export async function updateSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: Settings
): Promise<Settings> {
  // Convert camelCase keys to snake_case as expected by your database.
  const settingsData = {
    user_id: userId,
    app_language: settings.appLanguage, // Convert appLanguage to app_language
    id: settings.id,
  };

  const { data, error } = await supabase
    .from("settings")
    .upsert(settingsData, { onConflict: "user_id", returning: "representation" })
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error updating settings:", JSON.stringify(error));
    throw new Error(error.message || "Unknown error updating settings");
  }

  return data as Settings;
}