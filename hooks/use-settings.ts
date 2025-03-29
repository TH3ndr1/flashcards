import { useContext } from "react";
import { SettingsContext } from "@/providers/settings-provider";
import type { Settings, FontOption } from "@/providers/settings-provider";

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

export type { Settings, FontOption }; 