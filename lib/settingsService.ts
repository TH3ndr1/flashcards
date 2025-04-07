// File: lib/settingsService.ts

import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
// Ensure Settings type imported here includes srs_algorithm
// Adjust the import path if your provider/type is located elsewhere
import type { Settings, FontOption } from '@/providers/settings-provider'; 
import { DEFAULT_MASTERY_THRESHOLD } from '@/lib/study-utils'; // Adjust path if needed

// --- Helper Type for raw Supabase query result ---
interface RawSettingsQueryResult {
  id?: string; // ID might not always be selected or present
  user_id: string;
  app_language: string | null;
  language_dialects: Record<string, string> | null; // Assuming JSONB storing simple key-value pairs
  tts_enabled: boolean | null;
  show_difficulty: boolean | null;
  mastery_threshold: number | null;
  card_font: string | null; // Raw value from DB might be string
  srs_algorithm: string | null; // Added srs_algorithm field
}
// --- End Helper Type ---

// Define default dialects structure based on the expected Settings type
const DEFAULT_DIALECTS = {
  en: '',
  nl: '',
  fr: '',
  de: '',
  es: '',
  it: '',
  // Add other required keys if the error message implies more
};

/**
 * Fetches the settings for a given user from the Supabase "settings" table.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user whose settings are to be fetched.
 * @returns {Promise<{ data: Settings | null; error: PostgrestError | Error | null }>} 
 *          An object containing the fetched settings on success,
 *          null data if not found, or an error object if the fetch fails.
 */
export async function fetchSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Settings | null; error: PostgrestError | Error | null }> {
  const { data: rawData, error } = await supabase
    .from('settings')
    .select('*') // Selects all columns, including srs_algorithm
    .eq('user_id', userId)
    .returns<RawSettingsQueryResult | null>() // Use the updated raw type
    .maybeSingle();

  if (error) {
    console.error('Error fetching settings:', error);
    return { data: null, error }; 
  }

  if (!rawData) {
    // No settings found for user, return null data (not an error)
    return { data: null, error: null }; 
  }

  // Type-safe transformation
  try {
    // Explicitly assert the type now that we know rawData is not null
    const checkedRawData = rawData as RawSettingsQueryResult;

    // Validate font, default if invalid
    const cardFontValue = checkedRawData.card_font as FontOption | null; 
    const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');
    const cardFontFinal = isValidFont && cardFontValue ? cardFontValue : 'default';
      
    // Validate SRS algorithm value, default to 'sm2'
    const srsAlgoValue = checkedRawData.srs_algorithm === 'fsrs' ? 'fsrs' : 'sm2';
      
    const transformedData: Settings = {
      // These properties must match the Settings type exactly
      appLanguage: checkedRawData.app_language ?? 'en',
      languageDialects: { 
        ...DEFAULT_DIALECTS, 
        ...(checkedRawData.language_dialects || {}) 
      },
      ttsEnabled: checkedRawData.tts_enabled ?? true,
      showDifficulty: checkedRawData.show_difficulty ?? true,
      masteryThreshold: checkedRawData.mastery_threshold ?? DEFAULT_MASTERY_THRESHOLD,
      cardFont: cardFontFinal,
      srs_algorithm: srsAlgoValue, // Map srs_algorithm here
    };
    return { data: transformedData, error: null };
  } catch (transformError) {
    // Catch errors during transformation (e.g., unexpected data format)
    console.error("Error transforming settings data:", transformError);
    // Ensure the error object is constructed correctly
    const errorMsg = transformError instanceof Error ? transformError.message : String(transformError);
    return { data: null, error: new Error(`Failed to process settings data: ${errorMsg}`) };
  }
}

/**
 * Updates (or upserts) the settings for a given user in the Supabase "settings" table.
 * This function uses an upsert to create the settings record if it doesn't exist.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user whose settings are being updated.
 * @param {Settings} settings - The complete settings object with updated values (must include srs_algorithm).
 * @returns {Promise<{ data: Settings | null; error: PostgrestError | Error | null }>} 
 *          An object containing the updated settings on success,
 *          or an error object if the update fails.
 */
export async function updateSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: Settings // Input Settings object already includes srs_algorithm
): Promise<{ data: Settings | null; error: PostgrestError | Error | null }> {
  
  // Map the application Settings type to the DB structure for upsert
  const settingsData = {
    user_id: userId, 
    app_language: settings.appLanguage,
    language_dialects: settings.languageDialects,
    tts_enabled: settings.ttsEnabled,
    show_difficulty: settings.showDifficulty,
    mastery_threshold: settings.masteryThreshold,
    card_font: settings.cardFont,
    srs_algorithm: settings.srs_algorithm, // Include srs_algorithm in data to upsert
  };

  const { data: rawData, error } = await supabase
    .from("settings")
    .upsert(settingsData, { 
      onConflict: "user_id" // Specify the constraint for upsert
    })
    .select('*') // Select all columns after upsert
    .returns<RawSettingsQueryResult | null>() // Use updated raw type
    .single(); // Use single() as upsert on conflict should always affect/return one row

  if (error) {
    console.error("Error updating settings:", error);
    return { data: null, error }; 
  }

  if (!rawData) {
    // This case might indicate an issue if single() was expected to return data
    console.error("No data returned after settings update, though no direct error reported.");
    return { data: null, error: new Error("Failed to retrieve updated settings data after upsert.") }; 
  }

  // Type-safe transformation (same logic as fetchSettings)
  try {
    const checkedRawData = rawData as RawSettingsQueryResult;
    const cardFontValue = checkedRawData.card_font as FontOption | null;
    const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');
    const cardFontFinal = isValidFont && cardFontValue ? cardFontValue : 'default';
    const srsAlgoValue = checkedRawData.srs_algorithm === 'fsrs' ? 'fsrs' : 'sm2';

    const transformedData: Settings = {
      appLanguage: checkedRawData.app_language ?? 'en',
      languageDialects: { 
        ...DEFAULT_DIALECTS, 
        ...(checkedRawData.language_dialects || {}) 
      },
      ttsEnabled: checkedRawData.tts_enabled ?? true,
      showDifficulty: checkedRawData.show_difficulty ?? true,
      masteryThreshold: checkedRawData.mastery_threshold ?? DEFAULT_MASTERY_THRESHOLD,
      cardFont: cardFontFinal,
      srs_algorithm: srsAlgoValue, // Map srs_algorithm here
    };
    return { data: transformedData, error: null };
  } catch (transformError) {
    console.error("Error transforming updated settings data:", transformError);
    const errorMsg = transformError instanceof Error ? transformError.message : String(transformError);
    return { data: null, error: new Error(`Failed to process updated settings data: ${errorMsg}`) }; 
  }
}