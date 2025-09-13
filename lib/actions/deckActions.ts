// lib/actions/deckActions.ts
'use server';

import { createActionClient } from "@/lib/supabase/server";
import type { Database, Tables, Json, TablesUpdate } from "@/types/database"; // Import TablesUpdate
import type { ActionResult } from "@/lib/actions/types";
import { revalidatePath } from 'next/cache';
import { appLogger } from '@/lib/logger';

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

    } catch (err: unknown) {
        appLogger.error('[deckActions - getDecks] Caught unexpected error:', err);
        return { data: null, error: err instanceof Error ? err.message : 'An unexpected error occurred while fetching decks.' };
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
        // Skip revalidatePath for edit page to prevent page refresh during editing
        revalidatePath('/');
        revalidatePath('/study/select');
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

export async function deleteDecks(
    deckIds: string[]
): Promise<ActionResult<{ deletedCount: number }>> {
    appLogger.info(`[deckActions - deleteDecks] Action started for ${deckIds.length} decks`);
    
    if (!deckIds || deckIds.length === 0) {
        return { data: null, error: 'At least one deck ID is required.' };
    }

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            appLogger.error('[deckActions - deleteDecks] Auth error:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }

        appLogger.info(`[deckActions - deleteDecks] User: ${user.id}, Deleting ${deckIds.length} decks`);
        
        // Delete multiple decks in a single query
        const { error: deleteError, count } = await supabase
            .from('decks')
            .delete()
            .in('id', deckIds)
            .eq('user_id', user.id);

        if (deleteError) {
            appLogger.error('[deckActions - deleteDecks] Delete error:', deleteError);
            return { data: null, error: deleteError.message || 'Failed to delete decks.' };
        }

        const deletedCount = count || 0;
        appLogger.info(`[deckActions - deleteDecks] Successfully deleted ${deletedCount} decks`);
        
        // Revalidate paths
        revalidatePath('/');
        revalidatePath('/study/select');
        revalidatePath('/manage/decks');
        
        return { data: { deletedCount }, error: null };
        
    } catch (error) {
        appLogger.error('[deckActions - deleteDecks] Caught unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting decks';
        return { data: null, error: errorMessage };
    }
}

export async function mergeDecks(
    deckIds: string[],
    mergeData: {
        name: string;
        is_bilingual: boolean;
        primary_language: string;
        secondary_language: string;
        tags: Array<{ id: string; name: string; }>;
    }
): Promise<ActionResult<Tables<'decks'>>> {
    appLogger.info(`[deckActions - mergeDecks] Action started for ${deckIds.length} decks`);
    
    if (!deckIds || deckIds.length < 2) {
        return { data: null, error: 'At least two deck IDs are required for merging.' };
    }

    if (!mergeData.name.trim() || !mergeData.primary_language.trim()) {
        return { data: null, error: 'Deck name and primary language are required.' };
    }

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            appLogger.error('[deckActions - mergeDecks] Auth error:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }

        appLogger.info(`[deckActions - mergeDecks] User: ${user.id}, Merging ${deckIds.length} decks`);
        
        // 1. Create the new merged deck
        const newDeckData: Database['public']['Tables']['decks']['Insert'] = {
            user_id: user.id,
            name: mergeData.name.trim(),
            primary_language: mergeData.primary_language.trim(),
            secondary_language: mergeData.is_bilingual ? mergeData.secondary_language.trim() : undefined,
            is_bilingual: mergeData.is_bilingual,
        };

        const { data: newDeck, error: createError } = await supabase
            .from('decks')
            .insert(newDeckData)
            .select()
            .single();

        if (createError || !newDeck) {
            appLogger.error('[deckActions - mergeDecks] Error creating new deck:', createError);
            return { data: null, error: createError?.message || 'Failed to create merged deck.' };
        }

        appLogger.info(`[deckActions - mergeDecks] Created new deck with ID: ${newDeck.id}`);

        // 2. Move all cards from source decks to the new deck
        const { error: moveCardsError } = await supabase
            .from('cards')
            .update({ deck_id: newDeck.id })
            .in('deck_id', deckIds)
            .eq('user_id', user.id);

        if (moveCardsError) {
            appLogger.error('[deckActions - mergeDecks] Error moving cards:', moveCardsError);
            // Rollback: delete the created deck
            await supabase.from('decks').delete().eq('id', newDeck.id);
            return { data: null, error: 'Failed to move cards to merged deck.' };
        }

        // 3. Delete the original decks
        const { error: deleteError } = await supabase
            .from('decks')
            .delete()
            .in('id', deckIds)
            .eq('user_id', user.id);

        if (deleteError) {
            appLogger.error('[deckActions - mergeDecks] Error deleting original decks:', deleteError);
            // Note: Cards have already been moved, so we don't rollback completely
            // but we log this as a warning
            appLogger.warn('[deckActions - mergeDecks] Cards were moved successfully, but original decks could not be deleted');
        }

        appLogger.info(`[deckActions - mergeDecks] Successfully merged ${deckIds.length} decks into ${newDeck.id}`);
        
        // Revalidate paths
        revalidatePath('/');
        revalidatePath('/study/select');
        revalidatePath('/manage/decks');
        
        return { data: newDeck, error: null };
        
    } catch (error) {
        appLogger.error('[deckActions - mergeDecks] Caught unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error merging decks';
        return { data: null, error: errorMessage };
    }
}

// Swap Q/A for an entire deck: swaps deck languages and, for every card in the deck,
// swaps question<->answer and related classification fields.
export async function swapDeckQA(
    deckId: string
): Promise<ActionResult<{ updatedCards: number }>> {
    appLogger.info(`[deckActions - swapDeckQA] Start for deckId: ${deckId}`);
    if (!deckId) return { data: null, error: 'Deck ID is required.' };
    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            appLogger.error('[deckActions - swapDeckQA] Auth error:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }

        // 1) Load deck to confirm ownership and fetch languages
        const { data: deckRow, error: deckErr } = await supabase
            .from('decks')
            .select('id, primary_language, secondary_language, is_bilingual, user_id')
            .eq('id', deckId)
            .eq('user_id', user.id)
            .maybeSingle();
        if (deckErr) {
            appLogger.error('[deckActions - swapDeckQA] Deck fetch error:', deckErr);
            return { data: null, error: deckErr.message || 'Failed to fetch deck.' };
        }
        if (!deckRow) {
            return { data: null, error: 'Deck not found or access denied.' };
        }

        // 2) Fetch cards (only needed fields)
        const { data: cards, error: cardsErr } = await supabase
            .from('cards')
            .select('id, question, answer, question_part_of_speech, question_gender, answer_part_of_speech, answer_gender')
            .eq('deck_id', deckId)
            .eq('user_id', user.id);
        if (cardsErr) {
            appLogger.error('[deckActions - swapDeckQA] Fetch cards error:', cardsErr);
            return { data: null, error: cardsErr.message || 'Failed to fetch cards.' };
        }

        const updatedCardsPayload = (cards || []).map((c) => ({
            id: c.id,
            question: c.answer,
            answer: c.question,
            question_part_of_speech: c.answer_part_of_speech,
            question_gender: c.answer_gender,
            answer_part_of_speech: c.question_part_of_speech,
            answer_gender: c.question_gender,
        }));

        // 3) Update cards individually to comply with RLS (avoid UPSERT INSERT path)
        let updatedCount = 0;
        for (const payload of updatedCardsPayload) {
            const { error: updErr } = await supabase
                .from('cards')
                .update({
                    question: payload.question,
                    answer: payload.answer,
                    question_part_of_speech: payload.question_part_of_speech,
                    question_gender: payload.question_gender,
                    answer_part_of_speech: payload.answer_part_of_speech,
                    answer_gender: payload.answer_gender,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payload.id)
                .eq('user_id', user.id);
            if (updErr) {
                appLogger.error('[deckActions - swapDeckQA] Update card error:', { id: payload.id, error: updErr });
                return { data: null, error: updErr.message || 'Failed to update a card.' };
            }
            updatedCount += 1;
        }

        // 4) Swap deck languages
        const { error: deckUpdateErr } = await supabase
            .from('decks')
            .update({
                primary_language: deckRow.secondary_language ?? deckRow.primary_language,
                secondary_language: deckRow.primary_language ?? deckRow.secondary_language,
            })
            .eq('id', deckId)
            .eq('user_id', user.id);
        if (deckUpdateErr) {
            appLogger.error('[deckActions - swapDeckQA] Deck language update error:', deckUpdateErr);
            return { data: null, error: deckUpdateErr.message || 'Failed to update deck languages.' };
        }

        appLogger.info(`[deckActions - swapDeckQA] Success. Updated ${updatedCount} cards.`);
        revalidatePath(`/edit/${deckId}`);
        return { data: { updatedCards: updatedCount }, error: null };
    } catch (error) {
        appLogger.error('[deckActions - swapDeckQA] Unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error during swap' };
    }
}

/**
 * @deprecated Prefer using the main `getDecks()` function which now uses the new RPC.
 */
export async function getDecksWithSrsCounts(): Promise<ActionResult<DeckListItemWithCounts[]>> {
  appLogger.warn("[deckActions - getDecksWithSrsCounts] This function is deprecated. Use getDecks() instead.");
  return getDecks();
}