// lib/actions/deckActions.ts
'use server';

import { createActionClient } from "@/lib/supabase/server";
import type { Database, Tables, Json, TablesUpdate } from "@/types/database"; // Import TablesUpdate
import type { ActionResult } from "@/lib/actions/types";
import { revalidatePath } from 'next/cache';
import { appLogger, statusLogger } from '@/lib/logger';

export type DeckListItemWithCounts = {
    id: string;
    name: string;
    primary_language: string | null;
    secondary_language: string | null;
    is_bilingual: boolean;
    updated_at: string;
    new_count: number;
    learning_count: number;
    relearning_count: number;
    young_count: number;
    mature_count: number;
    learn_eligible_count: number;
    review_eligible_count: number;
    deck_tags_json: Json; // Raw JSON from DB
    tags?: Array<{ id: string; name: string; }>;
};

type DeckWithTags = Tables<'decks'> & { tags: Tables<'tags'>[] };
export type DeckWithCardsAndTags = DeckWithTags & { cards: Tables<'cards'>[] };

import { createDeckSchema, updateDeckSchema } from '@/lib/schema/deckSchemas';
import type { CreateDeckInput, UpdateDeckInput } from '@/lib/schema/deckSchemas';


export async function getDecks(): Promise<ActionResult<DeckListItemWithCounts[]>> {
    appLogger.info("[deckActions - getDecks] Action started - fetching via RPC get_decks_with_complete_srs_counts");
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            appLogger.error('[deckActions - getDecks] Auth error or no user:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }

        appLogger.info(`[deckActions - getDecks] User authenticated: ${user.id}, calling RPC get_decks_with_complete_srs_counts`);

        const { data: rpcData, error: rpcError } = await supabase.rpc(
            'get_decks_with_complete_srs_counts',
            { p_user_id: user.id }
        );

        if (rpcData && rpcData.length > 0) {
            appLogger.info('[deckActions - getDecks] First item from rpcData:', JSON.stringify(rpcData[0], null, 2));
        }

        if (rpcError) {
            appLogger.error('[deckActions - getDecks] Supabase RPC failed:', rpcError);
            return { data: null, error: rpcError.message || 'Failed to fetch decks via RPC.' };
        }

        const processedData = (rpcData || []).map(deck => ({
            ...deck,
            new_count: Number(deck.new_count ?? 0),
            learning_count: Number(deck.learning_count ?? 0),
            relearning_count: Number(deck.relearning_count ?? 0),
            young_count: Number(deck.young_count ?? 0),
            mature_count: Number(deck.mature_count ?? 0),
            learn_eligible_count: Number(deck.learn_eligible_count ?? 0),
            review_eligible_count: Number(deck.review_eligible_count ?? 0),
            // Ensure primary_language and secondary_language are handled if RPC can return null
            // but your type DeckListItemWithCounts expects string (though it allows null now)
            primary_language: deck.primary_language, // Assuming RPC returns string or null matching type
            secondary_language: deck.secondary_language,
            is_bilingual: deck.is_bilingual,
            updated_at: deck.updated_at,
            deck_tags_json: deck.deck_tags_json,
        }));

        appLogger.info(`[deckActions - getDecks] Successfully fetched and processed ${processedData.length} decks via RPC.`);
        return { data: processedData as DeckListItemWithCounts[], error: null };

    } catch (err: any) {
        appLogger.error('[deckActions - getDecks] Caught unexpected error:', err);
        return { data: null, error: err.message || 'An unexpected error occurred while fetching decks.' };
    }
}

export async function getDeck(
    deckId: string
): Promise<ActionResult<DeckWithCardsAndTags | null>> {
    appLogger.info(`[deckActions - getDeck] Action started for deckId: ${deckId}`);
    if (!deckId) {
        return { data: null, error: 'Deck ID is required.' };
    }
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            appLogger.error('[deckActions - getDeck] Auth error or no user:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }
        appLogger.info(`[deckActions - getDeck] User authenticated: ${user.id}, fetching deck ${deckId}`);
        const { data: deckData, error: dbError } = await supabase
            .from('decks')
            .select(`*, cards (*), tags (*)`)
            .eq('id', deckId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (dbError) {
            appLogger.error('[deckActions - getDeck] Database error:', dbError);
            return { data: null, error: dbError.message || 'Failed to fetch deck data.' };
        }
        if (!deckData) {
            appLogger.info('[deckActions - getDeck] Deck not found or not authorized:', deckId);
            return { data: null, error: null };
        }
        const deckWithDetails = {
            ...deckData,
            cards: (deckData.cards || []) as Tables<'cards'>[],
            tags: (deckData.tags || []) as Tables<'tags'>[]
        };
        appLogger.info(`[deckActions - getDeck] Successfully fetched deck ${deckId} with ${deckWithDetails.cards.length} cards and ${deckWithDetails.tags.length} tags.`);
        return { data: deckWithDetails as DeckWithCardsAndTags, error: null };
    } catch (error) {
        appLogger.error('[deckActions - getDeck] Caught unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { data: null, error: errorMessage };
    }
}

export async function createDeck(
    inputData: CreateDeckInput
): Promise<ActionResult<Tables<'decks'>>> {
    appLogger.info(`[deckActions - createDeck] Action started.`);
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
             appLogger.error('[deckActions - createDeck] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }
        const validation = createDeckSchema.safeParse(inputData);
        if (!validation.success) {
             appLogger.warn("[deckActions - createDeck] Validation failed:", validation.error.format());
             return { data: null, error: validation.error.flatten().fieldErrors.name?.[0] || "Invalid input." };
        }
        const { name, primary_language, secondary_language, is_bilingual } = validation.data;
        appLogger.info(`[deckActions - createDeck] User: ${user.id}, Creating deck: ${name}`);
        const { data: newDeck, error: insertError } = await supabase
            .from('decks')
            .insert({
                user_id: user.id,
                name,
                primary_language: primary_language ?? 'en',
                secondary_language: secondary_language ?? primary_language ?? 'en',
                is_bilingual: is_bilingual ?? false,
            })
            .select()
            .single();
        if (insertError) {
            appLogger.error('[deckActions - createDeck] Insert error:', insertError);
            return { data: null, error: insertError.message || 'Failed to create deck.' };
        }
        appLogger.info(`[deckActions - createDeck] Success, ID: ${newDeck?.id}`);
        revalidatePath('/');
        revalidatePath('/study/select');
        return { data: newDeck, error: null };
    } catch (error) {
        appLogger.error('[deckActions - createDeck] Caught unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error creating deck';
        return { data: null, error: errorMessage };
    }
}

export async function updateDeck(
    deckId: string,
    inputData: UpdateDeckInput
): Promise<ActionResult<Tables<'decks'>>> {
     appLogger.info(`[deckActions - updateDeck] Action started for deckId: ${deckId}`);
     if (!deckId) return { data: null, error: 'Deck ID is required.' };
     try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
             appLogger.error('[deckActions - updateDeck] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }
        const validation = updateDeckSchema.safeParse(inputData);
        if (!validation.success) {
             appLogger.warn("[deckActions - updateDeck] Validation failed:", validation.error.format());
             return { data: null, error: validation.error.flatten().fieldErrors.name?.[0] || "Invalid input." };
        }
        const updatesFromSchema = validation.data;

        // FIX: Prepare payload for Supabase, converting nulls to undefined for optional fields
        // if the DB schema doesn't want explicit nulls for updates where a value previously existed.
        // However, `TablesUpdate<'decks'>` usually defines optional fields as `string | undefined`, not `string | null | undefined`.
        // The `updateDeckSchema` uses `.nullable().optional()`, so `updatesFromSchema` can have `null`.
        // We need to ensure the payload passed to `.update()` matches `Partial<TablesUpdate<'decks'>>`.
        const dbUpdatePayload: Partial<TablesUpdate<'decks'>> = {};
        if (updatesFromSchema.name !== undefined) dbUpdatePayload.name = updatesFromSchema.name;
        if (updatesFromSchema.is_bilingual !== undefined) dbUpdatePayload.is_bilingual = updatesFromSchema.is_bilingual ?? undefined; // Handle null for boolean

        // For string fields that can be null in schema but undefined in DB update type
        dbUpdatePayload.primary_language = updatesFromSchema.primary_language === null ? undefined : updatesFromSchema.primary_language;
        dbUpdatePayload.secondary_language = updatesFromSchema.secondary_language === null ? undefined : updatesFromSchema.secondary_language;

        // Remove any keys that are explicitly undefined to avoid sending them
        Object.keys(dbUpdatePayload).forEach(keyStr => {
            const key = keyStr as keyof typeof dbUpdatePayload;
            if (dbUpdatePayload[key] === undefined) {
                delete dbUpdatePayload[key];
            }
        });


        if (Object.keys(dbUpdatePayload).length === 0) {
             return { data: null, error: "No valid fields provided for update." };
        }

        appLogger.info(`[deckActions - updateDeck] User: ${user.id}, Updating deck ${deckId} with:`, dbUpdatePayload);

        const { data: updatedDeck, error: updateError } = await supabase
            .from('decks')
            .update(dbUpdatePayload) // Use the explicitly typed payload
            .eq('id', deckId)
            .eq('user_id', user.id)
            .select()
            .single();
        if (updateError) {
            appLogger.error('[deckActions - updateDeck] Update error:', updateError);
            return { data: null, error: updateError.message || 'Failed to update deck.' };
        }
        if (!updatedDeck) {
             appLogger.warn(`[deckActions - updateDeck] Deck ${deckId} not found or not authorized for update.`);
             return { data: null, error: 'Deck not found or update failed.' };
        }
        appLogger.info(`[deckActions - updateDeck] Success, ID: ${updatedDeck.id}`);
        revalidatePath('/');
        revalidatePath('/study/select');
        revalidatePath(`/edit/${deckId}`);
        return { data: updatedDeck, error: null };
    } catch (error) {
        appLogger.error('[deckActions - updateDeck] Caught unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error updating deck';
        return { data: null, error: errorMessage };
    }
}

export async function deleteDeck(
    deckId: string
): Promise<ActionResult<null>> {
     appLogger.info(`[deckActions - deleteDeck] Action started for deckId: ${deckId}`);
     if (!deckId) return { data: null, error: 'Deck ID is required.' };
      try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
             appLogger.error('[deckActions - deleteDeck] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }
        appLogger.info(`[deckActions - deleteDeck] User: ${user.id}, Deleting deck ${deckId}`);
        const { error: deleteError, count } = await supabase
            .from('decks')
            .delete()
            .eq('id', deckId)
            .eq('user_id', user.id);
        if (deleteError) {
            appLogger.error('[deckActions - deleteDeck] Delete error:', deleteError);
            return { data: null, error: deleteError.message || 'Failed to delete deck.' };
        }
         if (count === 0) {
             appLogger.warn("[deckActions - deleteDeck] Delete affected 0 rows for ID:", deckId);
        }
        appLogger.info(`[deckActions - deleteDeck] Success for ID: ${deckId}`);
        revalidatePath('/');
        revalidatePath('/study/select');
        return { data: null, error: null };
    } catch (error) {
        appLogger.error('[deckActions - deleteDeck] Caught unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting deck';
        return { data: null, error: errorMessage };
    }
}

/**
 * @deprecated Prefer using the main `getDecks()` function which now uses the new RPC.
 */
export async function getDecksWithSrsCounts(): Promise<ActionResult<DeckListItemWithCounts[]>> {
  appLogger.warn("[deckActions - getDecksWithSrsCounts] This function is deprecated. Use getDecks() instead.");
  return getDecks();
}