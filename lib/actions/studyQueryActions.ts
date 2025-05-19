"use server";

import { createActionClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { StudyQueryCriteriaSchema, type StudyQueryCriteria, type ResolvedCardId } from "@/lib/schema/study-query.schema";
import { getStudySet } from '@/lib/actions/studySetActions'; // Import action to get study set details
import { ZodError } from 'zod';
import type { Database, Json } from "@/types/database"; // Import Json type if not global
import type { ActionResult } from '@/lib/actions/types'; // Import shared type
import { appLogger, statusLogger } from '@/lib/logger';

/**
 * Server actions for resolving study queries and fetching card IDs.
 * 
 * This module provides:
 * - Query resolution for study sets and criteria
 * - Card ID fetching based on query criteria
 * - Integration with database functions for complex queries
 * 
 * @module studyQueryActions
 */

// Define the expected input shape (either criteria or studySetId)
type ResolveStudyQueryInput = 
  | { criteria: StudyQueryCriteria; studySetId?: never } 
  | { criteria?: never; studySetId: string };

/**
 * Resolves a study query to get matching card IDs.
 * 
 * @param {Object} params - Query parameters
 * @param {StudyQueryCriteria} params.queryCriteria - The query criteria to resolve
 * @param {string} [params.studySetId] - Optional study set ID to use predefined criteria
 * @returns {Promise<string[]>} Array of card IDs matching the query
 * @throws {Error} If query resolution fails or user is not authenticated
 */
export async function resolveStudyQuery(
  input: ResolveStudyQueryInput
): Promise<ActionResult<string[]>> {
  // const cookieStore = cookies(); // No longer needed for createActionClient
  const supabase = createActionClient(); // Use the action client consistent with other actions

  // 1. Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    appLogger.error('Auth error in resolveStudyQuery:', authError);
    return { data: null, error: 'Authentication required.' };
  }

  let criteriaToUse: StudyQueryCriteria | null = null;
  let validationError: string | null = null;

  // 2. Determine and Validate Criteria
  try {
    if ('studySetId' in input && input.studySetId) {
        appLogger.info("[resolveStudyQuery] Resolving via studySetId:", input.studySetId);
        // Fetch the study set
        const studySetResult = await getStudySet(input.studySetId);

        if (studySetResult.error) {
            appLogger.error(`[resolveStudyQuery] Error fetching study set ${input.studySetId}:`, studySetResult.error);
            return { data: null, error: studySetResult.error };
        }
        if (!studySetResult.data) {
            appLogger.warn(`[resolveStudyQuery] Study set ${input.studySetId} not found or not authorized.`);
            return { data: null, error: 'Study set not found.' };
        }

        // Validate the criteria fetched from the study set
        // Supabase stores JSONB as any/unknown, so parse it.
        try {
          const parsedCriteria = StudyQueryCriteriaSchema.safeParse(studySetResult.data.query_criteria);
          if (!parsedCriteria.success) {
            appLogger.error(`[resolveStudyQuery] Invalid criteria found in study set ${input.studySetId}:`, parsedCriteria.error.errors);
            // Instead of failing, use a safe default criteria
            appLogger.info("[resolveStudyQuery] Using safe default criteria for malformed study set");
            criteriaToUse = {
              allCards: true,
              tagLogic: 'ANY',
            };
          } else {
            criteriaToUse = parsedCriteria.data;
          }
        } catch (err) {
          appLogger.error(`[resolveStudyQuery] Error parsing study set criteria:`, err);
          // Fallback to safe default criteria
          criteriaToUse = {
            allCards: true,
            tagLogic: 'ANY',
          };
        }
        
    } else if ('criteria' in input && input.criteria) {
        appLogger.info("[resolveStudyQuery] Resolving via provided criteria:", input.criteria);
        // Validate the provided criteria
        const parsedCriteria = StudyQueryCriteriaSchema.safeParse(input.criteria);
         if (!parsedCriteria.success) {
             appLogger.error('[resolveStudyQuery] Invalid criteria provided:', parsedCriteria.error.errors);
             validationError = `Invalid query criteria: ${parsedCriteria.error.errors.map(e => e.message).join(', ')}`;
         } else {
            criteriaToUse = parsedCriteria.data;
         }
    } else {
         appLogger.error('[resolveStudyQuery] Invalid input: Neither criteria nor studySetId provided.');
         validationError = 'Invalid input: Must provide either criteria or studySetId.';
    }

    // Handle validation errors from either path
    if (validationError) {
         return { data: null, error: validationError };
    }
    
    // Ensure criteria were successfully determined
    if (!criteriaToUse) {
         appLogger.error('[resolveStudyQuery] Criteria could not be determined from input.');
         return { data: null, error: 'Failed to determine study criteria.' };
    }

    // 3. RPC Call to the Database Function
    appLogger.info("[resolveStudyQuery] Calling RPC with criteria:", criteriaToUse);
    const { data, error: rpcError } = await supabase.rpc(
      'resolve_study_query', 
      {
        p_user_id: user.id,
        // Cast criteriaToUse to Json if Supabase types require it, otherwise direct pass should work
        p_query_criteria: criteriaToUse as unknown as Json, 
        // TODO: Potentially pass orderby info if needed from criteria or separate param?
        // p_order_by_field: criteriaToUse.orderBy?.field ?? 'created_at', 
        // p_order_by_direction: criteriaToUse.orderBy?.direction ?? 'DESC' 
      }
    );

    if (rpcError) {
      appLogger.error('Supabase RPC error in resolveStudyQuery:', rpcError);
      return { data: null, error: 'Failed to retrieve study cards. Please try again.' };
    }

    // Log the raw data received from RPC for inspection
    appLogger.info("[resolveStudyQuery] Raw RPC data:", JSON.stringify(data, null, 2));

    // 4. Process and Return Data
    // The RPC function directly returns an array of UUID strings.
    // No mapping is needed.
    const cardIds: string[] = data ? data : []; 
    
    // Log the mapped card IDs for inspection
    appLogger.info("[resolveStudyQuery] Final cardIds array:", JSON.stringify(cardIds, null, 2)); // Renamed log

    appLogger.info(`[resolveStudyQuery] Resolved ${cardIds.length} card IDs.`);
    return { data: cardIds, error: null };

  } catch (error) {
    // Catch unexpected errors during the process
    appLogger.error('Unexpected error in resolveStudyQuery:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
} 