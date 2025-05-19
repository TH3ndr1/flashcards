'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCardTags } from '@/lib/actions/tagActions';
import type { Tables } from '@/types/database';
import { appLogger, statusLogger } from '@/lib/logger';

interface UseCardTagsReturn {
  cardTags: Tables<'tags'>[];
  isLoading: boolean;
  error: string | null;
  refetchCardTags: () => Promise<void>;
}

/**
 * Custom hook for managing card-tag relationships.
 * 
 * This hook provides:
 * - Tag assignment and removal for cards
 * - Card-tag relationship state management
 * - Error handling for tag operations
 * - Loading state management
 * 
 * @param {string} cardId - ID of the card to manage tags for
 * @returns {Object} Card-tag management functions and state
 * @returns {Tag[]} returns.cardTags - Array of tags assigned to the card
 * @returns {boolean} returns.loading - Whether tag operations are in progress
 * @returns {string | null} returns.error - Error message if any operation fails
 * @returns {() => Promise<void>} returns.refreshCardTags - Function to refresh the card's tags
 */
export function useCardTags(cardId: string): UseCardTagsReturn {
  const [cardTags, setCardTags] = useState<Tables<'tags'>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch card tags that can be used in both useEffect and refetch
  const fetchCardTags = useCallback(async () => {
    // Only fetch if cardId is valid
    if (!cardId) {
      appLogger.info(`[useCardTags] Skipping fetch for invalid cardId: ${cardId}`);
      setCardTags([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    appLogger.info(`[useCardTags] Fetching tags for card: ${cardId}`);
    setIsLoading(true);
    setError(null);
    try {
      const result = await getCardTags(cardId);
      if (result.error) {
        setError(result.error);
        setCardTags([]); // Clear tags on error
      } else {
        setCardTags(result.data || []);
      }
    } catch (err) {
      appLogger.error(`Unexpected error fetching tags for card ${cardId}:`, err);
      setError('An unexpected error occurred while fetching card tags.');
      setCardTags([]);
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  // Fetch on mount or when cardId changes
  useEffect(() => {
    appLogger.info(`[useCardTags] useEffect triggered for cardId: ${cardId}`);
    fetchCardTags();
  }, [fetchCardTags, cardId]);

  return { cardTags, isLoading, error, refetchCardTags: fetchCardTags };
} 