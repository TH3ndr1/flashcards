// File: /hooks/use-settings.tsx
"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import { detectSystemLanguage } from "@/lib/utils";
import { fetchSettings, updateSettings as updateSettingsService } from "@/lib/settingsService";

// Define a type for settings
export interface Settings {
  id: string;
  userId: string;
  appLanguage: string;
}

// Default settings function returns default settings using system language and a random id.
const DEFAULT_SETTINGS = (userId: string): Settings => ({
  id: crypto.randomUUID(),
  userId,
  appLanguage: detectSystemLanguage(),
});

export function useSettings() {
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const fetchedSettings = await fetchSettings(supabase, user.id);
        if (fetchedSettings) {
          setSettings(fetchedSettings);
        } else {
          // Fallback to default settings if none are found
          setSettings(DEFAULT_SETTINGS(user.id));
        }
      } catch (err: any) {
        console.error("Error in settings hook:", err);
        setError(err.message || "Error loading settings");
        setSettings(DEFAULT_SETTINGS(user.id));
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [user, supabase]);

  // Renamed updater function to "saveSettings" to avoid collisions with the service's name.
  const saveSettings = async (newSettings: Partial<Settings>) => {
    if (!settings || !user) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      await updateSettingsService(supabase, user.id, updated);
    } catch (err: any) {
      console.error("Failed to update settings:", err);
      setError(err.message || "Error updating settings");
    }
  };

  // Return the settings, loading, error, and updater function under the key "updateSettings"
  return { settings, loading, error, updateSettings: saveSettings };
}