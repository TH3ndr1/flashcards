"use server";

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
// import { cookies } from "next/headers";
import type { Database, Tables, TablesUpdate } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';

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
 * Represents the necessary data to update a card's progress after a review.
 * Matches the SRS fields in the DbCard type.
 */
export interface CardProgressUpdate extends Partial<Pick<Tables<'cards'>,
    'last_reviewed_at' |
    'next_review_due' |
    'srs_level' |
    'easiness_factor' |
    'interval_days' |
    'stability' |
    'difficulty' |
    'last_review_grade' |
    'correct_count' |
    'incorrect_count' |
    'attempt_count'
>> {
    // All fields are optional, but we'll set them in the function if not provided
}

// Helper function to convert camelCase keys to snake_case
function camelToSnake(key: string): string {
    return key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertPayloadToSnakeCase(payload: Record<string, any>): Record<string, any> {
    console.log("[convertPayload] Input:", payload);
    const snakeCasePayload: Record<string, any> = {};
    for (const key in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
            const value = payload[key];
            // Convert Date objects to ISO strings for Supabase timestamptz
            if (value instanceof Date) {
                snakeCasePayload[camelToSnake(key)] = value.toISOString();
            } else {
                 snakeCasePayload[camelToSnake(key)] = value;
            }
           
        }
    }
    console.log("[convertPayload] Output:", snakeCasePayload);
    return snakeCasePayload;
}

// Define the expected shape for the calculated next SRS state
// These should match the relevant fields in Tables<'cards'>
type CalculatedSrsState = Required<Pick<Tables<'cards'>, 
    'next_review_due' | 
    'srs_level' | 
    'easiness_factor' | 
    'interval_days'
    // Add FSRS fields here if/when used: 'stability' | 'difficulty' 
>>;

/**
 * Updates a card's progress and SRS state.
 * 
 * @param {Object} params - Progress update parameters
 * @param {string} params.cardId - ID of the card to update
 * @param {number} params.grade - The grade given to the card (1-4)
 * @param {SRSState} params.nextState - The calculated next SRS state
 * @returns {Promise<Card>} The updated card
 * @throws {Error} If progress update fails or user is not authenticated
 */
export async function updateCardProgress({
  cardId,
  grade,
  nextState,
}: {
  cardId: string;
  grade: number;
  nextState: CalculatedSrsState;
}): Promise<Tables<'cards'>> {
    console.log(`[updateCardProgress] Action started for cardId: ${cardId}`, { grade, nextState });
    
    try {
        // Use the standard action client - must await
        const supabase = await createActionClient();
        
        // Fetch user for authentication check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[updateCardProgress] Auth error or no user:', authError);
            throw new Error('Not authenticated');
        }

        if (!cardId) {
            console.error("[updateCardProgress] Card ID is required.");
            throw new Error("Card ID is required to update progress.");
        }
        
        // Construct the DB update payload directly using snake_case keys
        const dbUpdatePayload: Partial<TablesUpdate<'cards'>> = {
            last_reviewed_at: new Date().toISOString(), // Set directly here
            next_review_due: nextState.next_review_due, 
            srs_level: nextState.srs_level, 
            easiness_factor: nextState.easiness_factor, 
            interval_days: nextState.interval_days, 
            last_review_grade: grade, 
            // TODO: Add correct/incorrect/attempt count logic if needed
            // e.g., fetch current counts and increment?
        };
        
        // Convert payload keys to snake_case for DB and handle Date conversion - No longer needed if constructed correctly
        // const dbUpdatePayload = convertPayloadToSnakeCase(updatedProgress);
        console.log("[updateCardProgress] DB update payload prepared:", dbUpdatePayload);

        // First verify the card belongs to a deck owned by the user
        console.log(`[updateCardProgress] Verifying ownership for card: ${cardId}`);
        const { data: card, error: cardError } = await supabase
            .from('cards')
            .select('deck_id')
            .eq('id', cardId)
            .single();
        
        console.log("[updateCardProgress] Ownership verification result:", { card, cardError });

        if (cardError || !card) {
            console.error("[updateCardProgress] Error fetching card or card not found/denied:", cardError);
            throw new Error("Card not found or access denied");
        }

        // Now update the card
        console.log(`[updateCardProgress] Updating card ${cardId} with payload:`, dbUpdatePayload);
        const { data: updatedCardData, error: updateError } = await supabase
            .from('cards')
            .update(dbUpdatePayload)
            .eq('id', cardId)
            .eq('deck_id', card.deck_id)
            .select('*') // Select the updated card data
            .single();
            
        console.log("[updateCardProgress] Supabase update result:", { updateError });

        if (updateError) {
            console.error("[updateCardProgress] Error during Supabase update:", updateError);
            throw updateError;
        }
        
        console.log("[updateCardProgress] Successfully updated card:", cardId);
        if (!updatedCardData) {
             console.error("[updateCardProgress] No data returned after update.");
             throw new Error("Failed to confirm card update.");
        }
        return updatedCardData; // Return the full updated card
    } catch (error) {
        console.error("[updateCardProgress] Caught error during execution:", error);
        // Log specific details if available (e.g., PostgreSQL error code)
        if (error && typeof error === 'object' && 'code' in error) {
           console.error("[updateCardProgress] DB Error Code:", error.code);
        }
        throw error instanceof Error ? error : new Error("Failed to update card progress.");
    }
}

/**
 * Resets a card's progress and SRS state.
 * 
 * @param {Object} params - Progress reset parameters
 * @param {string} params.cardId - ID of the card to reset
 * @returns {Promise<Card>} The reset card
 * @throws {Error} If progress reset fails or user is not authenticated
 */
export async function resetCardProgress({
  cardId,
}: {
  cardId: string;
}): Promise<Tables<'cards'>> {
    console.log(`[resetCardProgress] Action started for cardId: ${cardId}`);
    
    try {
        // Use the standard action client - must await
        const supabase = await createActionClient();
        
        // Fetch user for authentication check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[resetCardProgress] Auth error or no user:', authError);
            throw new Error('Not authenticated');
        }

        if (!cardId) {
            console.error("[resetCardProgress] Card ID is required.");
            throw new Error("Card ID is required to reset progress.");
        }
        
        // Reset the card progress
        const resetProgress = {
            last_reviewed_at: null,
            next_review_due: null,
            srs_level: 0,
            easiness_factor: 2.5,
            interval_days: 0,
            stability: 0,
            difficulty: 0,
            last_review_grade: null,
            correct_count: 0,
            incorrect_count: 0,
            attempt_count: 0
        };
        
        // Convert payload keys to snake_case for DB and handle Date conversion - Already snake_case
        // const dbResetPayload = convertPayloadToSnakeCase(resetProgress);
        console.log("[resetCardProgress] DB reset payload prepared:", resetProgress);

        // First verify the card belongs to a deck owned by the user
        console.log(`[resetCardProgress] Verifying ownership for card: ${cardId}`);
        const { data: card, error: cardError } = await supabase
            .from('cards')
            .select('deck_id')
            .eq('id', cardId)
            .single();
        
        console.log("[resetCardProgress] Ownership verification result:", { card, cardError });

        if (cardError || !card) {
            console.error("[resetCardProgress] Error fetching card or card not found/denied:", cardError);
            throw new Error("Card not found or access denied");
        }

        // Now reset the card
        console.log(`[resetCardProgress] Resetting card ${cardId} with payload:`, resetProgress);
        const { data: resetResult, error: resetError } = await supabase
            .from('cards')
            .update(resetProgress)
            .eq('id', cardId)
            .eq('deck_id', card.deck_id)
            .select('*') // Select the reset card data
            .single();
            
        console.log("[resetCardProgress] Supabase reset result:", { resetError });

        if (resetError) {
            console.error("[resetCardProgress] Error during Supabase reset:", resetError);
            throw resetError;
        }
        
        console.log("[resetCardProgress] Successfully reset card:", cardId);
        if (!resetResult) {
             console.error("[resetCardProgress] No data returned after reset.");
             throw new Error("Failed to confirm card reset.");
        }
        return resetResult; // Return the full reset card data
    } catch (error) {
        console.error("[resetCardProgress] Caught error during execution:", error);
        // Log specific details if available (e.g., PostgreSQL error code)
        if (error && typeof error === 'object' && 'code' in error) {
           console.error("[resetCardProgress] DB Error Code:", error.code);
        }
        throw error instanceof Error ? error : new Error("Failed to reset card progress.");
    }
} 