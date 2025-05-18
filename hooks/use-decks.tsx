// hooks/useDecks.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getDecks as getDecksAction,
  getDeck as getDeckAction,
  createDeck as createDeckAction,
  updateDeck as updateDeckAction,
  deleteDeck as deleteDeckAction,
  type DeckListItemWithCounts
} from '@/lib/actions/deckActions';
import type { Database, Tables } from "@/types/database";
import type { ActionResult } from "@/lib/actions/types";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

import type { CreateDeckInput as CreateDeckParams, UpdateDeckInput as UpdateDeckParams } from '@/lib/schema/deckSchemas';
import type { DeckWithCardsAndTags } from '@/lib/actions/deckActions';

// Export these types so they can be used by other modules
export type { UpdateDeckParams, DeckWithCardsAndTags };

type DeckListItem = DeckListItemWithCounts;

interface UseDecksReturn {
    decks: DeckListItem[];
    loading: boolean;
    error: string | null;
    getDeck: (id: string) => Promise<ActionResult<DeckWithCardsAndTags | null>>;
    createDeck: (params: CreateDeckParams) => Promise<ActionResult<Tables<'decks'>>>;
    updateDeck: (id: string, params: UpdateDeckParams) => Promise<ActionResult<Tables<'decks'>>>;
    deleteDeck: (id: string) => Promise<ActionResult<null>>;
    refetchDecks: () => Promise<void>;
}

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

export function useDecks(): UseDecksReturn {
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const isFetchingList = useRef(false);

  const fetchDeckList = useCallback(async () => {
    if (authLoading || !user) {
      setDecks([]);
      setLoading(false);
      setError(null);
      if (!authLoading) logDecks("No user, clearing deck list.");
      return;
    }
    if (isFetchingList.current) {
      logDecks("Fetch already in progress, skipping.");
      return;
    }
    logDecks("Fetching deck list via getDecksAction (which uses new RPC)...");
    setLoading(true);
    setError(null);
    isFetchingList.current = true;
    try {
      const result = await getDecksAction();
      if (result.error) {
        logDecksError("Error fetching deck list:", result.error);
        toast.error("Failed to load decks", { description: result.error });
        setDecks([]);
        setError(result.error);
      } else {
        logDecks(`Fetched ${result.data?.length ?? 0} decks.`);
        setDecks(result.data || []);
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
      logDecksError("Unexpected error fetching deck list:", errorMessage);
      toast.error("Failed to load decks", { description: errorMessage });
      setDecks([]);
      setError(errorMessage);
    } finally {
      setLoading(false);
      isFetchingList.current = false;
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchDeckList();
  }, [fetchDeckList]);

  const createDeck = useCallback(async (params: CreateDeckParams): Promise<ActionResult<Tables<'decks'>>> => {
    if (!user) return { data: null, error: "User not authenticated" };
    const toastId = toast.loading("Creating deck...");
    const result = await createDeckAction(params);

    if (!result.error && result.data) {
      toast.success(`Deck "${result.data.name}" created.`, { id: toastId });
      const newDeckItem: DeckListItem = {
        id: result.data.id,
        name: result.data.name,
        primary_language: result.data.primary_language,
        secondary_language: result.data.secondary_language,
        is_bilingual: result.data.is_bilingual,
        // FIX: Ensure updated_at is handled correctly. If DB guarantees it, direct assignment is fine.
        // If action might return null for it, provide a fallback.
        // The DB schema for decks defines updated_at as string | null.
        // The RPC get_decks_with_complete_srs_counts defines updated_at as timestamptz (non-null).
        // Assuming the action for createDeck returns it non-null as per its SELECT.
        updated_at: result.data.updated_at || new Date().toISOString(), // Fallback if create action somehow returns null
        new_count: 0, learning_count: 0, young_count: 0, mature_count: 0,
        learn_eligible_count: 0, review_eligible_count: 0,
      };
      setDecks((prev) => [...prev, newDeckItem].sort((a, b) => a.name.localeCompare(b.name)));
    } else if (result.error) {
      logDecksError("Create action failed:", result.error);
      toast.error("Failed to create deck", { id: toastId, description: result.error });
    }
    return result;
  }, [user]);

  const getDeck = useCallback(async (id: string): Promise<ActionResult<DeckWithCardsAndTags | null>> => {
    if (!user) return { data: null, error: "User not authenticated" };
    if (!id) return { data: null, error: "Deck ID required" };
    const result = await getDeckAction(id);
    if (result.error) {
      toast.error("Failed to load deck details", { description: result.error });
    }
    return result;
  }, [user]);

  const updateDeck = useCallback(async (id: string, params: UpdateDeckParams): Promise<ActionResult<Tables<'decks'>>> => {
    if (!user) return { data: null, error: "User not authenticated" };
    if (!id) return { data: null, error: "Deck ID required" };
    logDecks("Calling updateDeck action for ID:", id, "with params:", params);
    const result = await updateDeckAction(id, params);
    if (!result.error && result.data) {
      logDecks("Update action successful for ID:", id);
      toast.success(`Deck "${result.data.name}" updated.`);
      await fetchDeckList();
    } else if (result.error) {
      logDecksError("Update action failed for ID:", id, "Error:", result.error);
      toast.error("Failed to update deck", { description: result.error });
    }
    return result;
  }, [user, fetchDeckList]);

  const deleteDeck = useCallback(async (id: string): Promise<ActionResult<null>> => {
    if (!user) return { data: null, error: "User not authenticated" };
    if (!id) return { data: null, error: "Deck ID required" };

    const originalDecks = decks;
    setDecks((prev) => prev.filter(d => d.id !== id));
    const toastId = toast.loading("Deleting deck...");
    logDecks("Calling deleteDeck action for ID:", id);
    const result = await deleteDeckAction(id);

    if (result.error) {
      toast.error("Failed to delete deck", { id: toastId, description: result.error });
      logDecksError("Delete action failed for ID:", id, "Error:", result.error);
      setDecks(originalDecks);
    } else {
      logDecks("Delete action successful for ID:", id);
      toast.success("Deck deleted.", { id: toastId });
    }
    return result;
  }, [user, decks]);

  const refetchDecks = useCallback(async () => {
    logDecks("Explicit refetch triggered.");
    await fetchDeckList();
  }, [fetchDeckList]);

  return {
    decks,
    loading,
    error,
    getDeck,
    createDeck,
    updateDeck,
    deleteDeck,
    refetchDecks,
  };
}