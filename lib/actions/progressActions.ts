"use server";

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
// import { cookies } from "next/headers";
import type { DbCard } from "@/types/database";

/**
 * Represents the necessary data to update a card's progress after a review.
 * Matches the SRS fields in the DbCard type.
 */
export interface CardProgressUpdate extends Partial<Pick<DbCard,
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


/**
 * Updates the progress/SRS state of a single card in the database.
 * 
 * @param cardId The UUID of the card to update.
 * @param progressUpdate The SRS and stat updates calculated after a review. 
 *                       Expected keys are camelCase (e.g., nextReviewDue, srsLevel).
 * @param isDynamicRoute Optional flag to indicate if this is called from a dynamic route
 * @returns Promise<{ error: Error | null }>
 */
export async function updateCardProgress(
    cardId: string, 
    progressUpdate: CardProgressUpdate,
    isDynamicRoute = false
): Promise<{ error: Error | null }> {
    console.log(`[updateCardProgress] Action started for cardId: ${cardId}`, { progressUpdate });
    
    try {
        // Use the appropriate client based on the context
        const supabase = isDynamicRoute 
            ? await createDynamicRouteClient() 
            : createActionClient();
        
        // Fetch user directly using the client
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("[updateCardProgress] Auth error or no user", authError);
            return { error: authError || new Error("User not authenticated") };
        }
        console.log("[updateCardProgress] User authenticated:", user.id);

        if (!cardId) {
            console.error("[updateCardProgress] Card ID is required.");
            return { error: new Error("Card ID is required to update progress.") };
        }
        
        // Ensure we have last_reviewed_at
        const updatedProgress = {
            ...progressUpdate,
            last_reviewed_at: progressUpdate.last_reviewed_at || new Date()
        };
        
        // Convert payload keys to snake_case for DB and handle Date conversion
        const dbUpdatePayload = convertPayloadToSnakeCase(updatedProgress);
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
        const { error: updateError } = await supabase
            .from('cards')
            .update(dbUpdatePayload)
            .eq('id', cardId)
            .eq('deck_id', card.deck_id);
            
        console.log("[updateCardProgress] Supabase update result:", { updateError });

        if (updateError) {
            console.error("[updateCardProgress] Error during Supabase update:", updateError);
            throw updateError;
        }
        
        console.log("[updateCardProgress] Successfully updated card:", cardId);
        return { error: null };
    } catch (error) {
        console.error("[updateCardProgress] Caught error during execution:", error);
        // Log specific details if available (e.g., PostgreSQL error code)
        if (error && typeof error === 'object' && 'code' in error) {
           console.error("[updateCardProgress] DB Error Code:", error.code);
        }
        return { error: error instanceof Error ? error : new Error("Failed to update card progress.") };
    }
} 