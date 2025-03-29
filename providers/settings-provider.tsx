"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import { detectSystemLanguage } from "@/lib/utils";
import { fetchSettings, updateSettings as updateSettingsInDb } from "@/lib/settingsService";
import { toast } from "sonner";
import type { PostgrestError } from "@supabase/supabase-js";

// Debug flag
const DEBUG = true;

// Debug logging function
const debug = (...args: any[]) => {
  // Only log if DEBUG is true AND not in production environment
  if (DEBUG && process.env.NODE_ENV !== 'production') {
    console.warn('[Settings Debug]:', ...args);
  }
};

// Define a type for available fonts
export type FontOption = "default" | "opendyslexic" | "atkinson";

// Define a type for settings
export interface Settings {
  appLanguage: string;
  cardFont: FontOption;
  showDifficulty: boolean;
  masteryThreshold: number;
  ttsEnabled: boolean;
  languageDialects: {
    en: string;
    nl: string;
    fr: string;
    de: string;
    es: string;
    it: string;
  };
}

interface SettingsContextType {
  settings: Settings | null;
  updateSettings: (updates: Partial<Settings>) => Promise<{ success: boolean; error?: PostgrestError | Error | null }>;
  loading: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  appLanguage: "en",
  cardFont: "default",
  showDifficulty: true,
  masteryThreshold: 3,
  ttsEnabled: true,
  languageDialects: {
    en: "en-GB",
    nl: "nl-NL",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    it: "it-IT",
  },
};

export const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  updateSettings: async () => ({ success: false, error: new Error("Provider not initialized") }),
  loading: true,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  debug('SettingsProvider initializing'); // Initial debug log

  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // Log initial mount
  useEffect(() => {
    debug('SettingsProvider mounted');
    return () => debug('SettingsProvider unmounting');
  }, []);

  useEffect(() => {
    debug('Settings effect triggered', { user: user?.id });
    
    const loadSettings = async () => {
      if (!user) {
        debug('No user, skipping settings load');
        setLoading(false);
        setSettings(null); // Ensure settings are null if no user
        return;
      }

      setLoading(true); // Set loading true when starting fetch for a user
      try {
        debug('Loading settings for user', user.id);
        const { data: userSettings, error } = await fetchSettings(supabase, user.id);

        if (error) {
          console.error("Failed to load settings:", error);
          debug('Error loading settings, using defaults', DEFAULT_SETTINGS);
          toast.error("Failed to load settings", {
            description: error.message || "Using default settings.",
          });
          setSettings(DEFAULT_SETTINGS);
        } else if (userSettings) {
          debug('Setting user settings', userSettings);
          setSettings(userSettings);
        } else {
          debug('No settings found, using defaults', DEFAULT_SETTINGS);
          // No error, but no settings saved yet for this user
          setSettings(DEFAULT_SETTINGS);
          // Optionally, could trigger an initial save here if desired:
          // await updateSettingsInDb(supabase, user.id, DEFAULT_SETTINGS);
        }
      } catch (unexpectedError) {
        // Catch errors not originating from fetchSettings itself (e.g., programming errors)
        console.error("Unexpected error during settings load:", unexpectedError);
        debug('Unexpected error, using defaults', DEFAULT_SETTINGS);
         toast.error("Error", {
          description: "An unexpected error occurred while loading settings. Using default values.",
        });
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user, supabase]);

  const updateSettings = useCallback(async (
    updates: Partial<Settings>
  ): Promise<{ success: boolean; error?: PostgrestError | Error | null }> => {
    debug('Updating settings', { current: settings, updates });
    if (!settings || !user) {
      debug('Cannot update settings - no current settings or user');
      // Indicate failure, no specific error object needed
      return { success: false, error: null };
    }
    
    // Optimistically update local state
    const updatedSettings = { ...settings, ...updates };
    setSettings(updatedSettings);
    
    try {
      const { data: savedData, error } = await updateSettingsInDb(supabase, user.id, updatedSettings);

      if (error) { // This is a PostgrestError
        console.error("Failed to update settings in DB:", error);
        debug('Settings update failed', { error });
        toast.error("Error Saving Settings", {
          description: error.message || "Could not save your settings changes.",
        });
        return { success: false, error }; // Return the PostgrestError
      } else {
        debug('Settings updated successfully in DB', savedData);
        return { success: true };
      }
    } catch (unexpectedError) {
      console.error("Unexpected error during settings update:", unexpectedError);
      debug('Unexpected settings update error');
      toast.error("Error", {
        description: "An unexpected error occurred while saving settings.",
      });
      // Return a standard Error object
      return { success: false, error: new Error("An unexpected error occurred while saving settings.") };
    }
  }, [settings, user, supabase]);

  // Log settings changes
  useEffect(() => {
    debug('Settings state changed', { settings, loading });
  }, [settings, loading]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

// Custom hook to use the settings context
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
} 