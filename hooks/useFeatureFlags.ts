"use client";

import { useSettings } from "@/providers/settings-provider";
import { useMemo } from "react";

/**
 * Feature flag identifiers
 */
export type FeatureFlagKey = 
  | 'settings_access_enabled'
  | 'edit_functionality_enabled'
  | 'child_mode_enabled';

/**
 * Feature flags interface
 */
export interface FeatureFlags {
  settingsAccess: boolean;
  editFunctionality: boolean;
  childMode: boolean;
}

/**
 * Hook for centralized feature flag management
 * 
 * This hook provides a clean interface to check feature flags throughout the app.
 * It implements the business logic where child mode deactivates other feature flags.
 * 
 * Business Rules:
 * - All feature flags are active by default (true)
 * - When child mode is enabled, other feature flags are deactivated for safety
 * - Child mode itself is always readable (to know if it's enabled)
 * 
 * @returns {object} Feature flags object and utility functions
 */
export function useFeatureFlags() {
  const { settings } = useSettings();

  // Memoize the feature flags calculation to avoid unnecessary re-renders
  const featureFlags: FeatureFlags = useMemo(() => {
    // If settings are not loaded yet, return safe defaults (all disabled except reading child mode)
    if (!settings) {
      return {
        settingsAccess: false,
        editFunctionality: false,
        childMode: false,
      };
    }

    const childModeEnabled = settings.childModeEnabled ?? false;

    return {
      // Child mode status (always readable)
      childMode: childModeEnabled,
      
      // Other feature flags are deactivated when child mode is enabled
      settingsAccess: childModeEnabled ? false : (settings.settingsAccessEnabled ?? true),
      editFunctionality: childModeEnabled ? false : (settings.editFunctionalityEnabled ?? true),
    };
  }, [settings]);

  /**
   * Check if a specific feature is enabled
   * @param feature - The feature flag key to check
   * @returns boolean indicating if the feature is enabled
   */
  const isFeatureEnabled = (feature: keyof FeatureFlags): boolean => {
    return featureFlags[feature];
  };

  /**
   * Check if child mode is currently active
   * @returns boolean indicating if child mode is enabled
   */
  const isChildModeActive = (): boolean => {
    return featureFlags.childMode;
  };

  /**
   * Get all feature flags as an object
   * @returns FeatureFlags object with all current flag states
   */
  const getAllFlags = (): FeatureFlags => {
    return featureFlags;
  };

  return {
    // Feature flag states
    featureFlags,
    
    // Utility functions
    isFeatureEnabled,
    isChildModeActive,
    getAllFlags,
    
    // Individual flag accessors for convenience
    canAccessSettings: featureFlags.settingsAccess,
    canUseEditFunctionality: featureFlags.editFunctionality,
    isChildMode: featureFlags.childMode,
  };
}
