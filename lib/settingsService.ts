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
    .select('*')
    .eq('user_id', userId)
    .returns<RawSettingsQueryResult | null>()
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

    const cardFontValue = checkedRawData.card_font as FontOption | null; 
    const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');
      
    const transformedData: Settings = {
      // id: checkedRawData.id, // REMOVED
      // userId: checkedRawData.user_id, // REMOVED - userId is context, not part of settings data model
      appLanguage: checkedRawData.app_language ?? 'en',
      // Merge DB dialects onto defaults to ensure all keys exist
      languageDialects: { 
        ...DEFAULT_DIALECTS, 
        ...(checkedRawData.language_dialects || {}) 
      },
      ttsEnabled: checkedRawData.tts_enabled ?? true,
      showDifficulty: checkedRawData.show_difficulty ?? true,
      masteryThreshold: checkedRawData.mastery_threshold ?? DEFAULT_MASTERY_THRESHOLD,
      cardFont: isValidFont && cardFontValue ? cardFontValue : 'default',
    };
    return { data: transformedData, error: null };
  } catch (transformError) {
    // Keep catch block in case casting or unexpected data causes issues
    console.error("Error transforming settings data:", transformError);
    return { data: null, error: new Error(`Failed to process settings data: ${transformError}`) };
  }
}

/**
 * Updates (or upserts) the settings for a given user in the Supabase "settings" table.
 * This function uses an upsert to create the settings record if it doesn't exist.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user whose settings are being updated.
 * @param {Settings} settings - The complete settings object with updated values.
 * @returns {Promise<{ data: Settings | null; error: PostgrestError | Error | null }>} 
 *          An object containing the updated settings on success,
 *          or an error object if the update fails.
 */
export async function updateSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: Settings
): Promise<{ data: Settings | null; error: PostgrestError | Error | null }> {
  
  const settingsData = {
    user_id: userId, 
    app_language: settings.appLanguage,
    language_dialects: settings.languageDialects,
    tts_enabled: settings.ttsEnabled,
    show_difficulty: settings.showDifficulty,
    mastery_threshold: settings.masteryThreshold,
    card_font: settings.cardFont,
  };

  const { data: rawData, error } = await supabase
    .from("settings")
    .upsert(settingsData, { 
      onConflict: "user_id"
    })
    .select('*')
    .returns<RawSettingsQueryResult | null>()
    .single();

  if (error) {
    console.error("Error updating settings:", error);
    return { data: null, error }; 
  }

  if (!rawData) {
    console.error("No data returned after settings update, though no error reported.");
    return { data: null, error: new Error("Failed to retrieve updated settings data after upsert.") }; 
  }

  // Type-safe transformation
  try {
    // Explicitly assert the type now that we know rawData is not null
    const checkedRawData = rawData as RawSettingsQueryResult;

    const cardFontValue = checkedRawData.card_font as FontOption | null;
    const isValidFont = ['default', 'opendyslexic', 'atkinson'].includes(cardFontValue ?? '');

    const transformedData: Settings = {
      // id: checkedRawData.id, // REMOVED
      // userId: checkedRawData.user_id, // REMOVED
      appLanguage: checkedRawData.app_language ?? 'en',
      // Merge DB dialects onto defaults
      languageDialects: { 
        ...DEFAULT_DIALECTS, 
        ...(checkedRawData.language_dialects || {}) 
      },
      ttsEnabled: checkedRawData.tts_enabled ?? true,
      showDifficulty: checkedRawData.show_difficulty ?? true,
      masteryThreshold: checkedRawData.mastery_threshold ?? DEFAULT_MASTERY_THRESHOLD,
      cardFont: isValidFont && cardFontValue ? cardFontValue : 'default',
    };
    return { data: transformedData, error: null };
  } catch (transformError) {
    console.error("Error transforming updated settings data:", transformError);
    return { data: null, error: new Error(`Failed to process updated settings data: ${transformError}`) }; 
  }
}