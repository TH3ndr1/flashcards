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
export type ResolveStudyQueryInput = 
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

// New server action to get card count
export async function getStudySetCardCountByCriteria(
  input: ResolveStudyQueryInput
): Promise<ActionResult<number>> {
  const supabase = createActionClient();

  // 1. Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    appLogger.error('Auth error in getStudySetCardCountByCriteria:', authError);
    return { data: null, error: 'Authentication required.' };
  }

  let criteriaToUse: StudyQueryCriteria | null = null;
  let validationError: string | null = null;

  // 2. Determine and Validate Criteria (similar to resolveStudyQuery)
  try {
    if ('studySetId' in input && input.studySetId) {
      appLogger.info("[getStudySetCardCountByCriteria] Resolving via studySetId:", input.studySetId);
      const studySetResult = await getStudySet(input.studySetId);
      if (studySetResult.error) {
        appLogger.error(`[getStudySetCardCountByCriteria] Error fetching study set ${input.studySetId}:`, studySetResult.error);
        return { data: null, error: studySetResult.error };
      }
      if (!studySetResult.data) {
        appLogger.warn(`[getStudySetCardCountByCriteria] Study set ${input.studySetId} not found or not authorized.`);
        return { data: null, error: 'Study set not found.' };
      }
      try {
        // Ensure query_criteria is parsed against the updated schema
        const parsedCriteria = StudyQueryCriteriaSchema.safeParse(studySetResult.data.query_criteria);
        if (!parsedCriteria.success) {
          appLogger.error(`[getStudySetCardCountByCriteria] Invalid criteria in study set ${input.studySetId}:`, parsedCriteria.error.errors);
          criteriaToUse = { allCards: true, tagLogic: 'ANY' }; // Safe default
        } else {
          criteriaToUse = parsedCriteria.data;
        }
      } catch (err) {
        appLogger.error(`[getStudySetCardCountByCriteria] Error parsing study set criteria:`, err);
        criteriaToUse = { allCards: true, tagLogic: 'ANY' }; // Fallback
      }
    } else if ('criteria' in input && input.criteria) {
      appLogger.info("[getStudySetCardCountByCriteria] Resolving via provided criteria:", input.criteria);
      // Validate the provided criteria against the updated schema
      const parsedCriteria = StudyQueryCriteriaSchema.safeParse(input.criteria);
      if (!parsedCriteria.success) {
        appLogger.error('[getStudySetCardCountByCriteria] Invalid criteria provided:', parsedCriteria.error.errors);
        validationError = `Invalid query criteria: ${parsedCriteria.error.errors.map(e => e.message).join(', ')}`;
      } else {
        criteriaToUse = parsedCriteria.data;
      }
    } else {
      appLogger.error('[getStudySetCardCountByCriteria] Invalid input: Neither criteria nor studySetId provided.');
      validationError = 'Invalid input: Must provide either criteria or studySetId.';
    }

    if (validationError) {
      return { data: null, error: validationError };
    }
    if (!criteriaToUse) {
      appLogger.error('[getStudySetCardCountByCriteria] Criteria could not be determined.');
      return { data: null, error: 'Failed to determine study criteria.' };
    }

    // 3. RPC Call to get_study_set_card_count
    appLogger.info("[getStudySetCardCountByCriteria] Calling RPC get_study_set_card_count with criteria:", criteriaToUse);
    const { data: count, error: rpcError } = await supabase.rpc(
      'get_study_set_card_count', 
      {
        p_user_id: user.id,
        p_query_criteria: criteriaToUse as unknown as Json,
      }
    );

    if (rpcError) {
      appLogger.error('Supabase RPC error in getStudySetCardCountByCriteria:', rpcError);
      return { data: null, error: 'Failed to retrieve card count. Please try again.' };
    }

    appLogger.info(`[getStudySetCardCountByCriteria] Received count: ${count}`);
    // Ensure the returned data is a number, or null if the RPC somehow didn't error but returned nothing.
    return { data: typeof count === 'number' ? count : null, error: null };

  } catch (error) {
    appLogger.error('Unexpected error in getStudySetCardCountByCriteria:', error);
    return { data: null, error: 'An unexpected error occurred while counting cards.' };
  }
}

// Server action to get count of "Learn New" cards for a given source
export async function getLearnNewCardCountForSource(
  input: ResolveStudyQueryInput
): Promise<ActionResult<number>> {
  const baseCriteriaResult = await getBaseCriteria(input);

  if (baseCriteriaResult.error || !baseCriteriaResult.data) {
    // Log the error from getBaseCriteria before returning
    appLogger.error('[getLearnNewCardCountForSource] Failed to get base criteria:', baseCriteriaResult.error);
    return { data: null, error: baseCriteriaResult.error || "Failed to get base criteria." };
  }
  // Construct criteria with srsFilter for 'new' cards
  const criteria: StudyQueryCriteria = { 
    ...baseCriteriaResult.data, 
    srsFilter: 'new' // Using the new srsFilter field
  };
  appLogger.info("[getLearnNewCardCountForSource] Criteria for count:", criteria);
  // Call the main count function with the modified criteria
  return getStudySetCardCountByCriteria({ criteria }); 
}

// Server action to get count of "Review Due" cards for a given source
export async function getReviewDueCardCountForSource(
  input: ResolveStudyQueryInput
): Promise<ActionResult<number>> {
  const baseCriteriaResult = await getBaseCriteria(input);

  if (baseCriteriaResult.error || !baseCriteriaResult.data) {
    // Log the error from getBaseCriteria before returning
    appLogger.error('[getReviewDueCardCountForSource] Failed to get base criteria:', baseCriteriaResult.error);
    return { data: null, error: baseCriteriaResult.error || "Failed to get base criteria." };
  }
  // Construct criteria with srsFilter for 'due' cards
  const criteria: StudyQueryCriteria = { 
    ...baseCriteriaResult.data, 
    srsFilter: 'due' // Using the new srsFilter field
  };
  appLogger.info("[getReviewDueCardCountForSource] Criteria for count:", criteria);
  // Call the main count function with the modified criteria
  return getStudySetCardCountByCriteria({ criteria });
}

// Helper function to get base criteria from input (studySetId or direct criteria)
// This function should also parse against the updated StudyQueryCriteriaSchema
export async function getBaseCriteria(
  input: ResolveStudyQueryInput
): Promise<ActionResult<StudyQueryCriteria>> {
  if ('studySetId' in input && input.studySetId) {
    const studySetResult = await getStudySet(input.studySetId);
    if (studySetResult.error || !studySetResult.data) {
      appLogger.error(`[getBaseCriteria] Error fetching study set ${input.studySetId}:`, studySetResult.error);
      return { data: null, error: studySetResult.error || 'Study set not found.' };
    }
    try {
      // Parse against the updated schema
      const parsedCriteria = StudyQueryCriteriaSchema.safeParse(studySetResult.data.query_criteria);
      if (!parsedCriteria.success) {
        appLogger.error(`[getBaseCriteria] Invalid criteria in study set ${input.studySetId}:`, parsedCriteria.error.errors);
        // Return a safe default if parsing fails for a study set
        return { data: { allCards: true, tagLogic: 'ANY' }, error: null }; 
      } else {
        return { data: parsedCriteria.data, error: null };
      }
    } catch (error) {
      appLogger.error(`[getBaseCriteria] Error parsing study set criteria for ${input.studySetId}:`, error);
      return { data: { allCards: true, tagLogic: 'ANY' }, error: null }; // Fallback
    }
  } else if ('criteria' in input && input.criteria) {
    // Parse against the updated schema
    const parsedCriteria = StudyQueryCriteriaSchema.safeParse(input.criteria);
    if (!parsedCriteria.success) {
      appLogger.error(`[getBaseCriteria] Invalid direct criteria provided:`, parsedCriteria.error.errors);
      return { data: null, error: `Invalid query criteria: ${parsedCriteria.error.errors.map(e => e.message).join(', ')}` };
    }
    return { data: parsedCriteria.data, error: null };
  } else {
    appLogger.error('[getBaseCriteria] Invalid input: Neither criteria nor studySetId provided.');
    return { data: null, error: 'Invalid input for base criteria.' };
  }
}

// Define the structure for SRS distribution counts returned by the new RPC
export type SrsDistribution = {
  new_count: number;
  learning_count: number;
  relearning_count: number;
  young_count: number;
  mature_count: number;
  actionable_count: number;
};

// Server action to get SRS distribution for a given source
export async function getStudySetSrsDistribution(
  input: ResolveStudyQueryInput
): Promise<ActionResult<SrsDistribution | null>> {
  const supabase = createActionClient();

  // 1. Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    appLogger.error('Auth error in getStudySetSrsDistribution:', authError);
    return { data: null, error: 'Authentication required.' };
  }

  // 2. Determine criteria using getBaseCriteria
  const baseCriteriaResult = await getBaseCriteria(input);
  if (baseCriteriaResult.error || !baseCriteriaResult.data) {
    appLogger.error('[getStudySetSrsDistribution] Failed to get base criteria:', baseCriteriaResult.error);
    return { data: null, error: baseCriteriaResult.error || "Failed to get base criteria for SRS distribution." };
  }
  const criteriaToUse = baseCriteriaResult.data;

  // 3. RPC Call to get_study_set_srs_distribution
  appLogger.info("[getStudySetSrsDistribution] Calling RPC get_study_set_srs_distribution with criteria:", criteriaToUse);
  const { data: distributionData, error: rpcError } = await supabase.rpc(
    'get_study_set_srs_distribution' as any, // Cast to any to bypass initial strict type check for new RPC name
    {
      p_user_id: user.id,
      p_query_criteria: criteriaToUse as unknown as Json,
    }
  );

  if (rpcError) {
    appLogger.error('Supabase RPC error in getStudySetSrsDistribution:', rpcError);
    return { data: null, error: 'Failed to retrieve SRS distribution. Please try again.' };
  }

  // RPC returns a single object with the counts
  if (distributionData && typeof distributionData === 'object') {
    // Ensure counts are numbers, default to 0 if null/undefined from DB
    // Cast distributionData to SrsDistribution or a compatible type to access properties safely.
    const rawData = distributionData as SrsDistribution; 
    const validatedDistribution: SrsDistribution = {
      new_count: Number(rawData.new_count ?? 0),
      learning_count: Number(rawData.learning_count ?? 0),
      relearning_count: Number(rawData.relearning_count ?? 0),
      young_count: Number(rawData.young_count ?? 0),
      mature_count: Number(rawData.mature_count ?? 0),
      actionable_count: Number(rawData.actionable_count ?? 0),
    };
    appLogger.info('[getStudySetSrsDistribution] Received distribution:', validatedDistribution);
    return { data: validatedDistribution, error: null };
  } else {
    appLogger.warn('[getStudySetSrsDistribution] No distribution data returned from RPC, returning null.');
    // Return a default zeroed distribution if RPC returns nothing but no error
    return { 
        data: { new_count: 0, learning_count: 0, relearning_count: 0, young_count: 0, mature_count: 0, actionable_count: 0 }, 
        error: null 
    };
  }
}

// Define the structure for global SRS summary counts
export type UserGlobalSrsSummary = {
  total_cards: number;
  new_cards: number;
  due_cards: number;
  new_review_cards: number;
};

// Server action to get global SRS summary for a user
export async function getUserGlobalSrsSummary(): Promise<ActionResult<UserGlobalSrsSummary | null>> {
  const supabase = createActionClient();

  // 1. Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    appLogger.error('Auth error in getUserGlobalSrsSummary:', authError);
    return { data: null, error: 'Authentication required.' };
  }

  // 2. RPC Call to get_user_global_srs_summary
  appLogger.info("[getUserGlobalSrsSummary] Calling RPC get_user_global_srs_summary for user:", user.id);
  const { data: summaryData, error: rpcError } = await supabase.rpc(
    'get_user_global_srs_summary' as any, // Cast to any for new RPC name
    {
      p_user_id: user.id,
    }
  );

  if (rpcError) {
    appLogger.error('Supabase RPC error in getUserGlobalSrsSummary:', rpcError);
    return { data: null, error: 'Failed to retrieve global SRS summary. Please try again.' };
  }

  if (summaryData && typeof summaryData === 'object') {
    const rawData = summaryData as UserGlobalSrsSummary;
    const validatedSummary: UserGlobalSrsSummary = {
      total_cards: Number(rawData.total_cards ?? 0),
      new_cards: Number(rawData.new_cards ?? 0),
      due_cards: Number(rawData.due_cards ?? 0),
      new_review_cards: Number(rawData.new_review_cards ?? 0),
    };
    appLogger.info('[getUserGlobalSrsSummary] Received summary:', validatedSummary);
    return { data: validatedSummary, error: null };
  } else {
    appLogger.warn('[getUserGlobalSrsSummary] No summary data returned from RPC, returning null.');
    return {
      data: { total_cards: 0, new_cards: 0, due_cards: 0, new_review_cards: 0 },
      error: null,
    };
  }
}