// File: hooks/use-decks.tsx

"use client"

import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useAuth } from "@/hooks/use-auth";
import {
  getDecks as getDecksAction,
  getDeck as getDeckAction,
  createDeck as createDeckAction,
  updateDeck as updateDeckAction,
  deleteDeck as deleteDeckAction
} from "@/lib/actions/deckActions";
import { getDecksFromLocalStorage, saveDecksToLocalStorage } from "@/lib/localStorageUtils";
import type { Database, Tables } from "@/types/database";
import { toast } from "sonner";

// ActionResult interface for consistent error handling
interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

// Type returned by getDeck action
type DeckWithCards = Tables<'decks'> & { cards: Tables<'cards'>[] };

// Types for create/update actions
export interface CreateDeckParams extends Pick<Tables<'decks'>, 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual'> {}
export interface UpdateDeckParams extends Partial<Pick<Tables<'decks'>, 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual'>> {}

// Type for the list state (removed description)
type DeckListItem = Pick<Tables<'decks'>, 'id' | 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual' | 'updated_at'> & { card_count: number };

// Hook return type definition
interface UseDecksReturn {
    decks: DeckListItem[]; // Update state type
    loading: boolean;
    getDeck: (id: string) => Promise<ActionResult<DeckWithCards | null>>;
    createDeck: (params: CreateDeckParams) => Promise<ActionResult<Tables<'decks'>>>;
    updateDeck: (id: string, params: UpdateDeckParams) => Promise<ActionResult<Tables<'decks'>>>;
    deleteDeck: (id: string) => Promise<ActionResult<null>>;
    refetchDecks: () => Promise<void>;
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

/**
 * Hook for managing deck data using Server Actions.
 */
export function useDecks(): UseDecksReturn {
  const [decks, setDecks] = useState<DeckListItem[]>([]); // Update state type
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  // Supabase client might not be needed directly if all logic is in actions
  // const { supabase } = useSupabase(); 

  const fetchDeckList = useCallback(async () => {
        if (!user) { 
           setDecks([]); setLoading(false); return;
      }
      logDecks("Fetching deck list...");
      setLoading(true);
      try {
          // getDecksAction now returns DeckWithCount[]
          const result = await getDecksAction(); 
          if (result.error) {
              logDecksError("Error fetching deck list:", result.error);
              toast.error("Failed to load decks", { description: result.error });
        } else {
              logDecks(`Fetched ${result.data?.length ?? 0} decks.`);
              // Data structure from action should now match DeckListItem
              setDecks(result.data || []); 
          }
      } catch (error) {
          logDecksError("Unexpected error fetching deck list:", error);
          toast.error("Failed to load decks", { description: "An unexpected error occurred." });
      } finally {
        setLoading(false);
      }
  }, [user]);

  useEffect(() => { fetchDeckList(); }, [fetchDeckList]);

  // --- Action Wrappers --- 

  const createDeck = useCallback(async (params: CreateDeckParams): Promise<ActionResult<Tables<'decks'>>> => {
      if (!user) return { data: null, error: "User not authenticated" };
      const result = await createDeckAction(params);
      if (!result.error && result.data) {
          logDecks("Create successful, adding basic info to local state.");
          // Add the new deck's basic info to the local list state
          const newDeckItem: DeckListItem = {
              id: result.data.id,
              name: result.data.name,
              primary_language: result.data.primary_language,
              secondary_language: result.data.secondary_language,
              is_bilingual: result.data.is_bilingual,
              updated_at: result.data.updated_at,
              card_count: 0 // Assume new deck has 0 cards initially
          };
          setDecks((prev) => [newDeckItem, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
          toast.success(`Deck "${newDeckItem.name}" created.`);
      }
       if (result.error) {
            toast.error("Failed to create deck", { description: result.error });
       }
      return result; 
  }, [user]);

  const getDeck = useCallback(async (id: string): Promise<ActionResult<DeckWithCards | null>> => {
       if (!user) return { data: null, error: "User not authenticated" };
       if (!id) return { data: null, error: "Deck ID required" };
       // getDeckAction fetches the full deck with cards
       const result = await getDeckAction(id);
        if (result.error) {
            toast.error("Failed to load deck details", { description: result.error });
       }
       return result; 
  }, [user]);

  const updateDeck = useCallback(async (id: string, params: UpdateDeckParams): Promise<ActionResult<Tables<'decks'>>> => {
       if (!user) return { data: null, error: "User not authenticated" };
       if (!id) return { data: null, error: "Deck ID required" };
       const result = await updateDeckAction(id, params);
       if (!result.error && result.data) {
            logDecks("Update successful, updating local list state.");
            // Update the local list state with potentially changed info
            setDecks((prev) => prev.map(d => d.id === id ? { 
                ...d, 
                ...(params.name && { name: params.name }),
                ...(params.primary_language !== undefined && { primary_language: params.primary_language }),
                ...(params.secondary_language !== undefined && { secondary_language: params.secondary_language }),
                ...(params.is_bilingual !== undefined && { is_bilingual: params.is_bilingual }),
                updated_at: result.data?.updated_at || d.updated_at // Use timestamp from result or keep existing
            } : d).sort((a,b) => a.name.localeCompare(b.name)) );
            toast.success(`Deck "${result.data.name}" updated.`);
       } 
       if (result.error) {
            toast.error("Failed to update deck", { description: result.error });
       }
       return result;
  }, [user]);

  const deleteDeck = useCallback(async (id: string): Promise<ActionResult<null>> => {
      if (!user) return { data: null, error: "User not authenticated" };
      if (!id) return { data: null, error: "Deck ID required" };
      // Optimistic UI: Remove immediately from local state
      const originalDecks = decks;
      setDecks((prev) => prev.filter(d => d.id !== id));
      logDecks("Calling deleteDeck action for ID:", id);
      const result = await deleteDeckAction(id);
       if (result.error) {
            toast.error("Failed to delete deck", { description: result.error });
            // Revert optimistic update on error
            setDecks(originalDecks);
            return { data: null, error: result.error };
       } else {
            logDecks("Delete successful.");
            toast.success("Deck deleted.");
            return { data: null, error: null };
       }
  }, [user, decks]); // Include decks in dependency for optimistic revert


  return {
    decks, // Now DeckListItem[] without description
    loading,
    getDeck, 
    createDeck, 
    updateDeck, 
    deleteDeck, 
    refetchDecks: fetchDeckList 
  };
}