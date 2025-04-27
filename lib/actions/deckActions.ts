'use server';

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
import type { Database, Tables, Json } from "@/types/database"; // Import Tables helper
import type { ActionResult } from "@/lib/actions/types"; // Correct import path
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
): Promise<{ data: string | null, error: string | null }> {
    console.log("[getDeckName] Action started for deckId:", deckId);
    
    try {
        // Use the standard action client - must await
        const supabase = await createActionClient();
        
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getDeckName] Auth error or no user:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
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
               return { data: null, error: error.message || 'Supabase query failed' };
            }
            
            console.log("[getDeckName] Successfully fetched name:", data?.name);
            return { data: data?.name ?? null, error: null };
            
        } catch (error) {
            // Log the caught error more specifically before returning generic one
            console.error('[getDeckName] Caught error during query execution:', error);
            return { data: null, error: error instanceof Error ? error.message : 'Unknown error fetching deck name' };
        }
    } catch (error) {
        // Log the caught error more specifically before returning generic one
        console.error('[getDeckName] Caught error during client selection:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error fetching deck name' };
    }
} 

// Define the type for the deck including its tags
type DeckWithTags = Tables<'decks'> & { tags: Tables<'tags'>[] };
// Define the type for the deck list item including tags and card count
type DeckListItemWithTags = Pick<Tables<'decks'>, 'id' | 'name' | 'primary_language' | 'secondary_language' | 'is_bilingual' | 'updated_at'> & { 
    card_count: number; 
    tags: Tables<'tags'>[]; // Add tags here
};

/**
 * Fetches all decks with basic info, card count, and associated tags for the authenticated user.
 */
export async function getDecks(): Promise<ActionResult<DeckListItemWithTags[]>> { // Updated return type
    console.log("[getDecks] Action started");
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getDecks] Auth error or no user:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }
        
        console.log("[getDecks] User authenticated:", user.id);

        try {
            console.log(`[getDecks] Querying decks, card counts, and tags for user_id: ${user.id}`);
            // --- Select deck fields, card count, AND associated tags --- 
            const { data, error } = await supabase
                .from('decks')
                .select(`
                    id, 
                    name, 
                    primary_language,
                    secondary_language,
                    is_bilingual,
                    updated_at,
                    cards ( count ),
                    tags (*) 
                `)
                .eq('user_id', user.id)
                .order('name', { ascending: true }); 
            // ---------------------------------------------------------
            
            console.log("[getDecks] Supabase query result raw:", { data, error });

            if (error) {
               console.error("[getDecks] Supabase query failed:", error);
               return { data: null, error: error.message || 'Failed to fetch decks.' };
            }
            
            // --- Process data to structure correctly --- 
            const processedData = data?.map(deck => {
                // Extract card count
                const count = deck.cards && Array.isArray(deck.cards) && deck.cards.length > 0 
                              ? deck.cards[0].count 
                              : 0;
                // Extract tags, ensuring it's an array
                const tags = (deck.tags || []) as Tables<'tags'>[];
                // Separate deck info from relation data
                const { cards, tags: _, ...deckInfo } = deck; 
                return { 
                    ...deckInfo, 
                    card_count: count ?? 0, 
                    tags: tags 
                }; 
            }) || [];
            // -----------------------------------------

            console.log(`[getDecks] Successfully fetched and processed ${processedData.length} decks.`);
            // Cast to the final type
            return { data: processedData as DeckListItemWithTags[], error: null }; 
            
        } catch (err: any) {
            console.error('[getDecks] Caught error during query execution:', err);
            return { data: null, error: err.message || 'An unexpected error occurred while fetching decks.' };
        }
    } catch (err: any) {
        console.error('[getDecks] Caught error during client creation or auth:', err);
        return { data: null, error: err.message || 'An authentication or setup error occurred.' };
    }
} 

/**
 * Fetches a single deck by ID, including its cards and associated tags, for the authenticated user.
 * 
 * @param deckId The deck UUID to fetch
 * @returns Promise with the DeckWithTags object including cards and tags, or error
 */
export async function getDeck(
    deckId: string
): Promise<ActionResult<DeckWithTags & { cards: Tables<'cards'>[] }>> { // Updated return type
    console.log(`[getDeck] Action started for deckId: ${deckId}`);
    
    if (!deckId) {
        return { data: null, error: 'Deck ID is required.' };
    }

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getDeck] Auth error or no user:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }
        
        console.log(`[getDeck] User authenticated: ${user.id}, fetching deck ${deckId}`);

        // --- Fetch deck, its cards, AND associated tags --- 
        const { data: deckData, error: dbError } = await supabase
            .from('decks')
            .select(`
                *,
                cards (*),
                tags (*)
            `)
            .eq('id', deckId)
            .eq('user_id', user.id)
            .maybeSingle(); // Use maybeSingle as deck might not exist or be accessible
        // --------------------------------------------------

        if (dbError) {
            console.error('[getDeck] Database error:', dbError);
            return { data: null, error: dbError.message || 'Failed to fetch deck data.' };
        }

        if (!deckData) {
            console.log('[getDeck] Deck not found or not authorized:', deckId);
            return { data: null, error: null }; 
        }

        // --- Ensure cards and tags arrays are present, even if empty --- 
        const deckWithDetails = {
            ...deckData,
            cards: (deckData.cards || []) as Tables<'cards'>[], // Ensure cards is array and typed correctly
            tags: (deckData.tags || []) as Tables<'tags'>[] // Ensure tags is array and typed correctly
        };
        // ----------------------------------------------------------

        console.log(`[getDeck] Successfully fetched deck ${deckId} with ${deckWithDetails.cards.length} cards and ${deckWithDetails.tags.length} tags.`);
        // Type assertion might be needed if TypeScript can't infer the final structure perfectly
        return { data: deckWithDetails as DeckWithTags & { cards: Tables<'cards'>[] }, error: null }; 
        
    } catch (error) {
        console.error('[getDeck] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'An unknown error occurred.' }; // More specific error return
    }
} 

// --- Zod Schemas for Validation ---

// Schema for creating a deck
const createDeckSchema = z.object({
    name: z.string().trim().min(1, 'Deck name is required').max(100, 'Deck name too long'),
    primary_language: z.string().optional().nullable(),
    secondary_language: z.string().optional().nullable(),
    is_bilingual: z.boolean().optional().default(false),
    // user_id will be added from the authenticated user
});
type CreateDeckInput = z.infer<typeof createDeckSchema>;

// Schema for updating a deck (all fields optional)
const updateDeckSchema = z.object({
    name: z.string().trim().min(1, 'Deck name is required').max(100, 'Deck name too long').optional(),
    primary_language: z.string().nullable().optional(),
    secondary_language: z.string().nullable().optional(),
    is_bilingual: z.boolean().nullable().optional(),
    // Note: Tags are updated via separate actions (addTagToDeck, removeTagFromDeck)
    // Cards are updated via cardActions
}).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update.",
});

type UpdateDeckInput = z.infer<typeof updateDeckSchema>;


// --- CRUD Actions ---

/**
 * Creates a new deck for the authenticated user.
 */
export async function createDeck(
    inputData: CreateDeckInput
): Promise<ActionResult<Tables<'decks'>>> { // Use Tables<>
    console.log(`[createDeck] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[createDeck] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        // Validate input data
        const validation = createDeckSchema.safeParse(inputData);
        if (!validation.success) {
             console.warn("[createDeck] Validation failed:", validation.error.errors);
             return { data: null, error: validation.error.errors[0].message };
        }
        const { name, primary_language, secondary_language, is_bilingual } = validation.data;

        console.log(`[createDeck] User: ${user.id}, Creating deck: ${name}`);

        const { data: newDeck, error: insertError } = await supabase
            .from('decks')
            .insert({
                user_id: user.id,
                name,
                primary_language: primary_language ?? undefined, // Convert null to undefined
                secondary_language: secondary_language ?? undefined, // Convert null to undefined
                is_bilingual
            })
            .select() // Select * to get all fields the DB has
            .single();

        if (insertError) {
            console.error('[createDeck] Insert error:', insertError);
            // TODO: Check for specific DB errors like unique constraints if needed
            return { data: null, error: insertError.message || 'Failed to create deck.' };
        }

        console.log(`[createDeck] Success, ID: ${newDeck?.id}`);
        revalidatePath('/'); // Revalidate home/dashboard where decks might be listed
        revalidatePath('/study/sets'); // Revalidate study set list page
        return { data: newDeck as Tables<'decks'>, error: null }; // Cast might be needed depending on select() return type

    } catch (error) {
        console.error('[createDeck] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error creating deck' };
    }
}

/**
 * Updates metadata for an existing deck.
 * Does not handle cards or tags.
 */
export async function updateDeck(
    deckId: string,
    inputData: UpdateDeckInput
): Promise<ActionResult<Tables<'decks'>>> { // Use Tables<>
     console.log(`[updateDeck] Action started for deckId: ${deckId}`);
     if (!deckId) return { data: null, error: 'Deck ID is required.' };

     try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[updateDeck] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        // Validate input data
        const validation = updateDeckSchema.safeParse(inputData);
        if (!validation.success) {
             console.warn("[updateDeck] Validation failed:", validation.error.errors);
             return { data: null, error: validation.error.errors[0].message };
        }
        const updates = validation.data;

        if (Object.keys(updates).length === 0) {
             return { data: null, error: "No fields provided for update." };
        }
        
        // --- Convert nulls to undefined for Supabase update --- 
        const updatePayloadForSupabase = {
            ...updates,
            // Explicitly handle potential null for boolean field
            is_bilingual: updates.is_bilingual === null ? undefined : updates.is_bilingual,
            // Ensure language fields are also handled if they are present in the update
            primary_language: updates.primary_language === null ? undefined : updates.primary_language,
            secondary_language: updates.secondary_language === null ? undefined : updates.secondary_language,
        };
        // Remove fields that ended up as undefined to avoid sending them unnecessarily
        // (though Supabase client might handle this)
        Object.keys(updatePayloadForSupabase).forEach(key => {
            if (updatePayloadForSupabase[key as keyof typeof updatePayloadForSupabase] === undefined) {
                delete updatePayloadForSupabase[key as keyof typeof updatePayloadForSupabase];
            }
        });
        // -----------------------------------------------------

        console.log(`[updateDeck] User: ${user.id}, Updating deck ${deckId} with processed payload:`, updatePayloadForSupabase);
        
        const { data: updatedDeck, error: updateError } = await supabase
            .from('decks')
            .update(updatePayloadForSupabase) // Use the processed payload
            .eq('id', deckId)
            .eq('user_id', user.id) // Ensure ownership
            .select()
            .single();

        if (updateError) {
            console.error('[updateDeck] Update error:', updateError);
            return { data: null, error: updateError.message || 'Failed to update deck.' };
        }

        if (!updatedDeck) {
             console.warn(`[updateDeck] Deck ${deckId} not found or not authorized for update.`);
             return { data: null, error: 'Deck not found or update failed.' };
        }

        console.log(`[updateDeck] Success, ID: ${updatedDeck.id}`);
        revalidatePath('/'); 
        revalidatePath('/study/sets');
        return { data: updatedDeck as Tables<'decks'>, error: null };

    } catch (error) {
        console.error('[updateDeck] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error updating deck' };
    }
}

/**
 * Deletes an existing deck and associated cards/tags (via CASCADE). 
 */
export async function deleteDeck(
    deckId: string
): Promise<ActionResult<null>> { // Returns null on success
     console.log(`[deleteDeck] Action started for deckId: ${deckId}`);
     if (!deckId) return { data: null, error: 'Deck ID is required.' };

      try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             console.error('[deleteDeck] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        console.log(`[deleteDeck] User: ${user.id}, Deleting deck ${deckId}`);

        const { error: deleteError, count } = await supabase
            .from('decks')
            .delete()
            .eq('id', deckId)
            .eq('user_id', user.id); // Ensure ownership

        if (deleteError) {
            console.error('[deleteDeck] Delete error:', deleteError);
            return { data: null, error: deleteError.message || 'Failed to delete deck.' };
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
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error deleting deck' };
    }
} 