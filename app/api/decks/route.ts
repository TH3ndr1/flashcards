// app/api/decks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createActionClient } from '@/lib/supabase/server';
import type { ApiFlashcard } from '../extract-pdf/types';
import type { Database, Tables } from '@/types/database';
// --- Import the NEW batch action ---
import { createCardsBatch, type CreateCardInput } from '@/lib/actions/cardActions'; // Adjust path if needed
import { appLogger } from '@/lib/logger';

// Define the expected request body structure (remains the same)
interface CreateDeckRequestBody {
    name: string;
    questionLanguage: string;
    answerLanguage: string;
    isBilingual: boolean;
    flashcards: ApiFlashcard[]; // Expect the full ApiFlashcard structure
}

export async function POST(request: NextRequest) {
    appLogger.info("[API POST /api/decks] Received request to create deck.");
    const supabase = createActionClient(); // Used for deck creation only now

    try {
        // 1. Get User Session (No change)
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            appLogger.error("[API POST /api/decks] Authentication error:", authError);
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }
        appLogger.info(`[API POST /api/decks] User authenticated: ${user.id}`);

        // 2. Parse Request Body (No change)
        let body: CreateDeckRequestBody;
        try {
             body = await request.json();
        } catch (jsonError: unknown) {
             appLogger.error("[API POST /api/decks] Error parsing JSON body:", jsonError);
             return NextResponse.json({ success: false, message: `Invalid JSON format in request body: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}` }, { status: 400 });
        }

        const { name, questionLanguage, answerLanguage, isBilingual, flashcards } = body;

        // 3. Validate Input (No change)
        if (!name || !questionLanguage || !answerLanguage || flashcards === undefined || flashcards === null) {
            return NextResponse.json({ success: false, message: 'Missing required fields: name, questionLanguage, answerLanguage, flashcards (array, can be empty)' }, { status: 400 });
        }
        if (!Array.isArray(flashcards)) {
             return NextResponse.json({ success: false, message: 'Field "flashcards" must be an array.' }, { status: 400 });
        }
        appLogger.info(`[API POST /api/decks] Input validation passed. Creating deck "${name}" with ${flashcards.length} potential cards.`);

        // 4. Insert Deck into Supabase (No change)
        const deckToInsert: Database['public']['Tables']['decks']['Insert'] = {
                user_id: user.id,
                name: name.trim(),
                primary_language: questionLanguage,
                secondary_language: answerLanguage,
                is_bilingual: isBilingual,
        };

        const { data: deckData, error: deckError } = await supabase
            .from('decks')
            .insert(deckToInsert)
            .select()
            .single();

        if (deckError || !deckData) {
            appLogger.error("[API POST /api/decks] Error inserting deck:", deckError);
             if (deckError?.message.includes('duplicate key value violates unique constraint')) {
                 return NextResponse.json({ success: false, message: 'A deck with this name already exists.' }, { status: 409 });
             }
            return NextResponse.json({ success: false, message: `Failed to create deck: ${deckError?.message || 'Unknown DB error'}` }, { status: 500 });
        }

        const newDeckId = deckData.id;
        appLogger.info(`[API POST /api/decks] Deck metadata created successfully with ID: ${newDeckId}`);

        let insertedCardsCount = 0;
        let cardCreationError: string | null = null;

        // 5. Prepare and Insert Cards using Batch Action
        if (flashcards.length > 0) {
            appLogger.info(`[API POST /api/decks] Preparing ${flashcards.length} cards for batch action into deck ${newDeckId}...`);

            // --- Prepare data for the batch action ---
            // Map ApiFlashcard[] to CreateCardInput[] expected by the action
            const cardDataForAction: CreateCardInput[] = flashcards.map(card => ({
                question: card.question,
                answer: card.answer,
                question_part_of_speech: card.questionPartOfSpeech, // Pass through classification fields
                question_gender: card.questionGender,
                answer_part_of_speech: card.answerPartOfSpeech,
                answer_gender: card.answerGender,
            }));

            // --- Call the batch action ---
            const batchResult = await createCardsBatch(newDeckId, cardDataForAction);

            if (batchResult.error || batchResult.data === null) {
                // --- Handle error from batch action ---
                cardCreationError = batchResult.error || 'Unknown error during batch card creation.';
                appLogger.error(`[API POST /api/decks] Error calling createCardsBatch for deck ${newDeckId}:`, cardCreationError);

                // Attempt rollback
                try {
                     await supabase.from('decks').delete().eq('id', newDeckId);
                     appLogger.info(`[API POST /api/decks] Rolled back deck creation (ID: ${newDeckId}) due to card batch error.`);
                } catch (rollbackError: unknown) {
                    appLogger.error(`[API POST /api/decks] CRITICAL: Failed to rollback deck ${newDeckId} after card batch failure:`, rollbackError);
                    cardCreationError += ' Rollback also failed.'; // Append rollback failure info
                }
                return NextResponse.json({ success: false, message: `Failed to insert cards, deck creation rolled back: ${cardCreationError}` }, { status: 500 });

            } else {
                // --- Success from batch action ---
                insertedCardsCount = batchResult.data.insertedCount;
                appLogger.info(`[API POST /api/decks] createCardsBatch action succeeded. Inserted Count: ${insertedCardsCount}`);
                if (insertedCardsCount < flashcards.length) {
                     appLogger.warn(`[API POST /api/decks] Note: ${flashcards.length - insertedCardsCount} card(s) were skipped during batch validation within the action.`);
                }
            }
        } else {
            appLogger.info(`[API POST /api/decks] No cards provided in request, only created deck metadata for ID: ${newDeckId}.`);
        }


        // 7. Return Success Response
        // Construct message based on outcome
        let message = `Deck "${name}" created successfully`;
        if (flashcards.length > 0) {
            if (insertedCardsCount > 0) {
                message += ` with ${insertedCardsCount} valid card(s)${insertedCardsCount < flashcards.length ? ` (${flashcards.length - insertedCardsCount} skipped)` : ''}.`;
            } else {
                 message += ', but no valid cards were inserted after validation.';
            }
        } else {
            message += '.'; // Just created deck metadata
        }

        return NextResponse.json({
            success: true,
            message: message,
            deckId: newDeckId,
            deck: deckData as Tables<'decks'>
        }, { status: 201 });

    } catch (error: unknown) {
        appLogger.error("[API POST /api/decks] Unhandled error in POST handler:", error);
        // Keep generic error handlers
        if (error instanceof SyntaxError) {
             return NextResponse.json({ success: false, message: 'Invalid JSON in request body' }, { status: 400 });
        }
        return NextResponse.json({ success: false, message: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
    }
}