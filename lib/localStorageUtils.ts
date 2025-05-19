// lib/localStorageUtils.ts

import type { Tables } from "@/types/database";
import { appLogger, statusLogger } from '@/lib/logger';

// Define the card type from database, ensuring it aligns with Tables<'cards'>
type DbCard = Tables<'cards'>;

// Extend the DbDeck type to include the cards array
// This local interface represents a deck object as stored in/retrieved from local storage
interface DbDeckLocalStorage extends Tables<'decks'> {
  cards: DbCard[]; // cards array should contain objects matching Tables<'cards'>
}

const STORAGE_KEY = "studyCards-decks";

export function getDecksFromLocalStorage(): DbDeckLocalStorage[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
        appLogger.info("localStorage is not available. Cannot get decks.");
        return [];
    }
    const savedDecks = localStorage.getItem(STORAGE_KEY);
    if (savedDecks) {
      const parsedDecks = JSON.parse(savedDecks) as Array<any>; // Parse as any initially for safety
      if (Array.isArray(parsedDecks)) {
        // Map to ensure structure and snake_case, and keep date strings as strings
        return parsedDecks.map(deck => {
          const { cards, ...deckProperties } = deck;
          return {
            ...deckProperties, // Spread existing deck properties
            cards: Array.isArray(cards) ? cards.map((card: any) => ({
              ...card, // Spread existing card properties
              // Ensure last_reviewed_at remains string | null, matching Tables<'cards'>
              // No Date object conversion here.
            })) : [],
          } as DbDeckLocalStorage; // Assert to the local storage type
        });
      }
    }
  } catch (error) {
    appLogger.error("Error accessing localStorage in getDecksFromLocalStorage:", error);
  }
  return [];
}

export function saveDecksToLocalStorage(decks: DbDeckLocalStorage[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
        appLogger.info("localStorage is not available. Cannot save decks.");
        return;
    }
    // When saving, ensure dates are ISO strings if they were Date objects in memory
    // However, DbDeckLocalStorage already expects last_reviewed_at as string | null
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch (error) {
    appLogger.error("Error saving to localStorage in saveDecksToLocalStorage:", error);
  }
}