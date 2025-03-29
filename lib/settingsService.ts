// File: lib/settingsService.ts

import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Settings, FontOption } from '@/providers/settings-provider';
import { DEFAULT_MASTERY_THRESHOLD } from '@/lib/study-utils';

// --- Helper Type for raw Supabase query result ---
interface RawSettingsQueryResult {
  id: string;
  user_id: string;
  app_language: string | null;
  language_dialects: Record<string, string> | null; // Assuming JSONB or similar
  tts_enabled: boolean | null;
  show_difficulty: boolean | null;
  mastery_threshold: number | null;
  card_font: string | null; // Raw value from DB might be string
}
// --- End Helper Type ---

/**
 * Fetches the settings for a given user from the Supabase "settings" table.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user whose settings are to be fetched.
 * @returns {Promise<{ data: Settings | null; error: PostgrestError | null }>} 
 *          An object containing the fetched settings on success,
 *          null data if not found, or an error object if the fetch fails.
 */
export async function fetchSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Settings | null; error: PostgrestError | null }> {
  // Use type for query result
  const { data: rawData, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .returns<RawSettingsQueryResult | null>() // Specify expected structure
    .maybeSingle();

  if (error) {
    console.error('Error fetching settings:', error);
    // Return error object
    return { data: null, error }; 
  }

  // Handle case where no settings found (not an error)
  if (!rawData) {
    return { data: null, error: null }; 
  }

  // Type-safe transformation
  try {
    // Validate card_font if necessary or handle potential unknown values
    const cardFontValue = rawData.card_font as FontOption | null; // Keep assertion or add validation
    const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');
    
    const transformedData: Settings = {
      id: rawData.id,
      userId: rawData.user_id,
      appLanguage: rawData.app_language ?? 'en', // Provide default if needed
      languageDialects: rawData.language_dialects ?? {}, // Default to empty object
      ttsEnabled: rawData.tts_enabled ?? true,
      showDifficulty: rawData.show_difficulty ?? true,
      masteryThreshold: rawData.mastery_threshold ?? DEFAULT_MASTERY_THRESHOLD,
      cardFont: isValidFont && cardFontValue ? cardFontValue : 'default',
    };
    // Return data on success
    return { data: transformedData, error: null };
  } catch (transformError) {
    console.error("Error transforming settings data:", transformError);
    // Return transformation error (as a generic PostgrestError-like structure)
    return { data: null, error: { message: "Failed to process settings data", details: String(transformError), hint: "", code: "SETTINGS_TRANSFORM_ERROR" } };
  }
}

/**
 * Updates (or upserts) the settings for a given user in the Supabase "settings" table.
 * This function uses an upsert to create the settings record if it doesn't exist.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user whose settings are being updated.
 * @param {Settings} settings - The complete settings object with updated values.
 * @returns {Promise<{ data: Settings | null; error: PostgrestError | null }>} 
 *          An object containing the updated settings on success,
 *          or an error object if the update fails.
 */
export async function updateSettings(
  supabase: SupabaseClient,
  userId: string, // userId from auth context, settings.userId might differ if admin action
  settings: Settings
): Promise<{ data: Settings | null; error: PostgrestError | null }> { // Updated Signature
  // Convert camelCase keys to snake_case as expected by your database.
  // Ensure user_id from the authenticated context is used for the upsert constraint/filter.
  const settingsData = {
    user_id: userId, 
    app_language: settings.appLanguage,
    language_dialects: settings.languageDialects,
    tts_enabled: settings.ttsEnabled,
    show_difficulty: settings.showDifficulty,
    mastery_threshold: settings.masteryThreshold,
    card_font: settings.cardFont,
    // Pass the existing ID only if it exists in the input settings object
    // This helps Supabase identify the record to update in the upsert.
    ...(settings.id && { id: settings.id }), 
  };

  // Use type for query result
  const { data: rawData, error } = await supabase
    .from("settings")
    .upsert(settingsData, { 
      onConflict: "user_id" // Assuming user_id is the unique constraint for upsert
    })
    .select('*') // Select all columns after upsert
    .returns<RawSettingsQueryResult | null>() // Specify expected structure
    .single(); // Use single() as upsert on unique constraint returns one row

  if (error) {
    console.error("Error updating settings:", error);
    // Return error object
    return { data: null, error }; 
  }

  // Handle case where upsert+select returns no data (unexpected)
  if (!rawData) {
    console.error("No data returned after settings update, though no error reported.");
    return { data: null, error: { message: "Failed to retrieve updated settings data", details: "", hint: "", code: "FETCH_AFTER_UPSERT_FAILED" } };
  }

  // Type-safe transformation (same logic as fetchSettings)
  try {
    const cardFontValue = rawData.card_font as FontOption | null;
    const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');

    const transformedData: Settings = {
      id: rawData.id,
      userId: rawData.user_id, // Use user_id from the returned data
      appLanguage: rawData.app_language ?? 'en',
      languageDialects: rawData.language_dialects ?? {},
      ttsEnabled: rawData.tts_enabled ?? true,
      showDifficulty: rawData.show_difficulty ?? true,
      masteryThreshold: rawData.mastery_threshold ?? DEFAULT_MASTERY_THRESHOLD,
      cardFont: isValidFont && cardFontValue ? cardFontValue : 'default',
    };
    // Return data on success
    return { data: transformedData, error: null };
  } catch (transformError) {
    console.error("Error transforming updated settings data:", transformError);
    // Return transformation error
    return { data: null, error: { message: "Failed to process updated settings data", details: String(transformError), hint: "", code: "SETTINGS_TRANSFORM_ERROR" } };
  }
}