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

/**
 * Debounces a function, ensuring it is only called after a specified delay
 * since the last time it was invoked.
 *
 * @param func The function to debounce.
 * @param wait The number of milliseconds to delay.
 * @returns A debounced version of the function.
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}