"use server";

import { createActionClient } from "@/lib/supabase/server";
import type { Database, Tables } from "@/types/database";
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/actions/types';
import { appLogger, statusLogger } from '@/lib/logger';

// isCalledFromDynamicRoute function remains unchanged (if still needed elsewhere)

// getCardsByIds function remains unchanged (already updated select)
export async function getCardsByIds(
    cardIds: string[]
): Promise<ActionResult<Tables<'cards'>[]>> {
    appLogger.info(`[getCardsByIds] Action started for ${cardIds.length} cards`);

    if (!cardIds || cardIds.length === 0) {
        appLogger.info("[getCardsByIds] No card IDs provided.");
        return { data: [], error: null };
    }

    try {
        const supabase = await createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            appLogger.error('[getCardsByIds] Auth error or no user:', authError);
            return { data: [], error: authError?.message || 'Not authenticated' };
        }

        appLogger.info(`[getCardsByIds] User authenticated: ${user.id}, fetching ${cardIds.length} cards`);

        const validCardIds = cardIds.filter(id => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id));
        if (validCardIds.length !== cardIds.length) {
             appLogger.warn("[getCardsByIds] Some invalid UUIDs were filtered out.");
        }
        if (validCardIds.length === 0) {
             appLogger.info("[getCardsByIds] No valid card IDs remaining after filtering.");
            return { data: [], error: null };
        }

        // Select clause already updated previously
        const { data: dbCards, error: dbError } = await supabase
            .from('cards')
            .select(`
                *,
                question_part_of_speech,
                question_gender,
                answer_part_of_speech,
                answer_gender,
                decks!inner ( primary_language, secondary_language, status )
            `)
            .in('id', validCardIds)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .eq('decks.status', 'active');

        if (dbError) {
            appLogger.error('[getCardsByIds] Database error:', dbError);
            return { data: [], error: dbError.message || 'Database query failed' };
        }

        if (!dbCards || dbCards.length === 0) {
            appLogger.info('[getCardsByIds] No cards found or user does not have access');
            return { data: [], error: null };
        }

        appLogger.info(`[getCardsByIds] Successfully fetched ${dbCards.length} cards`);
        return { data: dbCards as Tables<'cards'>[], error: null };

    } catch (error) {
        appLogger.error('[getCardsByIds] Caught unexpected error:', error);
        return { data: [], error: error instanceof Error ? error.message : 'Unknown error fetching cards by IDs' };
    }
}


// getCardById function remains unchanged (already updated select)
export async function getCardById(
    cardId: string,
    isDynamicRoute = false
): Promise<ActionResult<Tables<'cards'>>> {
    appLogger.info(`[getCardById] Fetching card: ${cardId}`);
    const supabase = await createActionClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        appLogger.error('[getCardById] Auth error or no user:', authError);
        return { data: null, error: authError?.message || 'Not authenticated' };
    }

    appLogger.info("Fetching single card:", cardId, "for user:", user.id);

    try {
         // Select clause already updated previously
         const { data: dbCard, error } = await supabase
            .from('cards')
             .select(`
                 *,
                 question_part_of_speech,
                 question_gender,
                 answer_part_of_speech,
                 answer_gender
              `)
             .eq('id', cardId)
             .maybeSingle<Tables<'cards'>>();

        if (error) {
            appLogger.error('[getCardById] Database error:', error);
            return { data: null, error: error.message || 'Database query failed' };
        }

        if (!dbCard) {
            appLogger.info("getCardById: Card not found:", cardId);
            return { data: null, error: null }; // Not an error, just not found
        }

        return { data: dbCard, error: null };

    } catch (error) {
         appLogger.error('[getCardById] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error fetching card' };
    }
}


// --- UPDATED Zod Schemas ---
const baseCardSchema = z.object({
    question: z.string().trim().min(1, "Question cannot be empty."),
    answer: z.string().trim().min(1, "Answer cannot be empty."),
    // Optional classification fields
    question_part_of_speech: z.string().optional().nullable(),
    question_gender: z.string().optional().nullable(),
    answer_part_of_speech: z.string().optional().nullable(),
    answer_gender: z.string().optional().nullable(),
});

// Schema for creating (requires Q/A, classifications optional)
const createCardSchema = baseCardSchema;
// --- FIX: Add export ---
export type CreateCardInput = z.infer<typeof createCardSchema>;

// Schema for updating (all fields optional)
const updateCardSchema = baseCardSchema.partial();
// --- FIX: Add export ---
export type UpdateCardInput = z.infer<typeof updateCardSchema>;


/**
 * Creates a single new flashcard (e.g., for manual addition).
 * For bulk creation (AI flow), use createCardsBatch.
 *
 * @param deckId - ID of the deck to create the card in
 * @param inputData - Card data including Q/A and optional classifications
 * @returns The created card
 */
export async function createCard(
    deckId: string,
    inputData: CreateCardInput // Expects object with optional classifications
): Promise<ActionResult<Tables<'cards'>>> {
    appLogger.info(`[createCard - Single] Action started for deckId: ${deckId}`);
    if (!deckId) return { data: null, error: 'Deck ID is required.' };

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             appLogger.error('[createCard - Single] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        const validation = createCardSchema.safeParse(inputData);
        if (!validation.success) {
             appLogger.warn("[createCard - Single] Validation failed:", validation.error.errors);
             return { data: null, error: validation.error.errors[0].message };
        }
        // Extract all fields from validated data
        const {
            question,
            answer,
            question_part_of_speech,
            question_gender,
            answer_part_of_speech,
            answer_gender
        } = validation.data;

        // Verify user owns the target deck (unchanged)
        const { count: deckCount, error: deckCheckError } = await supabase
            .from('decks')
            .select('id', { count: 'exact', head: true })
            .eq('id', deckId)
            .eq('user_id', user.id)
            .eq('status', 'active');

        if (deckCheckError || deckCount === 0) {
             appLogger.error('[createCard - Single] Deck ownership check failed:', deckCheckError);
             return { data: null, error: 'Target deck not found or access denied.' };
        }

        appLogger.info(`[createCard - Single] User: ${user.id}, Creating card in deck ${deckId}`);

        // Insert Payload (Uses validated data)
        const insertPayload: Database['public']['Tables']['cards']['Insert'] = {
            user_id: user.id,
            deck_id: deckId,
            question: question,
            answer: answer,
            question_part_of_speech: question_part_of_speech ?? 'N/A',
            question_gender: question_gender ?? 'N/A',
            answer_part_of_speech: answer_part_of_speech ?? 'N/A',
            answer_gender: answer_gender ?? 'N/A',
            // Set SRS defaults explicitly
            srs_level: 0,
            easiness_factor: 2.5,
            interval_days: 0,
            stability: null,
            difficulty: null,
            next_review_due: null,
            last_reviewed_at: null,
            last_review_grade: null,
            attempt_count: 0,
            correct_count: 0,
            incorrect_count: 0,
        };

        const { data: newCard, error: insertError } = await supabase
            .from('cards')
            .insert(insertPayload)
             // Select clause already updated previously
            .select(`
                *,
                question_part_of_speech,
                question_gender,
                answer_part_of_speech,
                answer_gender,
                decks(primary_language, secondary_language)
            `)
            .single();

        if (insertError) {
            appLogger.error('[createCard - Single] Insert error:', insertError);
            return { data: null, error: insertError.message || 'Failed to create card.' };
        }

        if (!newCard) {
             appLogger.error('[createCard - Single] Insert succeeded but no data returned.');
             return { data: null, error: 'Failed to retrieve created card data.' };
        }

        appLogger.info(`[createCard - Single] Success, New Card ID: ${newCard.id}`);
        revalidatePath(`/edit/${deckId}`);
        return { data: newCard as Tables<'cards'>, error: null };

    } catch (error) {
        appLogger.error('[createCard - Single] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error creating card' };
    }
}


/**
 * Updates an existing flashcard.
 *
 * @param cardId - ID of the card to update
 * @param inputData - Partial card object including optional classifications
 * @returns The updated card
 */
export async function updateCard(
    cardId: string,
    inputData: UpdateCardInput // Uses updated schema type
): Promise<ActionResult<Tables<'cards'>>> {
    appLogger.info(`[updateCard] Action started for cardId: ${cardId}`);
    if (!cardId) return { data: null, error: 'Card ID is required.' };

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             appLogger.error('[updateCard] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        const validation = updateCardSchema.safeParse(inputData);
        if (!validation.success) {
             appLogger.warn("[updateCard] Validation failed:", validation.error.errors);
             return { data: null, error: validation.error.errors[0].message };
        }
        const updatePayload = validation.data; // Contains validated optional fields

        if (Object.keys(updatePayload).length === 0) {
             return { data: null, error: "No fields provided for update." };
        }

        appLogger.info(`[updateCard] User: ${user.id}, Updating card ${cardId} with:`, updatePayload);

        // Update logic remains largely the same, Supabase handles optional fields
        const { data: updatedCard, error: updateError } = await supabase
            .from('cards')
            .update({
                ...updatePayload,
                updated_at: new Date().toISOString() // Manually set updated_at
            })
            .eq('id', cardId)
            .eq('user_id', user.id)
            // Select clause already updated previously
            .select(`
                *,
                question_part_of_speech,
                question_gender,
                answer_part_of_speech,
                answer_gender,
                decks(primary_language, secondary_language)
            `)
            .single();

        if (updateError) {
            appLogger.error('[updateCard] Update error:', updateError);
            return { data: null, error: updateError.message || 'Failed to update card.' };
        }

        if (!updatedCard) {
             appLogger.warn(`[updateCard] Card ${cardId} not found or not authorized for update.`);
             return { data: null, error: 'Card not found or update failed.' };
        }

        appLogger.info(`[updateCard] Success, ID: ${updatedCard.id}`);
        // Revalidation logic remains the same
        return { data: updatedCard as Tables<'cards'>, error: null };

    } catch (error) {
        appLogger.error('[updateCard] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error updating card' };
    }
}


// Batch Creation Action (already updated)
export async function createCardsBatch(
    deckId: string,
    cardsData: CreateCardInput[] // Expects array of objects matching the schema
): Promise<ActionResult<{ insertedCount: number }>> {
    appLogger.info(`[createCardsBatch] Action started for deckId: ${deckId}, batch size: ${cardsData?.length}`);
    if (!deckId) return { data: null, error: 'Deck ID is required.' };
    if (!cardsData || cardsData.length === 0) {
        appLogger.info('[createCardsBatch] No card data provided.');
        return { data: { insertedCount: 0 }, error: null }; // Not an error, just nothing to insert
    }

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
             appLogger.error('[createCardsBatch] Auth error:', authError);
             return { data: null, error: authError?.message || 'Not authenticated' };
        }

        // Verify user owns the target deck ONCE (Unchanged)
        const { count: deckCount, error: deckCheckError } = await supabase
            .from('decks')
            .select('id', { count: 'exact', head: true })
            .eq('id', deckId)
            .eq('user_id', user.id)
            .eq('status', 'active');

        if (deckCheckError || deckCount === 0) {
             appLogger.error('[createCardsBatch] Deck ownership check failed:', deckCheckError);
             return { data: null, error: 'Target deck not found or access denied.' };
        }

        appLogger.info(`[createCardsBatch] User: ${user.id}, Preparing ${cardsData.length} cards for batch insert into deck ${deckId}`);

        // Map and Filter in one go using reduce
        const cardsToInsert = cardsData.reduce<Database['public']['Tables']['cards']['Insert'][]>((acc, inputCard) => {
            const validation = createCardSchema.safeParse(inputCard);
            if (!validation.success) {
                appLogger.warn("[createCardsBatch] Skipping invalid card data:", validation.error.errors, inputCard);
                return acc;
            }

            const {
                question,
                answer,
                question_part_of_speech,
                question_gender,
                answer_part_of_speech,
                answer_gender
            } = validation.data;

            acc.push({
                user_id: user.id,
                deck_id: deckId,
                question: question,
                answer: answer,
                question_part_of_speech: question_part_of_speech ?? 'N/A',
                question_gender: question_gender ?? 'N/A',
                answer_part_of_speech: answer_part_of_speech ?? 'N/A',
                answer_gender: answer_gender ?? 'N/A',
                srs_level: 0,
                easiness_factor: 2.5,
                interval_days: 0,
                stability: null,
                difficulty: null,
                next_review_due: null,
                last_reviewed_at: null,
                last_review_grade: null,
                attempt_count: 0,
                correct_count: 0,
                incorrect_count: 0,
            });
            return acc;
        }, []);


        if (cardsToInsert.length === 0) {
            appLogger.warn(`[createCardsBatch] No valid cards remaining after validation for deck ${deckId}.`);
            return { data: { insertedCount: 0 }, error: null };
        }

        appLogger.info(`[createCardsBatch] Inserting ${cardsToInsert.length} valid cards...`);

        const { error: insertError } = await supabase
            .from('cards')
            .insert(cardsToInsert);

        if (insertError) {
            appLogger.error('[createCardsBatch] Batch insert error:', insertError);
            return { data: null, error: insertError.message || 'Failed to create cards in batch.' };
        }

        const insertedCount = cardsToInsert.length;
        appLogger.info(`[createCardsBatch] Success, Inserted Count: ${insertedCount}`);
        revalidatePath(`/edit/${deckId}`);
        return { data: { insertedCount }, error: null };

    } catch (error) {
        appLogger.error('[createCardsBatch] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error creating cards in batch' };
    }
}


// getCardsByDeckId function remains unchanged (already updated select)
export async function getCardsByDeckId(deckId: string): Promise<ActionResult<Tables<'cards'>[]>> {
    // Implementation already updated...
    appLogger.info(`[getCardsByDeckId] Fetching cards for deck: ${deckId}`);
    const supabase = createActionClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        appLogger.error('[getCardsByDeckId] Auth error:', authError);
        return { data: null, error: authError?.message || 'Not authenticated' };
    }

        const { data, error } = await supabase
        .from('cards')
        .select(`
            *,
            question_part_of_speech,
            question_gender,
            answer_part_of_speech,
            answer_gender
        `)
        .eq('deck_id', deckId)
        .eq('user_id', user.id)
        .eq('status', 'active');

    if (error) {
        appLogger.error(`[getCardsByDeckId] Error fetching cards for deck ${deckId}:`, error);
        return { data: null, error: error.message || 'Failed to fetch cards' };
    }

    return { data: (data || []) as Tables<'cards'>[], error: null };
}


// deleteCard function remains unchanged
export async function deleteCard(cardId: string): Promise<ActionResult<null>> {
    // Implementation remains the same...
    appLogger.info(`[deleteCard] Action started for cardId: ${cardId}`);
    if (!cardId) return { data: null, error: 'Card ID is required.' };

    try {
        const supabase = createActionClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            appLogger.error('[deleteCard] Auth error:', authError);
            return { data: null, error: authError?.message || 'Not authenticated' };
        }

        const { error: deleteError } = await supabase
            .from('cards')
            .delete()
            .eq('id', cardId)
            .eq('user_id', user.id);

        if (deleteError) {
            appLogger.error('[deleteCard] Delete error:', deleteError);
            return { data: null, error: deleteError.message || 'Failed to delete card.' };
        }

        return { data: null, error: null };

    } catch (error) {
        appLogger.error('[deleteCard] Caught unexpected error:', error);
        return { data: null, error: error instanceof Error ? error.message : 'Unknown error deleting card' };
    }
}

/**
 * Efficiently retrieves only SRS state information for a list of card IDs
 * Used for optimized card counting by SRS state without fetching full card data
 */
export async function getCardSrsStatesByIds(cardIds: string[]): Promise<ActionResult<Partial<Tables<'cards'>>[]>> {
  try {
    // If no card IDs provided, return empty result
    if (!cardIds?.length) {
      return { data: [], error: null };
    }

    // Create Supabase client
    const supabase = createActionClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      appLogger.error('Error in authentication:', authError);
      return { error: 'Not authenticated', data: null };
    }

    // Limited to 1000 cards for performance reasons
    const limitedCardIds = cardIds.slice(0, 1000);

    // Fetch only the SRS-related fields we need for counting
    const { data, error } = await supabase
      .from('cards')
      .select(`
        id,
        srs_level,
        learning_state,
        next_review_due,
        learning_step_index,
        failed_attempts_in_learn,
        hard_attempts_in_learn
      `)
      .in('id', limitedCardIds)
      .eq('user_id', user.id);

    if (error) {
      appLogger.error('Error fetching card SRS states:', error);
      return { error: error.message, data: null };
    }

    return { data, error: null };
  } catch (error) {
    appLogger.error('Error in getCardSrsStatesByIds:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error getting card SRS states',
      data: null
    };
  }
}