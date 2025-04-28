// hooks/use-decks.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSupabase } from "@/hooks/use-supabase"; // Ensure this is used if needed, otherwise remove
import { useAuth } from "@/hooks/use-auth";
// Import server actions for deck operations
import {
  getDecks as getDecksAction,
  getDeck as getDeckAction,
  createDeck as createDeckAction,
  updateDeck as updateDeckAction,
  deleteDeck as deleteDeckAction
} from "@/lib/actions/deckActions";
// Optional: If using local storage caching (currently commented out)
// import { getDecksFromLocalStorage, saveDecksToLocalStorage } from "@/lib/localStorageUtils";
// Import necessary types
import type { Database, Tables } from "@/types/database";
import { toast } from "sonner"; // For user feedback

// ActionResult interface for consistent return type from actions/wrappers
interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

// --- Type Definitions Updated for Tags AND Stage Counts ---

// Base type for a deck with associated tags (from deckActions)
type DeckWithTags = Tables<'decks'> & { tags: Tables<'tags'>[] };

// Type returned by the getDeck action (includes cards AND tags)
export type DeckWithCardsAndTags = DeckWithTags & { cards: Tables<'cards'>[] };

// Types for the parameters expected by create/update actions/wrappers
export interface CreateDeckParams extends Pick<Tables<'decks'>, 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual'> {}
export interface UpdateDeckParams extends Partial<Pick<Tables<'decks'>, 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual'>> {}

// Type for the items stored in the local 'decks' state list
// This now matches the return type of the modified getDecksAction
type DeckListItem = {
    id: string;
    name: string;
    primary_language: string | null;
    secondary_language: string | null;
    is_bilingual: boolean | null;
    updated_at: string | null;
    new_count: number;
    learning_count: number;
    young_count: number;
    mature_count: number;
    // Note: Tags are NOT currently returned by the RPC function.
    // If needed, they would need to be added to the function or fetched separately.
    // tags: Tables<'tags'>[];
};
// -----------------------------------------

// Define the structure of the object returned by the useDecks hook
interface UseDecksReturn {
    decks: DeckListItem[]; // Use the updated DeckListItem type
    loading: boolean;
    getDeck: (id: string) => Promise<ActionResult<DeckWithCardsAndTags | null>>;
    createDeck: (params: CreateDeckParams) => Promise<ActionResult<Tables<'decks'>>>;
    updateDeck: (id: string, params: UpdateDeckParams) => Promise<ActionResult<Tables<'decks'>>>;
    deleteDeck: (id: string) => Promise<ActionResult<null>>;
    refetchDecks: () => Promise<void>;
}

// --- Conditional Logging ---
// Avoid logging spam in production builds
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
 * Custom hook for managing and interacting with deck data.
 * Provides functions to fetch, create, update, and delete decks using server actions,
 * while managing a local state for the list of decks suitable for display components.
 */
export function useDecks(): UseDecksReturn {
  // State for storing the list of decks - Use the updated DeckListItem type
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const isFetchingList = useRef(false);

  // Function to fetch the list of decks from the server action
  const fetchDeckList = useCallback(async () => {
        // Don't fetch if user isn't loaded or doesn't exist
        if (authLoading || !user) {
           setDecks([]); // Clear decks if no user
           setLoading(false); // Stop loading if no user
           if (!authLoading) logDecks("No user, clearing deck list.");
           return;
        }
        // --- Prevent concurrent fetches --- 
        if (isFetchingList.current) { 
            logDecks("Fetch already in progress, skipping.");
            return;
        }
        // ---------------------------------
      logDecks("Fetching deck list via RPC..."); // Updated log message
      setLoading(true);
      isFetchingList.current = true;
      try {
          // Call the server action (which now calls the RPC)
          const result = await getDecksAction();
          if (result.error) {
              logDecksError("Error fetching deck list:", result.error);
              toast.error("Failed to load decks", { description: result.error });
              setDecks([]);
          } else {
              logDecks(`Fetched ${result.data?.length ?? 0} decks via RPC.`);
              // Data structure from action should match DeckListItem
              setDecks(result.data || []); // No cast needed if action type is correct
          }
      } catch (error) {
          logDecksError("Unexpected error fetching deck list:", error);
          toast.error("Failed to load decks", { description: "An unexpected error occurred." });
          setDecks([]);
      } finally {
        setLoading(false);
        isFetchingList.current = false;
      }
  }, [user, authLoading]);

  // Effect to fetch the deck list
  useEffect(() => {
      fetchDeckList();
  }, [fetchDeckList]);

  // --- Action Wrappers ---
  // These functions wrap the server actions, handle loading states (if needed specifically per action),
  // manage optimistic UI updates, and provide user feedback via toasts.

  /**
   * Creates a new deck by calling the server action.
   * Optimistically updates the local deck list state upon success.
   */
  const createDeck = useCallback(async (params: CreateDeckParams): Promise<ActionResult<Tables<'decks'>>> => {
      if (!user) return { data: null, error: "User not authenticated" };

      const toastId = toast.loading("Creating deck..."); 
      const result = await createDeckAction(params);

      if (!result.error && result.data) {
          toast.success(`Deck "${result.data.name}" created.`, { id: toastId });

          // --- Optimistic UI update needs the new counts (initially zero) ---
          const newDeckItem: DeckListItem = {
              id: result.data.id,
              name: result.data.name,
              primary_language: result.data.primary_language,
              secondary_language: result.data.secondary_language,
              is_bilingual: result.data.is_bilingual,
              updated_at: result.data.updated_at,
              new_count: 0, // Initialize counts to 0
              learning_count: 0,
              young_count: 0,
              mature_count: 0,
              // tags: [] // If tags were included, initialize here
          };
          setDecks((prev) => [...prev, newDeckItem].sort((a,b) => a.name.localeCompare(b.name)));
          // -------------------------------------------------------------------------

      } else if (result.error) {
          logDecksError("Create action failed:", result.error);
          toast.error("Failed to create deck", { id: toastId, description: result.error });
      }
      return result;
  }, [user]);

  /**
   * Fetches the full details of a single deck, including its cards and tags.
   */
  const getDeck = useCallback(async (id: string): Promise<ActionResult<DeckWithCardsAndTags | null>> => {
       if (!user) return { data: null, error: "User not authenticated" };
       if (!id) return { data: null, error: "Deck ID required" };

       // Optionally show loading state specifically for getDeck if needed elsewhere
       // const toastId = toast.loading("Loading deck details...");
       const result = await getDeckAction(id); // Call server action

        if (result.error) {
            // toast.error("Failed to load deck details", { id: toastId, description: result.error });
            toast.error("Failed to load deck details", { description: result.error });
       } else {
            // toast.dismiss(toastId);
       }
       // Return the raw result from the server action
       return result as ActionResult<DeckWithCardsAndTags | null>; // Cast if needed
  }, [user]); // Dependency: user state

  /**
   * Updates an existing deck's metadata by calling the server action.
   * IMPORTANT: Does NOT update the local 'decks' list state to prevent loops
   * when called from the Edit Deck page's auto-save.
   */
  const updateDeck = useCallback(async (id: string, params: UpdateDeckParams): Promise<ActionResult<Tables<'decks'>>> => {
       if (!user) return { data: null, error: "User not authenticated" };
       if (!id) return { data: null, error: "Deck ID required" };

       // Optionally show loading toast if needed for manual updates elsewhere
       // const toastId = toast.loading(`Updating deck...`);
       logDecks("Calling updateDeck action for ID:", id, "with params:", params);
       const result = await updateDeckAction(id, params); // Call server action

       // Handle TOAST notification based on result
       if (!result.error && result.data) {
            logDecks("Update action successful for ID:", id);
            // --- FIX: NO setDecks CALL HERE ---
            // The component initiating the update (e.g., Edit Page)
            // handles refreshing its own state. Updating the global list here
            // causes re-render loops in the Edit Page's auto-save scenario.
            // We only show the success toast.
            // ---------------------------------
            toast.success(`Deck "${result.data.name}" updated.`); // Keep toast notification
       } else if (result.error) {
            logDecksError("Update action failed for ID:", id, "Error:", result.error);
            toast.error("Failed to update deck", { description: result.error });
       }
       // Return the raw result from the server action
       return result;
  // Dependency: user state
  }, [user]);


  /**
   * Deletes a deck by calling the server action.
   * Optimistically updates the local 'decks' list state.
   */
  const deleteDeck = useCallback(async (id: string): Promise<ActionResult<null>> => {
      if (!user) return { data: null, error: "User not authenticated" };
      if (!id) return { data: null, error: "Deck ID required" };

      // Store original decks for potential revert on error
      const originalDecks = decks;
      // Optimistic UI: Remove immediately from local state
      setDecks((prev) => prev.filter(d => d.id !== id));
      const toastId = toast.loading("Deleting deck..."); // Show loading toast
      logDecks("Calling deleteDeck action for ID:", id);
      const result = await deleteDeckAction(id); // Call server action

       if (result.error) {
            // Action failed, update toast and revert local state
            toast.error("Failed to delete deck", { id: toastId, description: result.error });
            logDecksError("Delete action failed for ID:", id, "Error:", result.error);
            setDecks(originalDecks); // Revert list state
            return { data: null, error: result.error };
       } else {
            // Action successful, update toast
            logDecks("Delete action successful for ID:", id);
            toast.success("Deck deleted.", { id: toastId });
            return { data: null, error: null };
       }
  // Dependencies: user and the 'decks' state for reverting optimistic update
  }, [user, decks]);

  // refetchDecks function uses the updated fetchDeckList
  const refetchDecks = useCallback(async () => {
    logDecks("Explicit refetch triggered.");
    await fetchDeckList();
  }, [fetchDeckList]);

  // Return the hook's public API
  return {
    decks,
    loading,
    getDeck,
    createDeck,
    updateDeck,
    deleteDeck,
    refetchDecks,
  };
}