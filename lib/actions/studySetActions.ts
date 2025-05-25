"use server";

import { createActionClient } from '@/lib/supabase/server';
import { revalidatePath } from "next/cache";
// import { z } from 'zod'; // No longer needed directly if schemas are imported
import { studyQueryCriteriaSchema } from '@/lib/schema/study-query.schema'; // Import the criteria schema
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
// Import the newly created study set schemas
import { studySetInputSchema, partialStudySetInputSchema } from '@/lib/schema/study-set.schema';
import type { Database, Tables } from "@/types/database"; // Assuming types_db defines Tables<'study_sets'> 
import type { ActionResult } from '@/lib/actions/types'; // Import shared type
import { appLogger, statusLogger } from '@/lib/logger';

// Define DbStudySet based on your types_db or manually if needed
type DbStudySet = Tables<'study_sets'>;

// Zod schema for creating/updating study sets (validates name, description, criteria)
// REMOVE local definition
/*
const studySetInputSchema = z.object({
    name: z.string().trim().min(1, 'Study set name is required').max(100),
    description: z.string().trim().max(500).optional().nullable(),
    criteria: studyQueryCriteriaSchema, // Validate the criteria object
});
*/

// Zod schema for partial updates
// REMOVE local definition
// const partialStudySetInputSchema = studySetInputSchema.partial(); 

// Helper to get Supabase client and user (Ensure correct usage)
async function getSupabaseAndUser() {
  const supabase = createActionClient(); // Use the action client
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    appLogger.error("[getSupabaseAndUser - studySetActions] Auth error:", authError);
    return { supabase: null, user: null, error: authError?.message || 'Authentication required.' }; 
  }
  return { supabase, user, error: null };
}

/**
 * Server actions for managing study sets.
 * 
 * This module provides:
 * - Study set creation, reading, updating, and deletion
 * - Query criteria management
 * - Study set filtering and resolution
 * 
 * @module studySetActions
 */

/**
 * Creates a new study set.
 * 
 * @param {Object} params - Study set creation parameters
 * @param {string} params.name - Name of the study set
 * @param {string} [params.description] - Optional description of the study set
 * @param {StudyQueryCriteria} params.queryCriteria - Query criteria for the study set
 * @returns {Promise<StudySet>} The created study set
 * @throws {Error} If study set creation fails or user is not authenticated
 */
export async function createStudySet(
    data: { name: string; description?: string | null; criteria: StudyQueryCriteria }
): Promise<ActionResult<DbStudySet>> {
    const { supabase, user, error: authError } = await getSupabaseAndUser();
    if (authError || !supabase || !user) {
        return { data: null, error: authError };
    }

    appLogger.info("[createStudySet] User:", user.id, "Input Data:", data);

    // Validate input data
    const validation = studySetInputSchema.safeParse(data);
    if (!validation.success) {
        appLogger.warn("[createStudySet] Validation failed:", validation.error.errors);
        return { data: null, error: validation.error.errors[0].message };
    }

    const { name, description, criteria } = validation.data;

    try {
        const { data: newStudySet, error: insertError } = await supabase
            .from('study_sets')
            .insert({
                user_id: user.id,
                name: name,
                description: description,
                query_criteria: criteria as any, // Cast criteria to 'any' if Supabase types aren't precise for JSONB
            })
            .select()
            .single();

        if (insertError) {
            appLogger.error("[createStudySet] Insert error:", insertError);
            // Handle potential unique name constraint if needed (though not in schema def above)
            // if (insertError.code === '23505') { ... }
            return { data: null, error: 'Failed to create study set.' };
        }

        appLogger.info("[createStudySet] Success, ID:", newStudySet?.id);
        revalidatePath('/practice/sets'); // Revalidate page listing study sets
        return { data: newStudySet, error: null };

    } catch (err) {
        appLogger.error("[createStudySet] Unexpected error:", err);
        return { data: null, error: 'An unexpected error occurred.' };
    }
}

/**
 * Fetches all study sets for the current user.
 * 
 * @returns {Promise<StudySet[]>} Array of user's study sets
 * @throws {Error} If study set fetch fails or user is not authenticated
 */
export async function getUserStudySets(): Promise<ActionResult<DbStudySet[]>> {
    const { supabase, user, error: authError } = await getSupabaseAndUser();
    if (authError || !supabase || !user) {
        return { data: null, error: authError };
    }

    appLogger.info("[getUserStudySets] User:", user.id);

    try {
        const { data: studySets, error: fetchError } = await supabase
            .from('study_sets')
            .select('*') // Select all columns
            .eq('user_id', user.id)
            .order('name', { ascending: true }); // Order by name

        if (fetchError) {
            appLogger.error("[getUserStudySets] Fetch error:", fetchError);
            return { data: null, error: 'Failed to fetch study sets.' };
        }

        appLogger.info(`[getUserStudySets] Found ${studySets?.length ?? 0} sets.`);
        return { data: studySets || [], error: null };

    } catch (err) {
        appLogger.error("[getUserStudySets] Unexpected error:", err);
        return { data: null, error: 'An unexpected error occurred.' };
    }
}

/**
 * Fetches a single study set by its ID.
 * 
 * @param {Object} params - Study set fetch parameters
 * @param {string} params.studySetId - ID of the study set to fetch
 * @returns {Promise<StudySet>} The fetched study set
 * @throws {Error} If study set fetch fails or user is not authenticated
 */
export async function getStudySet(studySetId: string): Promise<ActionResult<DbStudySet | null>> {
    const { supabase, user, error: authError } = await getSupabaseAndUser();
    if (authError || !supabase || !user) {
        return { data: null, error: authError };
    }

    // Basic ID validation
    if (!studySetId || typeof studySetId !== 'string') {
        return { data: null, error: 'Invalid Study Set ID provided.' };
    }

    appLogger.info("[getStudySet] User:", user.id, "Set ID:", studySetId);

    try {
        const { data: studySet, error: fetchError } = await supabase
            .from('study_sets')
            .select('*')
            .eq('id', studySetId)
            .eq('user_id', user.id) // Ensure user ownership
            .maybeSingle(); // Use maybeSingle to return null if not found

        if (fetchError) {
            appLogger.error("[getStudySet] Fetch error:", fetchError);
            return { data: null, error: 'Failed to fetch study set.' };
        }

        if (!studySet) {
            appLogger.info("[getStudySet] Not found or unauthorized for ID:", studySetId);
             // Return null data but not necessarily an error if simply not found
             return { data: null, error: null }; 
        }

        appLogger.info("[getStudySet] Found:", studySet.id);
        return { data: studySet, error: null };

    } catch (err) {
        appLogger.error("[getStudySet] Unexpected error:", err);
        return { data: null, error: 'An unexpected error occurred.' };
    }
}

/**
 * Updates an existing study set.
 * 
 * @param {Object} params - Study set update parameters
 * @param {string} params.studySetId - ID of the study set to update
 * @param {Partial<StudySet>} params.updates - Partial study set object containing fields to update
 * @returns {Promise<StudySet>} The updated study set
 * @throws {Error} If study set update fails or user is not authenticated
 */
export async function updateStudySet(
    studySetId: string,
    data: Partial<{ name: string; description: string | null; criteria: StudyQueryCriteria }> 
): Promise<ActionResult<DbStudySet>> {
    const { supabase, user, error: authError } = await getSupabaseAndUser();
    if (authError || !supabase || !user) {
        return { data: null, error: authError };
    }

    if (!studySetId || typeof studySetId !== 'string') {
        return { data: null, error: 'Invalid Study Set ID provided.' };
    }
    
    // Validate the partial input data 
    const validation = partialStudySetInputSchema.safeParse(data);
     if (!validation.success) {
        appLogger.warn("[updateStudySet] Validation failed:", validation.error.errors);
        return { data: null, error: validation.error.errors[0].message };
    }
    
    const updateData = validation.data;

    // Ensure there's something to update
    if (Object.keys(updateData).length === 0) {
         return { data: null, error: "No update data provided." };
    }

    appLogger.info("[updateStudySet] User:", user.id, "Set ID:", studySetId, "Update Data:", updateData);

    try {
        // Update and fetch the updated row
        const { data: updatedStudySet, error: updateError } = await supabase
            .from('study_sets')
            .update({
                name: updateData.name,
                description: updateData.description,
                query_criteria: updateData.criteria, // Map criteria to query_criteria
                updated_at: new Date().toISOString(), // Explicitly set updated_at
             })
            .eq('id', studySetId)
            .eq('user_id', user.id) // Ensure user ownership
            .select()
            .single();

        if (updateError) {
            appLogger.error("[updateStudySet] Update error:", updateError);
            // Handle potential unique name constraint if name is being updated
             // if (updateError.code === '23505') { ... }
            return { data: null, error: 'Failed to update study set.' };
        }
        
        if (!updatedStudySet) {
             // This might happen if the ID didn't exist or RLS failed
             appLogger.warn("[updateStudySet] Update affected 0 rows for ID:", studySetId);
             return { data: null, error: 'Study set not found or update failed.' };
        }

        appLogger.info("[updateStudySet] Success, ID:", updatedStudySet.id);
        revalidatePath('/practice/sets'); // Revalidate list page
        revalidatePath(`/study-sets/${studySetId}`); // Revalidate specific set page (if exists)
        return { data: updatedStudySet, error: null };

    } catch (err) {
        appLogger.error("[updateStudySet] Unexpected error:", err);
        return { data: null, error: 'An unexpected error occurred.' };
    }
}

/**
 * Deletes a study set.
 * 
 * @param {Object} params - Study set deletion parameters
 * @param {string} params.studySetId - ID of the study set to delete
 * @returns {Promise<void>}
 * @throws {Error} If study set deletion fails or user is not authenticated
 */
export async function deleteStudySet(studySetId: string): Promise<ActionResult<null>> {
    const { supabase, user, error: authError } = await getSupabaseAndUser();
    if (authError || !supabase || !user) {
        return { data: null, error: authError };
    }

     if (!studySetId || typeof studySetId !== 'string') {
        return { data: null, error: 'Invalid Study Set ID provided.' };
    }

    appLogger.info("[deleteStudySet] User:", user.id, "Set ID:", studySetId);

    try {
        const { error: deleteError, count } = await supabase
            .from('study_sets')
            .delete()
            .eq('id', studySetId)
            .eq('user_id', user.id); // Ensure user ownership

        if (deleteError) {
            appLogger.error("[deleteStudySet] Delete error:", deleteError);
            return { data: null, error: 'Failed to delete study set.' };
        }
        
        if (count === 0) {
             appLogger.warn("[deleteStudySet] Delete affected 0 rows for ID:", studySetId);
             // Don't necessarily return error if it just wasn't found
             // return { data: null, error: 'Study set not found or not authorized.' };
        }

        appLogger.info("[deleteStudySet] Success for ID:", studySetId);
        revalidatePath('/practice/sets'); // Revalidate list page
        return { data: null, error: null }; // Success

    } catch (err) {
        appLogger.error("[deleteStudySet] Unexpected error:", err);
        return { data: null, error: 'An unexpected error occurred.' };
    }
}

/**
 * Alias for getUserStudySets to maintain backward compatibility
 */
export const getStudySets = getUserStudySets; 

// Define the type for a study set augmented with its total card count
// This should match the structure of public.study_set_with_total_count from the SQL migration
export type StudySetWithTotalCount = Tables<'study_sets'> & {
    total_card_count: number;
};

/**
 * Fetches all study sets for the current user, each augmented with its total card count.
 * 
 * @returns {Promise<ActionResult<StudySetWithTotalCount[]>>} Array of user's study sets with counts.
 * @throws {Error} If fetching fails or user is not authenticated.
 */
export async function getUserStudySetsWithCounts(): Promise<ActionResult<StudySetWithTotalCount[]>> {
    const { supabase, user, error: authError } = await getSupabaseAndUser();
    if (authError || !supabase || !user) {
        return { data: null, error: authError };
    }

    appLogger.info("[getUserStudySetsWithCounts] User:", user.id);

    try {
        const { data: studySetsWithCounts, error: rpcError } = await supabase.rpc(
            'get_user_study_sets_with_total_counts' as any, // Cast to any for new RPC
            { p_user_id: user.id }
        );

        if (rpcError) {
            appLogger.error("[getUserStudySetsWithCounts] RPC error:", rpcError);
            return { data: null, error: 'Failed to fetch study sets with counts.' };
        }

        // The RPC returns an array of objects matching StudySetWithTotalCount
        // Ensure the data is correctly typed and nulls are handled for total_card_count
        const resultData: StudySetWithTotalCount[] = (studySetsWithCounts || []).map((set: any) => ({
            ...set,
            total_card_count: Number(set.total_card_count ?? 0)
        }));

        appLogger.info(`[getUserStudySetsWithCounts] Found ${resultData.length} sets with counts.`);
        return { data: resultData, error: null };

    } catch (err) {
        appLogger.error("[getUserStudySetsWithCounts] Unexpected error:", err);
        return { data: null, error: 'An unexpected error occurred.' };
    }
} 