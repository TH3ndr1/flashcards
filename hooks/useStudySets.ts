'use client';

import { useState, useEffect, useCallback } from 'react';
import { getUserStudySets } from '@/lib/actions/studySetActions'; // Adjust path if needed
import type { Database, Tables } from "@/types/database"; // Corrected path to the actual file
import { appLogger, statusLogger } from '@/lib/logger';

// Assuming DbStudySet is the type for rows in your 'study_sets' table
type DbStudySet = Tables<'study_sets'>;

interface UseStudySetsReturn {
  studySets: DbStudySet[];
  isLoading: boolean;
  error: string | null;
  refetchStudySets: () => Promise<void>;
}

/**
 * Custom hook for managing study sets (smart playlists).
 * 
 * This hook provides:
 * - Study set creation, reading, updating, and deletion
 * - Study set state management
 * - Error handling for study set operations
 * - Loading state management
 * 
 * @returns {Object} Study set management functions and state
 * @returns {StudySet[]} returns.studySets - Array of user's study sets
 * @returns {boolean} returns.loading - Whether study set operations are in progress
 * @returns {string | null} returns.error - Error message if any operation fails
 * @returns {(name: string, queryCriteria: StudyQueryCriteria) => Promise<void>} returns.createStudySet - Function to create a new study set
 * @returns {(studySetId: string, updates: Partial<StudySet>) => Promise<void>} returns.updateStudySet - Function to update a study set
 * @returns {(studySetId: string) => Promise<void>} returns.deleteStudySet - Function to delete a study set
 * @returns {() => Promise<void>} returns.refreshStudySets - Function to refresh the study sets list
 */
export function useStudySets(): UseStudySetsReturn {
  const [studySets, setStudySets] = useState<DbStudySet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudySets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    console.log("[useStudySets] Fetching study sets...");
    try {
      const result = await getUserStudySets();
      if (result.error) {
        console.error("[useStudySets] Error fetching study sets:", result.error);
        setError(result.error);
        setStudySets([]); // Clear sets on error
      } else {
        console.log(`[useStudySets] Successfully fetched ${result.data?.length ?? 0} sets.`);
        setStudySets(result.data || []); // Ensure data is an array
      }
    } catch (err) {
      console.error("[useStudySets] Unexpected error during fetch:", err);
      setError('An unexpected error occurred while fetching study sets.');
      setStudySets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchStudySets();
  }, [fetchStudySets]);

  return { studySets, isLoading, error, refetchStudySets: fetchStudySets };
} 