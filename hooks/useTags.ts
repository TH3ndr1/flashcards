'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTags } from '@/lib/actions/tagActions';
import type { Tables } from '@/types/database';

interface UseTagsReturn {
  allTags: Tables<'tags'>[];
  isLoading: boolean;
  error: string | null;
  refetchAllTags: () => Promise<void>;
}

/**
 * Custom hook for managing tag operations and state.
 * 
 * This hook provides:
 * - Tag creation, reading, updating, and deletion
 * - Tag state management
 * - Error handling for tag operations
 * - Loading state management
 * 
 * @returns {Object} Tag management functions and state
 * @returns {Tag[]} returns.tags - Array of user's tags
 * @returns {boolean} returns.loading - Whether tag operations are in progress
 * @returns {string | null} returns.error - Error message if any operation fails
 * @returns {(name: string) => Promise<void>} returns.createTag - Function to create a new tag
 * @returns {(tagId: string, newName: string) => Promise<void>} returns.updateTag - Function to update a tag's name
 * @returns {(tagId: string) => Promise<void>} returns.deleteTag - Function to delete a tag
 * @returns {() => Promise<void>} returns.refreshTags - Function to refresh the tags list
 */
export function useTags(): UseTagsReturn {
  const [allTags, setAllTags] = useState<Tables<'tags'>[]>([]);
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