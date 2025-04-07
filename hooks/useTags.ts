'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTags } from '@/lib/actions/tagActions';
import type { DbTag } from '@/types/database';

interface UseTagsReturn {
  allTags: DbTag[];
  isLoading: boolean;
  error: string | null;
  refetchAllTags: () => Promise<void>;
}

/**
 * Hook to fetch and manage all tags available to the current user.
 * Calls the getTags server action.
 */
export function useTags(): UseTagsReturn {
  const [allTags, setAllTags] = useState<DbTag[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getTags();
      if (result.error) {
        setError(result.error);
        setAllTags([]); // Clear tags on error
      } else {
        setAllTags(result.data || []);
      }
    } catch (err) {
      console.error("Unexpected error fetching all tags:", err);
      setError('An unexpected error occurred while fetching tags.');
      setAllTags([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return { allTags, isLoading, error, refetchAllTags: fetchTags };
} 