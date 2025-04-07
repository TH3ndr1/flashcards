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
 * Hook to fetch and manage tags associated with a specific card.
 * Calls the getCardTags server action.
 * @param cardId The ID of the card whose tags are to be fetched.
 */
export function useCardTags(cardId: string | null | undefined): UseCardTagsReturn {
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