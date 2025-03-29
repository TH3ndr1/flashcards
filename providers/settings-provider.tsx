"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import { detectSystemLanguage } from "@/lib/utils";
import { fetchSettings, updateSettings as updateSettingsInDb } from "@/lib/settingsService";

// Debug flag
const DEBUG = true;

// Debug logging function
const debug = (...args: any[]) => {
  if (DEBUG) {
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
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
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
  updateSettings: async () => {},
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
        return;
      }

      try {
        debug('Loading settings for user', user.id);
        const userSettings = await fetchSettings(supabase, user.id);
        debug('Fetched settings', userSettings);
        
        if (userSettings) {
          debug('Setting user settings', userSettings);
          setSettings(userSettings);
        } else {
          debug('No settings found, using defaults', DEFAULT_SETTINGS);
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
        debug('Error loading settings, using defaults', DEFAULT_SETTINGS);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user, supabase]);

  const updateSettings = useCallback(async (updates: Partial<Settings>) => {
    debug('Updating settings', { current: settings, updates });
    if (!settings || !user) {
      debug('Cannot update settings - no current settings or user');
      return;
    }
    const updatedSettings = { ...settings, ...updates };
    setSettings(updatedSettings);
    try {
      const result = await updateSettingsInDb(supabase, user.id, updatedSettings);
      debug('Settings updated successfully', result);
    } catch (error) {
      console.error("Failed to update settings:", error);
      throw error;
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