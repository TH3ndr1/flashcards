// File: hooks/use-decks.tsx

"use client"

import { useState, useEffect, useCallback } from "react";
import type { Deck } from "@/types/deck";
import { useSupabase } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchDecks,
  createDeckService,
  getDeckService,
  updateDeckService,
  deleteDeckService,
} from "@/lib/deckService";
import { getDecksFromLocalStorage, saveDecksToLocalStorage } from "@/lib/localStorageUtils";

interface CreateDeckParams {
  name: string;
  isBilingual: boolean;
  questionLanguage: string;
  answerLanguage: string;
}

// Conditional logging helpers
const logDecks = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[Decks Hook]:', ...args);
    }
};
const logDecksError = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error('[Decks Hook Error]:', ...args);
    }
};

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const { supabase } = useSupabase();
  const { user } = useAuth();

  useEffect(() => {
    const loadDecks = async () => {
      // --- Guard Clause ---
      // Wait for both user authentication and supabase client initialization
      if (!user || !supabase) {
        logDecks("User or Supabase client not ready yet, skipping deck load.", { hasUser: !!user, hasSupabase: !!supabase });
        // Keep loading true until both are ready, unless there's definitely no user
        if (!user) { 
          setDecks([]); // Ensure decks are empty if no user
          setLoading(false); 
        }
        return;
      }
      // --- End Guard Clause ---

      logDecks("Initiating deck loading for user:", user.id);
      setLoading(true);

      // 1. Try to load initial state from localStorage
      const localDecks = getDecksFromLocalStorage();
      if (localDecks.length > 0) {
        logDecks("Setting initial state from localStorage", localDecks.length, "decks");
        setDecks(localDecks);
      }

      // 2. Fetch from API
      try {
        logDecks("Fetching decks from API...");
        const { data: fetchedDecks, error } = await fetchDecks(supabase, user.id);

        if (error) {
          logDecksError("Error fetching decks from API:", error);
          // Keep current state (which might be from localStorage or previous fetch)
          // No explicit fallback needed here with the simplified strategy
        } else {
          // API fetch successful
          const decksToSet = fetchedDecks || [];
          logDecks("API fetch successful, setting state and saving to localStorage:", decksToSet.length, "decks");
          setDecks(decksToSet);
          saveDecksToLocalStorage(decksToSet);
        }
      } catch (error) { // Catch unexpected errors during the fetch process
        // Improved logging: Log the actual error object
        logDecksError("Unexpected error during loadDecks API call:", error);
        // Keep current state, don't crash
      } finally {
        logDecks("Deck loading process finished.");
        setLoading(false);
      }
    };
    loadDecks();
  }, [user, supabase]);

  const createDeck = useCallback(
    async (params: CreateDeckParams) => {
      // Guard clauses for user and supabase
      if (!user) {
        logDecksError("createDeck failed: User not authenticated.");
        return { data: null, error: new Error("User not authenticated") };
      }
      if (!supabase) {
        logDecksError("createDeck failed: Supabase client not available.");
        return { data: null, error: new Error("Database connection not ready.") };
      }

      try {
        logDecks("Calling createDeckService", params);
        const { data: newDeck, error } = await createDeckService(supabase, user.id, params);
        if (error) {
          logDecksError("Error creating deck:", error);
          return { data: null, error }; // Return error from service
        }
        if (newDeck) {
          logDecks("Deck created successfully, updating state.", newDeck);
          setDecks((prev) => [newDeck, ...prev]);
          return { data: newDeck, error: null };
        } else {
          logDecksError("createDeckService returned no data and no error.");
          return { data: null, error: new Error("Failed to create deck, unexpected result.") };
        }
      } catch (error) {
        logDecksError("Unexpected error in createDeck:", error);
        return { data: null, error: error instanceof Error ? error : new Error("An unexpected error occurred") };
      }
    },
    [user, supabase] // Dependencies remain user and supabase
  );

  const getDeck = useCallback(
    async (id: string) => {
      // Guard clauses for user and supabase
      if (!user) {
        logDecksError("getDeck failed: User not authenticated.");
        return { data: null, error: new Error("User not authenticated") };
      }
       if (!supabase) {
        logDecksError("getDeck failed: Supabase client not available.");
        return { data: null, error: new Error("Database connection not ready.") };
      }
      if (!id) {
        logDecksError("getDeck called without deck ID.");
        return { data: null, error: new Error("Deck ID is required") };
      }
      try {
        logDecks("Calling getDeckService for ID:", id);
        const { data: deck, error } = await getDeckService(supabase, user.id, id);

        if (error) {
          logDecksError("Error fetching deck:", error);
          return { data: null, error }; // Return error from service
        }
        
        // deck can be null if not found (not an error)
        logDecks("getDeckService successful.", deck ? "Deck found." : "Deck not found.");
        return { data: deck, error: null }; // Return the fetched deck (or null if not found)
      } catch (error) {
        logDecksError("Unexpected error in getDeck:", error);
        return { data: null, error: error instanceof Error ? error : new Error("An unexpected error occurred") };
      }
    },
    [user, supabase] // Dependencies remain user and supabase
  );

  const updateDeck = useCallback(
    async (updatedDeck: Deck) => {
      // Guard clauses for user and supabase
      if (!user) {
        logDecksError("updateDeck failed: User not authenticated.");
        return { data: null, error: new Error("User not authenticated") };
      }
      if (!supabase) {
        logDecksError("updateDeck failed: Supabase client not available.");
        return { data: null, error: new Error("Database connection not ready.") };
      }
      if (!updatedDeck || !updatedDeck.id) {
        logDecksError("updateDeck called without valid deck data.");
        return { data: null, error: new Error("Valid deck data with ID is required") };
      }
      try {
        logDecks("Calling updateDeckService for ID:", updatedDeck.id);
        const { error } = await updateDeckService(supabase, user.id, updatedDeck);
        if (error) {
          logDecksError("Error updating deck:", error);
          return { data: null, error }; // Return error from service
        }
        
        logDecks("updateDeckService successful, updating local state.");
        setDecks((prev) => {
           if (!Array.isArray(prev)) {
              logDecksError("prevDecks is not an array in updateDeck! Resetting.");
              return []; // Or maybe return prev to avoid wiping state?
           }
           return prev.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck));
        });
        return { data: updatedDeck, error: null }; // Return updated deck on success

      } catch (error) {
        logDecksError("Unexpected error in updateDeck:", error);
        return { data: null, error: error instanceof Error ? error : new Error("An unexpected error occurred") };
      }
    },
    [user, supabase] // Dependencies remain user and supabase
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      // Guard clauses for user and supabase
      if (!user) {
        logDecksError("deleteDeck failed: User not authenticated.");
        return { success: false, error: new Error("User not authenticated") };
      }
      if (!supabase) {
        logDecksError("deleteDeck failed: Supabase client not available.");
        return { success: false, error: new Error("Database connection not ready.") };
      }
      if (!id) {
        logDecksError("deleteDeck called without deck ID.");
        return { success: false, error: new Error("Deck ID is required") };
      }
      try {
        logDecks("Calling deleteDeckService for ID:", id);
        const { error } = await deleteDeckService(supabase, user.id, id);
        if (error) {
          logDecksError("Error deleting deck:", error);
          return { success: false, error }; // Return error from service
        }
        
        logDecks("deleteDeckService successful, updating local state.");
        setDecks((prev) => {
           if (!Array.isArray(prev)) {
              logDecksError("prevDecks is not an array in deleteDeck! Resetting.");
              return [];
           }
           return prev.filter((deck) => deck.id !== id);
        });
        return { success: true, error: null }; // Indicate success
      } catch (error) {
        logDecksError("Unexpected error in deleteDeck:", error);
        return { success: false, error: error instanceof Error ? error : new Error("An unexpected error occurred") };
      }
    },
    [user, supabase] // Dependencies remain user and supabase
  );

  // Return type needs adjustment based on new callback signatures
  return {
    decks,
    loading,
    getDeck, // Now returns Promise<{ data: Deck | null, error: ...}>
    createDeck, // Now returns Promise<{ data: Deck | null, error: ...}>
    updateDeck, // Now returns Promise<{ data: Deck | null, error: ...}>
    deleteDeck, // Now returns Promise<{ success: boolean, error: ...}>
  };
}