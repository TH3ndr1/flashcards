"use client";

import { useState, useEffect, useRef } from "react";
import { useDecks } from "./use-decks";
import type { Deck } from "@/types/deck";
import { toast } from "sonner";
import { MAX_DECK_LOAD_RETRIES, DECK_LOAD_RETRY_DELAY_MS } from "@/lib/study-utils"; // Assuming these constants are exported

interface UseDeckLoaderResult {
  loadedDeck: Deck | null;
  isLoadingDeck: boolean;
  deckLoadError: string | null;
}

/**
 * Hook specifically responsible for loading a single deck by ID, including retry logic.
 * @param deckId The ID of the deck to load.
 * @returns An object containing the loaded deck, loading status, and any error message.
 */
export function useDeckLoader(deckId: string | undefined): UseDeckLoaderResult {
  const { getDeck, loading: useDecksLoading } = useDecks();
  const [loadedDeck, setLoadedDeck] = useState<Deck | null>(null);
  const [isLoadingDeck, setIsLoadingDeck] = useState<boolean>(true);
  const [deckLoadError, setDeckLoadError] = useState<string | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    let isMounted = true;
    let result: { data: Deck | null; error: Error | null } | null = null;

    const attemptLoad = async () => {
      if (!deckId) {
        console.warn("useDeckLoader: No deckId provided.");
        if (isMounted) {
          setDeckLoadError("No deck ID specified for loading.");
          setIsLoadingDeck(false);
          setLoadedDeck(null); // Ensure deck is null if no ID
        }
        return;
      }

      // Wait for useDecks hook (and Supabase client) to be ready
      if (useDecksLoading) {
        console.log("useDeckLoader: Waiting for useDecks to initialize...");
        // Keep isLoadingDeck true, wait for the next effect run when useDecksLoading becomes false
        return;
      }

      // Start loading process
      setIsLoadingDeck(true);
      setDeckLoadError(null);
      setLoadedDeck(null); // Reset deck state on new load attempt/retry
      console.log(`useDeckLoader: Attempting load for deck ${deckId}, Retry: ${retryCountRef.current}`);

      try {
        result = await getDeck(deckId);

        if (!isMounted) return; // Component unmounted during async operation

        if (result.error) {
          console.error("useDeckLoader: Failed to load deck:", result.error);
          // Don't retry on explicit errors from getDeck
          toast.error("Error Loading Deck", {
            description: result.error.message || "Could not load the requested deck.",
          });
          setDeckLoadError(result.error.message || "Failed to load deck.");
          setLoadedDeck(null);
        } else if (result.data) {
          // Deck loaded successfully
          console.log("useDeckLoader: Deck loaded successfully:", result.data.name);
          if (!Array.isArray(result.data.cards)) {
              // Data integrity check
              throw new Error("Invalid deck data: 'cards' property is not an array.");
          }
          setLoadedDeck(result.data);
          setDeckLoadError(null);
          retryCountRef.current = 0; // Reset retries on success
        } else {
          // Deck not found (data is null, no error) - Initiate retry logic
          if (retryCountRef.current < MAX_DECK_LOAD_RETRIES) {
            retryCountRef.current++;
            console.warn(`useDeckLoader: Deck ${deckId} not found. Retrying (${retryCountRef.current}/${MAX_DECK_LOAD_RETRIES})...`);
            setTimeout(() => {
              if (isMounted) {
                attemptLoad(); // Re-trigger the load attempt
              }
            }, DECK_LOAD_RETRY_DELAY_MS);
            // Return here to keep isLoadingDeck true while retrying
            return;
          } else {
            // Retries exhausted
            console.error(`useDeckLoader: Deck ${deckId} not found after ${MAX_DECK_LOAD_RETRIES} retries.`);
            toast.error("Deck Not Found", {
              description: "The requested deck could not be found after multiple attempts.",
            });
            setDeckLoadError("Deck not found.");
            setLoadedDeck(null);
          }
        }
      } catch (err) {
        // Catch unexpected errors (e.g., network issues, data integrity check failure)
        console.error("useDeckLoader: Unexpected error during deck load:", err);
        toast.error("Loading Error", {
          description: err instanceof Error ? err.message : "An unexpected error occurred.",
        });
        setDeckLoadError(err instanceof Error ? err.message : "An unknown loading error occurred.");
        setLoadedDeck(null);
      } finally {
        // Set loading to false only when the process is truly finished (success, error, retries exhausted)
        // This check prevents setting isLoading false during the retry delay.
         if (isMounted && (result?.data || result?.error || retryCountRef.current >= MAX_DECK_LOAD_RETRIES)) {
             setIsLoadingDeck(false);
             console.log("useDeckLoader: Loading process finished.");
         }
      }
    };

    // Reset retry count when deckId changes before starting the load
    retryCountRef.current = 0;
    attemptLoad(); // Initial call

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("useDeckLoader: Unmounting or deckId changed.");
      // Optional: Clear any pending timeouts if necessary, though setTimeout is usually safe
    };
  }, [deckId, getDeck, useDecksLoading]); // Effect dependencies

  return { loadedDeck, isLoadingDeck, deckLoadError };
} 