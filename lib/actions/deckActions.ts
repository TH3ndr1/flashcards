'use server';

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
import type { Database, Tables, DbDeck, DbCard } from "@/types/database"; // Import types
import type { ActionResult } from "@/lib/actions/types"; // Assuming common ActionResult
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

/**
 * Server actions for managing decks.
 * 
 * This module provides:
 * - Deck creation, reading, updating, and deletion
 * - Deck metadata management
 * - Deck query and filtering operations
 * 
 * @module deckActions
 */

/**
 * Get the name of a deck by its ID
 * 
 * @param deckId The deck UUID to fetch
 */
export async function getDeckName(
    deckId: string
): Promise<{ data: string | null, error: Error | null }> {
    console.log("[getDeckName] Action started for deckId:", deckId);
    
    try {
        // Use the standard action client - must await
        const supabase = await createActionClient();
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getDeckName] Auth error or no user:', authError);
            return { data: null, error: new Error('Not authenticated') };
        }
        
        console.log("[getDeckName] User authenticated:", user.id);

        try {
            console.log(`[getDeckName] Querying decks table for id: ${deckId} and user_id: ${user.id}`);
            const { data, error } = await supabase
                .from('decks')
                .select('name')
                .eq('id', deckId)
                .eq('user_id', user.id)
                .single();
            
            // Log result immediately
            console.log("[getDeckName] Supabase query result:", { data, error });

            if (error) {
               console.error("[getDeckName] Supabase query failed:", error);
               // Throw the original Supabase error if possible
               throw error;
            }
            
            console.log("[getDeckName] Successfully fetched name:", data?.name);
            return { data: data?.name ?? null, error: null };
            
        } catch (error) {
            // Log the caught error more specifically before returning generic one
            console.error('[getDeckName] Caught error during query execution:', error);
            return { data: null, error: error instanceof Error ? error : new Error('Unknown error fetching deck name') };
        }
    } catch (error) {
        // Log the caught error more specifically before returning generic one
        console.error('[getDeckName] Caught error during client selection:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error fetching deck name') };
    }
} 

// Define the type for the aggregated result explicitly - remove description
type DeckWithCount = Pick<DbDeck, 'id' | 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual' | 'updated_at'> & { card_count: number };

/**
 * Fetches all decks with basic info and card count for the authenticated user.
 */
export async function getDecks(): Promise<ActionResult<DeckWithCount[]>> {
    console.log("[getDecks] Action started");
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getDecks] Auth error or no user:', authError);
            return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }
        
        console.log("[getDecks] User authenticated:", user.id);

        try {
            console.log(`[getDecks] Querying decks and card counts for user_id: ${user.id}`);
            // Select deck fields - remove description
            const { data, error } = await supabase
                .from('decks')
                .select(`
                    id, 
                    name, 
                    primary_language,
                    secondary_language,
                    is_bilingual,
                    updated_at,
                    cards ( count ) 
                `)
                .eq('user_id', user.id)
                .order('name', { ascending: true }); 
            
            console.log("[getDecks] Supabase query result raw:", { data, error });

            if (error) {
               console.error("[getDecks] Supabase query failed:", error);
               return { data: null, error: new Error(error.message || 'Failed to fetch decks.') };
            }
            
            // Process data (no description to handle)
            const processedData = data?.map(deck => {
                const count = deck.cards && Array.isArray(deck.cards) && deck.cards.length > 0 
                              ? deck.cards[0].count 
                              : 0;
                const { cards, ...deckInfo } = deck;
                return { ...deckInfo, card_count: count ?? 0 }; 
            }) || [];

            console.log(`[getDecks] Successfully fetched and processed ${processedData.length} decks.`);
            return { data: processedData as DeckWithCount[], error: null };
            
        } catch (err: any) {
            console.error('[getDecks] Caught error during query execution:', err);
            return { data: null, error: new Error(err.message || 'An unexpected error occurred while fetching decks.') };
        }
    } catch (err: any) {
        console.error('[getDecks] Caught error during client creation or auth:', err);
        return { data: null, error: new Error(err.message || 'An authentication or setup error occurred.') };
    }
} 

/**
 * Fetches a single deck by its ID, including its cards, for the authenticated user.
 * 
 * @param deckId The deck UUID to fetch
 * @returns Promise with the DbDeck object including DbCard[] or error
 */
export async function getDeck(
    deckId: string
): Promise<ActionResult<DbDeck & { cards: DbCard[] }>> { // Updated return type
    console.log(`[getDeck] Action started for deckId: ${deckId}`);
    
    if (!deckId) {
        return { data: null, error: new Error('Deck ID is required.') };
    }

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getDeck] Auth error or no user:', authError);
            return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }
        
        console.log(`[getDeck] User authenticated: ${user.id}, fetching deck ${deckId}`);

        // Fetch deck and its cards using a join
        // RLS on decks (checking user_id) should ensure security
        const { data: deckData, error: dbError } = await supabase
            .from('decks')
            .select(`
                *,
                cards (*)
            `)
            .eq('id', deckId)
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle as deck might not exist or be accessible

        if (dbError) {
            console.error('[getDeck] Database error:', dbError);
            return { data: null, error: new Error(dbError.message || 'Failed to fetch deck data.') };
        }

        if (!deckData) {
            console.log('[getDeck] Deck not found or not authorized:', deckId);
            // Return null data, but not an error for not found
            return { data: null, error: null }; 
        }

        // Ensure cards array is present, even if empty
        const deckWithCards = {
            ...deckData,
            cards: (deckData.cards || []) as DbCard[] // Ensure cards is array and typed correctly
        };

        console.log(`[getDeck] Successfully fetched deck ${deckId} with ${deckWithCards.cards.length} cards.`);
        return { data: deckWithCards, error: null };
        
    } catch (error) {
        console.error('[getDeck] Caught unexpected error:', error);
        return { 
            data: null, 
            error: error instanceof Error ? error : new Error('Unknown error fetching deck') 
        };
    }
} 

// --- Zod Schemas for Validation ---

// Schema for creating a deck
const createDeckSchema = z.object({
    name: z.string().trim().min(1, 'Deck name is required').max(100),
    primary_language: z.string().optional().nullable(),
    secondary_language: z.string().optional().nullable(),
    is_bilingual: z.boolean().optional().default(false),
    // user_id will be added from the authenticated user
});
type CreateDeckInput = z.infer<typeof createDeckSchema>;

// Schema for updating a deck (all fields optional)
const updateDeckSchema = createDeckSchema.partial();
type UpdateDeckInput = z.infer<typeof updateDeckSchema>;


// --- CRUD Actions ---

/**
 * Creates a new deck for the authenticated user.
 */
export async function createDeck(
    inputData: CreateDeckInput
): Promise<ActionResult<DbDeck>> {
    console.log(`[createDeck] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[createDeck] Auth error:', authError);
             return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }

        // Validate input data
        const validation = createDeckSchema.safeParse(inputData);
        if (!validation.success) {
             console.warn("[createDeck] Validation failed:", validation.error.errors);
             return { data: null, error: new Error(validation.error.errors[0].message) };
        }
        const { name, primary_language, secondary_language, is_bilingual } = validation.data;

        console.log(`[createDeck] User: ${user.id}, Creating deck: ${name}`);

        const { data: newDeck, error: insertError } = await supabase
            .from('decks')
            .insert({
                user_id: user.id,
                name,
                primary_language,
                secondary_language,
                is_bilingual
            })
            .select() // Select * to get all fields the DB has
            .single();

        if (insertError) {
            console.error('[createDeck] Insert error:', insertError);
            // TODO: Check for specific DB errors like unique constraints if needed
            return { data: null, error: new Error(insertError.message || 'Failed to create deck.') };
        }

        console.log(`[createDeck] Success, ID: ${newDeck?.id}`);
        revalidatePath('/'); // Revalidate home/dashboard where decks might be listed
        revalidatePath('/study/sets'); // Revalidate study set list page
        return { data: newDeck as DbDeck, error: null }; // Cast might be needed depending on select() return type

    } catch (error) {
        console.error('[createDeck] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error creating deck') };
    }
}

/**
 * Updates an existing deck for the authenticated user.
 */
export async function updateDeck(
    deckId: string,
    inputData: UpdateDeckInput
): Promise<ActionResult<DbDeck>> {
     console.log(`[updateDeck] Action started for deckId: ${deckId}`);
     if (!deckId) return { data: null, error: new Error('Deck ID is required.') };

     try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[updateDeck] Auth error:', authError);
             return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }

        // Validate input data
        const validation = updateDeckSchema.safeParse(inputData);
        if (!validation.success) {
             console.warn("[updateDeck] Validation failed:", validation.error.errors);
             return { data: null, error: new Error(validation.error.errors[0].message) };
        }
        const updatePayload = validation.data;

        if (Object.keys(updatePayload).length === 0) {
             return { data: null, error: new Error("No fields provided for update.") };
        }
        
        console.log(`[updateDeck] User: ${user.id}, Updating deck ${deckId} with:`, updatePayload);
        
        // Remove description from update payload if present
        const { description, ...payloadWithoutDesc } = updatePayload;

        const { data: updatedDeck, error: updateError } = await supabase
            .from('decks')
            .update({
                ...payloadWithoutDesc, // Use payload without description
                updated_at: new Date().toISOString()
            })
            .eq('id', deckId)
            .eq('user_id', user.id) // Ensure ownership
            .select()
            .single();

        if (updateError) {
            console.error('[updateDeck] Update error:', updateError);
            return { data: null, error: new Error(updateError.message || 'Failed to update deck.') };
        }

        if (!updatedDeck) {
             console.warn(`[updateDeck] Deck ${deckId} not found or not authorized for update.`);
             return { data: null, error: new Error('Deck not found or update failed.') };
        }

        console.log(`[updateDeck] Success, ID: ${updatedDeck.id}`);
        revalidatePath('/'); 
        revalidatePath('/study/sets');
        revalidatePath(`/edit/${deckId}`); // Revalidate edit page
        return { data: updatedDeck as DbDeck, error: null };

    } catch (error) {
        console.error('[updateDeck] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error updating deck') };
    }
}

/**
 * Deletes a deck and its associated cards (due to CASCADE) for the authenticated user.
 */
export async function deleteDeck(
    deckId: string
): Promise<ActionResult<null>> { // Returns null on success
     console.log(`[deleteDeck] Action started for deckId: ${deckId}`);
     if (!deckId) return { data: null, error: new Error('Deck ID is required.') };

      try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[deleteDeck] Auth error:', authError);
             return { data: null, error: new Error(authError?.message || 'Not authenticated') };
        }

        console.log(`[deleteDeck] User: ${user.id}, Deleting deck ${deckId}`);

        const { error: deleteError, count } = await supabase
            .from('decks')
            .delete()
            .eq('id', deckId)
            .eq('user_id', user.id); // Ensure ownership

        if (deleteError) {
            console.error('[deleteDeck] Delete error:', deleteError);
            return { data: null, error: new Error(deleteError.message || 'Failed to delete deck.') };
        }

         if (count === 0) {
             console.warn("[deleteDeck] Delete affected 0 rows for ID:", deckId, "(Might be already deleted or unauthorized)");
             // Don't return an error, just means nothing was deleted
        }

        console.log(`[deleteDeck] Success for ID: ${deckId}`);
        revalidatePath('/'); 
        revalidatePath('/study/sets');
        // No need to revalidate /edit/[deckId] as it won't exist
        return { data: null, error: null }; // Success

    } catch (error) {
        console.error('[deleteDeck] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error deleting deck') };
    }
} 