'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCardTags } from '@/lib/actions/tagActions';
import type { DbTag } from '@/types/database';

interface UseCardTagsReturn {
  cardTags: DbTag[];
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
 * @param {Object} params - Hook parameters
 * @param {string} params.cardId - ID of the card to manage tags for
 * @returns {Object} Card-tag management functions and state
 * @returns {Tag[]} returns.cardTags - Array of tags assigned to the card
 * @returns {boolean} returns.loading - Whether tag operations are in progress
 * @returns {string | null} returns.error - Error message if any operation fails
 * @returns {(tagId: string) => Promise<void>} returns.addTag - Function to add a tag to the card
 * @returns {(tagId: string) => Promise<void>} returns.removeTag - Function to remove a tag from the card
 * @returns {() => Promise<void>} returns.refreshCardTags - Function to refresh the card's tags
 */
export function useCardTags({ cardId }: { cardId: string }): UseCardTagsReturn {
  const [cardTags, setCardTags] = useState<DbTag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCardTags = useCallback(async () => {
    // Only fetch if cardId is valid
    if (!cardId) {
      setCardTags([]);
      setIsLoading(false);
      setError(null);
      return;
    }

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
      console.error(`Unexpected error fetching tags for card ${cardId}:`, err);
      setError('An unexpected error occurred while fetching card tags.');
      setCardTags([]);
    } finally {
      setIsLoading(false);
    }
  }, [cardId]); // Dependency on cardId

  // Fetch on mount or when cardId changes
  useEffect(() => {
    fetchCardTags();
  }, [fetchCardTags]); // fetchCardTags changes when cardId changes

  return { cardTags, isLoading, error, refetchCardTags: fetchCardTags };
} 