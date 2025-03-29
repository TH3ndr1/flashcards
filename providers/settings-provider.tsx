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
  removeMasteredCards?: boolean;
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
  removeMasteredCards: false,
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
  debug('SettingsProvider initializing');

  // Call useSupabase at the top level again.
  // It will initially return { supabase: null }
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
    debug('Settings load effect triggered', { user: user?.id, hasSupabase: !!supabase });
    
    // Wait for both user and supabase client to be available
    if (!user || !supabase) {
      debug('No user or supabase client yet, skipping settings load');
      // If there's no user, settings should be null and loading finished.
      // If there IS a user but no supabase client yet, keep loading until supabase is ready.
      if (!user) {
        setSettings(null); 
        setLoading(false); 
      }
      return;
    }

    const loadSettings = async () => {
      setLoading(true); // Set loading true when starting fetch for a user
      try {
        debug('Loading settings for user', user.id);
        // supabase is guaranteed to be non-null here due to the check above
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
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (unexpectedError) {
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
    // Add supabase to dependency array as the effect depends on it being initialized.
  }, [user, supabase]);

  const updateSettings = useCallback(async (
    updates: Partial<Settings>
  ): Promise<{ success: boolean; error?: PostgrestError | Error | null }> => {
    
    debug('Updating settings', { current: settings, updates, hasSupabase: !!supabase });
    // Ensure supabase client is available before attempting update
    if (!settings || !user || !supabase) {
      debug('Cannot update settings - missing settings, user, or supabase client');
      toast.warning("Cannot save settings", { description: "Connection not ready. Please try again shortly." });
      return { success: false, error: new Error("Supabase client not available") };
    }
    
    const updatedSettings = { ...settings, ...updates };
    setSettings(updatedSettings); // Optimistic update
    
    try {
      // supabase is guaranteed to be non-null here
      const { data: savedData, error } = await updateSettingsInDb(supabase, user.id, updatedSettings);

      if (error) {
        console.error("Failed to update settings in DB:", error);
        debug('Settings update failed', { error });
        toast.error("Error Saving Settings", {
          description: error.message || "Could not save your settings changes.",
        });
        // Revert optimistic update on DB error
        setSettings(settings); 
        return { success: false, error };
      } else {
        debug('Settings updated successfully in DB', savedData);
        // Optional: toast.success("Settings saved!");
        return { success: true };
      }
    } catch (unexpectedError) {
      console.error("Unexpected error during settings update:", unexpectedError);
      debug('Unexpected settings update error');
      toast.error("Error", {
        description: "An unexpected error occurred while saving settings.",
      });
      // Revert optimistic update on unexpected error
      setSettings(settings);
      return { success: false, error: new Error("An unexpected error occurred while saving settings.") };
    }
    // Add supabase to dependency array as the callback depends on it.
  }, [settings, user, supabase]);

  // Log settings changes
  useEffect(() => {
    debug('Settings state changed', { settings, loading, hasSupabase: !!supabase });
  }, [settings, loading, supabase]);

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