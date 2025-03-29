// File: hooks/use-decks.tsx

"use client"

import { useState, useEffect, useCallback } from "react";
import type { Deck } from "@/types/deck";
import { useSupabase } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
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

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const { settings } = useSettings();

  useEffect(() => {
    const loadDecks = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      // Try to load decks from localStorage as a fallback
      const localDecks = getDecksFromLocalStorage();
      if (localDecks.length > 0) {
        setDecks(localDecks);
      }
      try {
        setLoading(true);
        console.log("Fetching decks for user:", user.id);
        const { data: fetchedDecks, error } = await fetchDecks(supabase, user.id);

        if (error) {
          console.error("Error fetching decks, using local fallback:", error);
          // Keep local decks if fetch fails
          if (localDecks.length > 0) {
             setDecks(localDecks);
          } else {
             setDecks([]); // Ensure it's an empty array if local is also empty
          }
        } else {
          // Use fetched data, default to empty array if null/undefined
          const decksToSet = fetchedDecks || [];
          setDecks(decksToSet);
          saveDecksToLocalStorage(decksToSet);
        }
      } catch (error) { // Catch any unexpected errors during the fetch process itself
        console.error("Detailed error in loadDecks (outside service call):", error);
        if (localDecks.length > 0) {
          console.log("Using local decks as fallback due to unexpected error");
          setDecks(localDecks);
        } else {
          setDecks([]);
        }
      } finally {
        setLoading(false);
      }
    };
    loadDecks();
  }, [user, supabase]);

  const createDeck = useCallback(
    async (params: CreateDeckParams) => {
      if (!user) throw new Error("User not authenticated");
      try {
        const { data: newDeck, error } = await createDeckService(supabase, user.id, params);
        if (error) {
          console.error("Error creating deck:", error);
          throw error; // Re-throw the service error
        }
        if (newDeck) {
          setDecks((prev) => [newDeck, ...prev]);
          const currentDecks = getDecksFromLocalStorage();
          saveDecksToLocalStorage([newDeck, ...currentDecks]);
          return newDeck;
        } else {
           // Should not happen if no error, but handle defensively
          console.error("createDeckService returned no data and no error.");
          throw new Error("Failed to create deck, unexpected result.");
        }
      } catch (error) {
        console.error("Error in createDeck (outside service call):", error);
        throw error;
      }
    },
    [user, supabase]
  );

  const getDeck = useCallback(
    async (id: string) => {
      if (!user) return null;
      try {
        const { data: deck, error } = await getDeckService(supabase, user.id, id);

        if (error) {
          console.error("Error fetching deck:", error);
          throw error; // Re-throw the service error
        }
        
        // deck can be null if not found (handled by getDeckService), this is not an error state
        if (deck) { 
          setDecks((prevDecks) => {
             // Ensure prevDecks is an array before calling findIndex
             if (!Array.isArray(prevDecks)) {
                console.warn("prevDecks is not an array in getDeck, resetting to [deck]");
                return [deck];
             }
            const index = prevDecks.findIndex((d) => d.id === deck.id);
            if (index === -1) {
              return [...prevDecks, deck];
            }
            const newDecks = [...prevDecks];
            newDecks[index] = deck;
            return newDecks;
          });
        }
        return deck; // Return the fetched deck (or null if not found)
      } catch (error) {
        console.error("Error in getDeck (outside service call):", error);
        throw error;
      }
    },
    [user, supabase]
  );

  const updateDeck = useCallback(
    async (updatedDeck: Deck) => {
      if (!user) throw new Error("User not authenticated");
      try {
        const { error } = await updateDeckService(supabase, user.id, updatedDeck);
        if (error) {
          console.error("Error updating deck:", error);
          throw error; // Re-throw the service error
        }
        
        // If no error, update the state and local storage
        setDecks((prev) => {
           if (!Array.isArray(prev)) {
              console.warn("prevDecks is not an array in updateDeck, resetting.");
              // Cannot reliably update, perhaps fetch again or return an error?
              // For now, just return an empty array to avoid crashing.
              return []; 
           }
           return prev.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck));
        });
        
        const currentDecks = getDecksFromLocalStorage();
        const updatedDecks = currentDecks.map((deck: Deck) =>
          deck.id === updatedDeck.id ? updatedDeck : deck
        );
        saveDecksToLocalStorage(updatedDecks);
      } catch (error) {
        console.error("Error in updateDeck (outside service call):", error);
        throw error;
      }
    },
    [user, supabase]
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      if (!user || !id) throw new Error("User not authenticated or invalid deck ID");
      try {
        const { error } = await deleteDeckService(supabase, user.id, id);
        if (error) {
          console.error("Error deleting deck:", error);
          throw error; // Re-throw the service error
        }
        
        // If no error, update state and local storage
        setDecks((prev) => {
           if (!Array.isArray(prev)) {
              console.warn("prevDecks is not an array in deleteDeck, resetting.");
              return [];
           }
           return prev.filter((deck) => deck.id !== id);
        });
        const savedDecks = getDecksFromLocalStorage();
        const updatedDecks = savedDecks.filter((deck: Deck) => deck.id !== id);
        saveDecksToLocalStorage(updatedDecks);
        return true; // Indicate success
      } catch (error) {
        console.error("Error in deleteDeck (outside service call):", error);
        throw error; // Re-throw unexpected errors
      }
    },
    [supabase, user]
  );

  return {
    decks,
    loading,
    getDeck,
    createDeck,
    updateDeck,
    deleteDeck,
  };
}