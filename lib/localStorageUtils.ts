// File: lib/localStorageUtils.ts

import type { Deck } from "@/types/deck";

const STORAGE_KEY = "studyCards-decks";

export function getDecksFromLocalStorage(): Deck[] {
  try {
    const savedDecks = localStorage.getItem(STORAGE_KEY);
    if (savedDecks) {
      const parsedDecks = JSON.parse(savedDecks);
      if (Array.isArray(parsedDecks)) {
        return parsedDecks.map(deck => ({
          ...deck,
          cards: deck.cards.map((card: any) => ({
            ...card,
            lastStudied: card.lastStudied ? new Date(card.lastStudied) : null,
          })),
        }));
      }
    }
  } catch (error) {
    console.error("Error accessing localStorage:", error);
  }
  return [];
}

export function saveDecksToLocalStorage(decks: Deck[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}