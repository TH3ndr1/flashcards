"use server";

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
// import { cookies } from "next/headers";
import type { DbStudySet } from "@/types/database";
import { studyQueryCriteriaSchema, type StudyQueryCriteria } from "@/types/study";
import { z } from "zod";
// Import getStudySet if it's implemented in studySetActions and preferred
// import { getStudySet } from "./studySetActions"; 
import { headers } from "next/headers";

/**
 * Detects if we're being called from a dynamic route by checking the referer header
 * This helps optimize client creation based on the calling context
 */
async function isCalledFromDynamicRoute(searchPattern = '/study/[') {
  try {
    // In Next.js, this can be determined in various ways
    // Here we use a simple string search pattern since all dynamic study routes
    // will contain '/study/' followed by a parameter
    const headerStore = headers();
    const referer = headerStore.get('referer') || '';
    return referer.includes('/study/') && referer.match(/\/study\/[a-zA-Z0-9-]+/);
  } catch (e) {
    // Default to false in case of errors
    return false;
  }
}

/**
 * Resolves a study query based on provided criteria or a saved study set ID.
 * Uses the resolve_study_query RPC function to determine which cards to study.
 * 
 * @param criteria The query criteria object
 * @returns Promise with array of card IDs and their priorities
 */
export async function resolveStudyQuery(
    criteria: StudyQueryCriteria
): Promise<{ data: { cardIds: string[], priorities: number[] } | null, error: Error | null }> {
    console.log(`[resolveStudyQuery] Processing study query:`, criteria);
    
    try {
        // Use the standard action client - must await
        const supabase = await createActionClient();
        
        // Fetch user for authentication check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("[resolveStudyQuery] Auth error or no user", authError);
            return { data: null, error: authError || new Error("User not authenticated") };
        }

        // If deckId is undefined or empty string, remove it from criteria
        const cleanedCriteria = {
            ...criteria
        };

        // Validate criteria using Zod
        console.log("resolveStudyQuery: Validating criteria:", JSON.stringify(cleanedCriteria, null, 2));
        const validatedCriteria = studyQueryCriteriaSchema.parse(cleanedCriteria);

        // Only check deck cards if deckId is provided
        if (validatedCriteria.deckId) {
            const { data: deckCards, error: deckError } = await supabase
                .from('cards')
                .select('id')
                .eq('deck_id', validatedCriteria.deckId);

            console.log("resolveStudyQuery: Found cards in deck:", deckCards?.length || 0);

            if (deckError) {
                console.error("resolveStudyQuery: Error checking deck cards:", deckError);
                throw deckError;
            }

            if (!deckCards?.length) {
                return { data: { cardIds: [], priorities: [] }, error: null };
            }
        }

        // Call the RPC function
        console.log("resolveStudyQuery: Calling RPC with:", {
            user_id: user.id,
            criteria: JSON.stringify(validatedCriteria, null, 2)
        });

        const { data: results, error: rpcError } = await supabase.rpc(
            'resolve_study_query',
            { 
                p_user_id: user.id,
                p_criteria: validatedCriteria
            }
        );

        if (rpcError) {
            console.error("resolveStudyQuery: RPC error:", rpcError);
            throw rpcError;
        }

        console.log("resolveStudyQuery: Raw RPC results:", JSON.stringify(results, null, 2));

        // Validate and transform the RPC response
        if (!Array.isArray(results)) {
            console.error("resolveStudyQuery: Invalid results format:", typeof results);
            throw new Error("Invalid response format from query resolver function");
        }

        // Extract card IDs and priorities from results
        const cardIds = results.map(r => r.card_id);
        const priorities = results.map(r => r.priority);

        console.log(`resolveStudyQuery: Resolved ${cardIds.length} cards for study. IDs:`, cardIds);
        return { 
            data: { 
                cardIds,
                priorities 
            }, 
            error: null 
        };

    } catch (error) {
        console.error("resolveStudyQuery: Error during processing:", error);
        if (error instanceof z.ZodError) {
            const errorMessage = error.errors.map(e => {
                // Make UUID errors more user-friendly
                if (e.message.includes('Invalid uuid')) {
                    return `Invalid deck or study set ID`;
                }
                return e.message;
            }).join(", ");
            return { 
                data: null, 
                error: new Error(`Invalid study criteria: ${errorMessage}`)
            };
        }
        return { 
            data: null, 
            error: error instanceof Error ? error : new Error("Failed to resolve study query") 
        };
    }
} 