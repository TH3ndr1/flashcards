import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Tables } from "@/types/database";
import { appLogger, statusLogger } from '@/lib/logger';

/**
 * General utility functions for the application.
 * 
 * This module provides:
 * - Object transformation utilities
 * - Type conversion helpers
 * - Common helper functions
 * 
 * @module utils
 */

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

/**
 * Converts object keys from camelCase to snake_case.
 * 
 * @param {Object} obj - The object to convert
 * @returns {Object} A new object with snake_case keys
 */
export function convertPayloadToSnakeCase(obj: Record<string, any>): Record<string, any> {
  const newObj: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      newObj[snakeKey] = obj[key];
    }
  }
  return newObj;
}

/**
 * Converts object keys from snake_case to camelCase.
 * 
 * @param {Object} obj - The object to convert
 * @returns {Object} A new object with camelCase keys
 */
export function convertPayloadToCamelCase(obj: Record<string, any>): Record<string, any> {
  const newObj: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      newObj[camelKey] = obj[key];
    }
  }
  return newObj;
}

// --- Update type to include language fields ---
type SwappableCardFields = {
  question?: string | null;
  answer?: string | null;
  questionPartOfSpeech?: string | null;
  questionGender?: string | null;
  answerPartOfSpeech?: string | null;
  answerGender?: string | null;
  // Add language fields
  questionLanguage?: string | null;
  answerLanguage?: string | null;
  // Allow other properties
  [key: string]: any;
};
// ------------------------------------------

/**
* Swaps question/answer content, classifications, and languages.
* Returns a new object with swapped fields, preserving other properties.
* Handles null/undefined values correctly during the swap.
*
* @template T - An object type that includes SwappableCardFields (like ApiFlashcard)
* @param {T} card - The card object to swap fields for.
* @returns {T} A new card object with swapped fields.
*/
export function swapCardFields<T extends SwappableCardFields>(card: T): T {
  // Clone the original card object
  const swappedCard = { ...card };

  // Swap core text content
  const tempQuestion = swappedCard.question;
  swappedCard.question = swappedCard.answer;
  swappedCard.answer = tempQuestion;

  // Swap classification fields
  const tempQPos = swappedCard.questionPartOfSpeech;
  swappedCard.questionPartOfSpeech = swappedCard.answerPartOfSpeech;
  swappedCard.answerPartOfSpeech = tempQPos;

  const tempQGender = swappedCard.questionGender;
  swappedCard.questionGender = swappedCard.answerGender;
  swappedCard.answerGender = tempQGender;

  // --- NEW: Swap language fields ---
  const tempQLang = swappedCard.questionLanguage;
  swappedCard.questionLanguage = swappedCard.answerLanguage;
  swappedCard.answerLanguage = tempQLang;
  // --------------------------------

  appLogger.info('[swapCardFields] Swapped card data (incl. languages):', { original: card, swapped: swappedCard });
  return swappedCard;
}