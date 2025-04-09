"use server";

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
// import { cookies } from "next/headers";
import type { DbCard, Database, Tables, DbDeck } from "@/types/database";
import { headers } from "next/headers";
import { z } from 'zod'; // Make sure Zod is imported
import { revalidatePath } from 'next/cache';
// import type { ActionResult } from "@/lib/actions/types"; // Remove potentially incorrect import

/**
 * Reusable ActionResult type defined locally.
 */
interface ActionResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Detects if we're being called from a dynamic route by checking the referer header
 */
async function isCalledFromDynamicRoute(searchPattern = '/study/[') {
  try {
    const headerStore = await headers();
    const referer = headerStore.get('referer') || '';
    return referer.includes('/study/') && referer.match(/\/study\/[a-zA-Z0-9-]+/);
  } catch (e) {
    return false;
  }
}

/**
 * Get details for multiple cards by their IDs, including deck languages.
 * 
 * @param cardIds Array of card UUIDs to fetch
 * @returns Promise with array of DbCard objects (with nested decks languages) or error
 */
export async function getCardsByIds(
    cardIds: string[]
): Promise<ActionResult<DbCard[]>> {
    console.log(`[getCardsByIds] Action started for ${cardIds.length} cards`);
    
    if (!cardIds || cardIds.length === 0) {
        console.log("[getCardsByIds] No card IDs provided.");
        return { data: [], error: null };
    }
    
    try {
        const supabase = await createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getCardsByIds] Auth error or no user:', authError);
            // Return a standard Error object
            return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }
        
        console.log(`[getCardsByIds] User authenticated: ${user.id}, fetching ${cardIds.length} cards`);

        // Filter out invalid UUIDs (optional but good practice)
        const validCardIds = cardIds.filter(id => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id));
        if (validCardIds.length !== cardIds.length) {
             console.warn("[getCardsByIds] Some invalid UUIDs were filtered out.");
        }
        if (validCardIds.length === 0) {
             console.log("[getCardsByIds] No valid card IDs remaining after filtering.");
            return { data: [], error: null };
        }

        // Select all card fields AND specific language fields from the related deck
        const { data: dbCards, error: dbError } = await supabase
            .from('cards')
            .select(`
                *, 
                decks ( primary_language, secondary_language ) 
            `)
            .in('id', validCardIds)
            // Ensure the user owns the card via the related deck
            // This requires RLS on decks table for user_id
            // Or implicitly handled if the query only returns cards whose deck_id matches a deck user owns
            // If RLS on cards checks user_id directly, the join might not be needed for security,
            // but it IS needed here to fetch deck languages.
             .eq('user_id', user.id); // Assuming RLS on cards checks user_id directly is sufficient for security
            // If RLS relies ONLY on deck ownership, you might need the join filter back:
            // .eq('decks.user_id', user.id);

        if (dbError) {
            console.error('[getCardsByIds] Database error:', dbError);
             // Return a standard Error object
            return { data: null, error: new Error(dbError.message || 'Database query failed') };
        }

        if (!dbCards || dbCards.length === 0) {
            console.log('[getCardsByIds] No cards found or user does not have access');
            return { data: [], error: null };
        }
        
        console.log(`[getCardsByIds] Successfully fetched ${dbCards.length} cards`);
        // Type assertion might be needed if Supabase client types aren't perfect
        return { data: dbCards as DbCard[], error: null }; 
        
    } catch (error) {
        console.error('[getCardsByIds] Caught error:', error);
        return { 
            data: null, 
            // Ensure a standard Error object is returned
            error: error instanceof Error ? error : new Error('Unknown error fetching cards') 
        };
    }
}

/**
 * Fetches a single card by its ID
 * 
 * @param cardId The card UUID to fetch
 * @param isDynamicRoute Optional flag to indicate if this is called from a dynamic route
 * @returns Promise<{ data: FlashCard | null, error: Error | null }>
 */
export async function getCardById(
    cardId: string,
    isDynamicRoute = false
): Promise<{ data: DbCard | null, error: Error | null }> {
    // Use the standard client - must await
    const supabase = await createActionClient();
     
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("getCardById: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }

    console.log("Fetching single card:", cardId, "for user:", user.id);
    
    try {
         const { data: dbCard, error } = await supabase
            .from('cards')
             .select(`*`) // Select all card columns
             // RLS should handle user check based on deck_id relationship
             .eq('id', cardId)
             .maybeSingle<DbCard>(); 

        if (error) {
            console.error("getCardById: Error fetching card:", cardId, error);
            throw error;
        }

        if (!dbCard) {
            console.log("getCardById: Card not found:", cardId);
            return { data: null, error: null }; // Not an error, just not found
        }

        return { data: dbCard, error: null };

    } catch (error) {
         console.error("getCardById: Unexpected error:", cardId, error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to fetch card by ID.") };
    }
}

// Add other card-related actions if necessary (e.g., create, update, delete)
// These might overlap with deckService.ts initially; decide on final location/structure.

// --- Zod Schema for Card Creation ---
const createCardSchema = z.object({
    question: z.string().trim().min(1, "Question cannot be empty."),
    answer: z.string().trim().min(1, "Answer cannot be empty."),
    // Add optional language fields if needed
});
type CreateCardInput = z.infer<typeof createCardSchema>;

// Schema for updating a card (allow partial updates)
const updateCardSchema = createCardSchema.partial(); // Reuse create schema fields as optional
type UpdateCardInput = z.infer<typeof updateCardSchema>;

// --- Card CRUD Actions ---

/**
 * Creates a single new card within a specified deck for the authenticated user.
 */
export async function createCard(
    deckId: string,
    inputData: CreateCardInput
): Promise<ActionResult<DbCard>> { 
    console.log(`[createCard] Action started for deckId: ${deckId}`);
    if (!deckId) return { data: null, error: new Error('Deck ID is required.') };

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[createCard] Auth error:', authError);
             return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }

        const validation = createCardSchema.safeParse(inputData);
        if (!validation.success) {
             console.warn("[createCard] Validation failed:", validation.error.errors);
             return { data: null, error: new Error(validation.error.errors[0].message) };
        }
        const { question, answer } = validation.data;

        // Verify user owns the target deck
        const { count: deckCount, error: deckCheckError } = await supabase
            .from('decks')
            .select('id', { count: 'exact', head: true })
            .eq('id', deckId)
            .eq('user_id', user.id);

        if (deckCheckError || deckCount === 0) {
             console.error('[createCard] Deck ownership check failed:', deckCheckError);
             return { data: null, error: new Error('Target deck not found or access denied.') };
        }
        
        console.log(`[createCard] User: ${user.id}, Creating card in deck ${deckId}`);

        // Insert the new card
        const { data: newCard, error: insertError } = await supabase
            .from('cards')
            .insert({
                user_id: user.id, 
                deck_id: deckId,   
                question: question,
                answer: answer,
            })
            .select('*, decks(primary_language, secondary_language)') // Select new card data + deck langs
            .single();

        if (insertError) {
            console.error('[createCard] Insert error:', insertError);
            return { data: null, error: new Error(insertError.message || 'Failed to create card.') };
        }

        if (!newCard) {
             console.error('[createCard] Insert succeeded but no data returned.');
             return { data: null, error: new Error('Failed to retrieve created card data.') };
        }

        console.log(`[createCard] Success, New Card ID: ${newCard.id}`);
        revalidatePath(`/edit/${deckId}`); 
        return { data: newCard as DbCard, error: null }; // Return new card data including nested deck langs

    } catch (error) {
        console.error('[createCard] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error creating card') };
    }
}

/**
 * Updates an existing card for the authenticated user.
 */
export async function updateCard(
    cardId: string,
    inputData: UpdateCardInput
): Promise<ActionResult<DbCard>> {
    console.log(`[updateCard] Action started for cardId: ${cardId}`);
    if (!cardId) return { data: null, error: new Error('Card ID is required.') };

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[updateCard] Auth error:', authError);
             return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }

        // Validate input data
        const validation = updateCardSchema.safeParse(inputData);
        if (!validation.success) {
             console.warn("[updateCard] Validation failed:", validation.error.errors);
             return { data: null, error: new Error(validation.error.errors[0].message) };
        }
        const updatePayload = validation.data;

        if (Object.keys(updatePayload).length === 0) {
             return { data: null, error: new Error("No fields provided for update.") };
        }

        console.log(`[updateCard] User: ${user.id}, Updating card ${cardId} with:`, updatePayload);

        const { data: updatedCard, error: updateError } = await supabase
            .from('cards')
            .update({
                ...updatePayload,
                updated_at: new Date().toISOString() // Manually set updated_at
            })
            .eq('id', cardId)
            .eq('user_id', user.id) // Ensure ownership
            .select('*, decks(primary_language, secondary_language)') // Fetch updated data + deck langs
            .single();

        if (updateError) {
            console.error('[updateCard] Update error:', updateError);
            return { data: null, error: new Error(updateError.message || 'Failed to update card.') };
        }

        if (!updatedCard) {
             console.warn(`[updateCard] Card ${cardId} not found or not authorized for update.`);
             return { data: null, error: new Error('Card not found or update failed.') };
        }

        console.log(`[updateCard] Success, ID: ${updatedCard.id}`);
        // Revalidate relevant pages (e.g., the deck edit page)
        // Getting deckId requires another query or passing it in. 
        // For now, let's rely on client-side state update or parent component refetch.
        // if (updatedCard.deck_id) revalidatePath(`/edit/${updatedCard.deck_id}`); 
        return { data: updatedCard as DbCard, error: null };

    } catch (error) {
        console.error('[updateCard] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error updating card') };
    }
}

// TODO: Add deleteCard action here if needed 