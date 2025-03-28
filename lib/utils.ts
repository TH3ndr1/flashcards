import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Detects the user's system language based on the browser settings.
 * Returns a language code (e.g., "en", "fr") or a default of "en" if unavailable.
 */
export function detectSystemLanguage(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    // Return only the primary language (e.g., "en" from "en-US")
    return navigator.language.split('-')[0];
  }
  // Fallback default language
  return "en";
}