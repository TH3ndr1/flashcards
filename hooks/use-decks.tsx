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
        const fetchedDecks = await fetchDecks(supabase, user.id);
        setDecks(fetchedDecks);
        saveDecksToLocalStorage(fetchedDecks);
      } catch (error) {
        console.error("Detailed error in loadDecks:", error);
        if (localDecks.length > 0) {
          console.log("Using local decks as fallback");
          setDecks(localDecks);
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
        const newDeck = await createDeckService(supabase, user.id, params);
        setDecks((prev) => [newDeck, ...prev]);
        const currentDecks = getDecksFromLocalStorage();
        saveDecksToLocalStorage([newDeck, ...currentDecks]);
        return newDeck;
      } catch (error) {
        console.error("Error in createDeck:", error);
        throw error;
      }
    },
    [user, supabase]
  );

  const getDeck = useCallback(
    async (id: string) => {
      if (!user) return null;
      try {
        const deck = await getDeckService(supabase, user.id, id);
        if (deck) {
          setDecks((prevDecks) => {
            const index = prevDecks.findIndex((d) => d.id === deck.id);
            if (index === -1) {
              return [...prevDecks, deck];
            }
            const newDecks = [...prevDecks];
            newDecks[index] = deck;
            return newDecks;
          });
        }
        return deck;
      } catch (error) {
        console.error("Error in getDeck:", error);
        throw error;
      }
    },
    [user, supabase]
  );

  const updateDeck = useCallback(
    async (updatedDeck: Deck) => {
      if (!user) throw new Error("User not authenticated");
      try {
        await updateDeckService(supabase, user.id, updatedDeck);
        setDecks((prev) =>
          prev.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck))
        );
        const currentDecks = getDecksFromLocalStorage();
        const updatedDecks = currentDecks.map((deck: Deck) =>
          deck.id === updatedDeck.id ? updatedDeck : deck
        );
        saveDecksToLocalStorage(updatedDecks);
      } catch (error) {
        console.error("Error in updateDeck:", error);
        throw error;
      }
    },
    [user, supabase]
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      if (!user || !id) throw new Error("User not authenticated or invalid deck ID");
      try {
        await deleteDeckService(supabase, user.id, id);
        setDecks((prev) => prev.filter((deck) => deck.id !== id));
        const savedDecks = getDecksFromLocalStorage();
        const updatedDecks = savedDecks.filter((deck: Deck) => deck.id !== id);
        saveDecksToLocalStorage(updatedDecks);
        return true;
      } catch (error) {
        console.error("Error in deleteDeck:", error);
        throw error;
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