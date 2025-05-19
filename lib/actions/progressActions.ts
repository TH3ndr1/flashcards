"use server";

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
// import { cookies } from "next/headers";
import type { Database, Tables, TablesUpdate } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';
import { updateCardProgressSchema, cardUpdateFieldsSchema } from "@/lib/schema/card.schema"; // Remove .ts extension
import type { z } from 'zod';
import { appLogger, statusLogger } from '@/lib/logger';

/**
 * Server actions for managing study progress and SRS state.
 * 
 * This module provides:
 * - Card progress tracking and updates
 * - SRS state management
 * - Study session progress persistence
 * 
 * @module progressActions
 */

/**
 * Updates a card's progress and SRS state based on a review grade.
 * 
 * @param {object} input - The input object matching updateCardProgressSchema.
 * @param {string} input.cardId - ID of the card to update.
 * @param {number} input.grade - The grade given to the card (1-4).
 * @param {object} input.updatedFields - An object containing the card fields to update (matching cardUpdateFieldsSchema).
 * @returns {Promise<ActionResult<Tables<'cards'>>>} The result of the action, containing the updated card data or an error.
 */
export async function updateCardProgress(
    input: z.infer<typeof updateCardProgressSchema> // Use Zod type for input
): Promise<ActionResult<Tables<'cards'>>> { // Return ActionResult

    const validationResult = updateCardProgressSchema.safeParse(input);

    if (!validationResult.success) {
        console.error('[updateCardProgress] Invalid input:', validationResult.error.flatten());
        return { data: null, error: "Invalid input: " + validationResult.error.flatten().fieldErrors };
    }

    const { cardId, grade, updatedFields } = validationResult.data;

    console.log(`[updateCardProgress] Action started for cardId: ${cardId}`, { grade, updatedFields });
    
    try {
        const supabase = createActionClient(); // No need to await createActionClient
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[updateCardProgress] Auth error or no user:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }
        
        // Construct the DB update payload from validated fields
        // The keys in updatedFields are already snake_case as defined in the schema
        const dbUpdatePayload: Partial<TablesUpdate<'cards'>> = {
            ...updatedFields, // Spread all validated fields
            last_reviewed_at: new Date().toISOString(), // Set timestamp
            last_review_grade: grade, // Set the grade that triggered this update
            user_id: user.id // Ensure user_id is set for RLS, though update might handle it
        };
        
        console.log("[updateCardProgress] DB update payload prepared:", dbUpdatePayload);

        // Perform the update
        console.log(`[updateCardProgress] Updating card ${cardId}`);
        const { data: updatedCardData, error: updateError } = await supabase
            .from('cards')
            .update(dbUpdatePayload)
            .eq('id', cardId)
            .eq('user_id', user.id) // Ensure RLS check on update
            .select('*')
            .single();
            
        console.log("[updateCardProgress] Supabase update result:", { updateError });

        if (updateError) {
            console.error("[updateCardProgress] Error during Supabase update:", updateError);
             // Consider mapping specific DB error codes (like 23503 FK violation) to user-friendly messages
            return { data: null, error: updateError.message || "Failed to update card progress." };
        }
        
        if (!updatedCardData) {
             console.error("[updateCardProgress] No data returned after update.");
             return { data: null, error: "Failed to confirm card update." };
        }

        console.log("[updateCardProgress] Successfully updated card:", cardId);
        return { data: updatedCardData, error: null }; // Return success with updated card

    } catch (error: unknown) {
        console.error("[updateCardProgress] Caught unexpected error:", error); // Log the full error object
        const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
        // Log specific details if available (e.g., PostgreSQL error code)
        if (error && typeof error === 'object' && 'code' in error) {
           console.error("[updateCardProgress] DB Error Code:", error.code);
        }
        return { data: null, error: `Failed to update card progress: ${errorMsg}` };
    }
}

/**
 * Resets a card's progress and SRS state.
 * 
 * @param {Object} params - Progress reset parameters
 * @param {string} params.cardId - ID of the card to reset
 * @returns {Promise<ActionResult<Tables<'cards'>>>} The result of the action, containing the reset card data or an error.
 * @throws {Error} If progress reset fails or user is not authenticated
 */
export async function resetCardProgress({
  cardId,
}: {
  cardId: string;
}): Promise<ActionResult<Tables<'cards'>>> { // Return ActionResult
    console.log(`[resetCardProgress] Action started for cardId: ${cardId}`);
    
    if (!cardId || typeof cardId !== 'string' || !cardId.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
        console.error("[resetCardProgress] Invalid Card ID provided.");
        return { data: null, error: "Invalid Card ID provided." };
    }

    try {
        const supabase = createActionClient();
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[resetCardProgress] Auth error or no user:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }
        
        // Reset payload - include new fields with default/reset values
        const resetPayload: Partial<TablesUpdate<'cards'>> = {
            last_reviewed_at: null,
            next_review_due: null,
            srs_level: 0,
            easiness_factor: 2.5, // Use DB default or settings default?
            interval_days: 0,
            last_review_grade: null,
            correct_count: 0,
            incorrect_count: 0,
            attempt_count: 0,
            // Reset new fields
            learning_state: null,
            learning_step_index: null,
            failed_attempts_in_learn: 0,
            hard_attempts_in_learn: 0,
            user_id: user.id
        };
        
        console.log("[resetCardProgress] DB reset payload prepared:", resetPayload);

        // Perform the reset
        console.log(`[resetCardProgress] Resetting card ${cardId}`);
        const { data: resetResult, error: resetError } = await supabase
            .from('cards')
            .update(resetPayload)
            .eq('id', cardId)
            .eq('user_id', user.id) // Ensure RLS check
            .select('*')
            .single();
            
        console.log("[resetCardProgress] Supabase reset result:", { resetError });

        if (resetError) {
            console.error("[resetCardProgress] Error during Supabase reset:", resetError);
            return { data: null, error: resetError.message || "Failed to reset card progress." };
        }

        if (!resetResult) {
            console.error("[resetCardProgress] No data returned after reset.");
            return { data: null, error: "Failed to confirm card reset." };
        }

        console.log("[resetCardProgress] Successfully reset card:", cardId);
        return { data: resetResult, error: null }; // Return success with reset card

    } catch (error: unknown) {
        console.error("[resetCardProgress] Caught unexpected error:", error); // Log the full error object
        const errorMsg = error instanceof Error ? error.message : "An unknown error occurred.";
        return { data: null, error: `Failed to reset card progress: ${errorMsg}` };
    }
} 