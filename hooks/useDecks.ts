'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDecks } from '@/lib/actions/deckActions'; // Assuming this action exists now
import type { Database, Tables } from "@/types/database"; // Ensure correct path

type DbDeck = Tables<'decks'>; // Get the full DbDeck type

interface UseDecksReturn {
  decks: Pick<DbDeck, 'id' | 'name'>[]; // Return only id and name as fetched by getDecks
  isLoading: boolean;
  error: string | null;
  refetchDecks: () => Promise<void>;
}

/**
 * Custom hook for managing deck operations and state.
 * 
 * This hook provides:
 * - Deck creation, reading, updating, and deletion
 * - Deck state management
 * - Error handling for deck operations
 * - Loading state management
 * 
 * @returns {Object} Deck management functions and state
 * @returns {Deck[]} returns.decks - Array of user's decks
 * @returns {boolean} returns.loading - Whether deck operations are in progress
 * @returns {string | null} returns.error - Error message if any operation fails
 * @returns {(title: string, description?: string) => Promise<void>} returns.createDeck - Function to create a new deck
 * @returns {(deckId: string, updates: Partial<Deck>) => Promise<void>} returns.updateDeck - Function to update a deck
 * @returns {(deckId: string) => Promise<void>} returns.deleteDeck - Function to delete a deck
 * @returns {() => Promise<void>} returns.refreshDecks - Function to refresh the decks list
 */
export function useDecks(): UseDecksReturn {
  const [decks, setDecks] = useState<Pick<DbDeck, 'id' | 'name'>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDecks();
      if (result.error) {
        setError(result.error);
        setDecks([]); // Clear decks on error
      } else {
        // Ensure data is an array, default to empty array if null/undefined
        setDecks(result.data || []); 
      }
    } catch (err) {
      console.error("Unexpected error fetching decks:", err);
      setError('An unexpected error occurred while fetching decks.');
      setDecks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  return { decks, isLoading, error, refetchDecks: fetchDecks };
} 