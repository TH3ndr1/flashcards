// app/api/decks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createActionClient } from '@/lib/supabase/server';
// Adjust path if ApiFlashcard lives elsewhere (e.g., @/types/flashcard)
import type { ApiFlashcard } from '../extract-pdf/types';
// --- FIX: Import Database type directly for Insert/Update types ---
import type { Database, Tables, Json } from '@/types/database';

// Define the expected request body structure
interface CreateDeckRequestBody {
    name: string;
    questionLanguage: string;
    answerLanguage: string;
    isBilingual: boolean;
    flashcards: Array<{ question: string; answer: string }>; // Expect simple Q/A pairs
}

export async function POST(request: NextRequest) {
    console.log("[API POST /api/decks] Received request to create deck.");
    const supabase = createActionClient();

    try {
        // 1. Get User Session
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error("[API POST /api/decks] Authentication error:", authError);
            return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
        }
        console.log(`[API POST /api/decks] User authenticated: ${user.id}`);

        // 2. Parse Request Body
        let body: CreateDeckRequestBody;
        try {
             body = await request.json();
        } catch (jsonError: any) {
             console.error("[API POST /api/decks] Error parsing JSON body:", jsonError);
             return NextResponse.json({ success: false, message: `Invalid JSON format in request body: ${jsonError.message}` }, { status: 400 });
        }

        const { name, questionLanguage, answerLanguage, isBilingual, flashcards } = body;

        // 3. Validate Input
        if (!name || !questionLanguage || !answerLanguage || flashcards === undefined || flashcards === null) {
            return NextResponse.json({ success: false, message: 'Missing required fields: name, questionLanguage, answerLanguage, flashcards (array, can be empty)' }, { status: 400 });
        }
        if (!Array.isArray(flashcards)) {
             return NextResponse.json({ success: false, message: 'Field "flashcards" must be an array.' }, { status: 400 });
        }
        console.log(`[API POST /api/decks] Input validation passed. Creating deck "${name}" with ${flashcards.length} cards.`);

        // 4. Insert Deck into Supabase
        // --- FIX: Use direct Database type for Insert ---
        const deckToInsert: Database['public']['Tables']['decks']['Insert'] = {
                user_id: user.id,
                name: name.trim(),
                primary_language: questionLanguage,
                secondary_language: answerLanguage,
                is_bilingual: isBilingual,
                // progress might need initialization if it's JSON and required
                // progress: {} // Example if progress is Json type and non-nullable
        };

        const { data: deckData, error: deckError } = await supabase
            .from('decks')
            .insert(deckToInsert)
            .select()
            .single();

        if (deckError || !deckData) {
            console.error("[API POST /api/decks] Error inserting deck:", deckError);
             if (deckError?.message.includes('duplicate key value violates unique constraint')) {
                 return NextResponse.json({ success: false, message: 'A deck with this name already exists.' }, { status: 409 });
             }
            return NextResponse.json({ success: false, message: `Failed to create deck: ${deckError?.message || 'Unknown DB error'}` }, { status: 500 });
        }

        const newDeckId = deckData.id;
        console.log(`[API POST /api/decks] Deck metadata created successfully with ID: ${newDeckId}`);

        // --- FIX: Variable to store count of inserted cards ---
        let insertedCardsCount = 0;

        // 5. Prepare and Insert Cards *only if* flashcards array is not empty
        if (flashcards.length > 0) {
            console.log(`[API POST /api/decks] Preparing ${flashcards.length} cards for insertion into deck ${newDeckId}...`);
            // --- FIX: Use direct Database type for Insert and filter nulls ---
            const cardsToInsert: Database['public']['Tables']['cards']['Insert'][] = flashcards.map(card => {
                if (!card.question || !card.answer) {
                    console.warn("[API POST /api/decks] Skipping card with missing question/answer:", card);
                    return null; // Filter this out later
                }
                // Ensure ALL required fields for cards.Insert are provided
                const cardInsertData: Database['public']['Tables']['cards']['Insert'] = {
                    deck_id: newDeckId,
                    user_id: user.id, // Set user_id for card as well
                    question: card.question.trim(),
                    answer: card.answer.trim(),
                    srs_level: 0, // Default or use DB default
                    easiness_factor: 2.5,
                    interval_days: 0,
                    stability: 0,
                    difficulty: 0,
                    // Make sure these nullable fields match your DB schema or have defaults
                    attempt_count: 0,
                    correct_count: 0,
                    incorrect_count: 0,
                    last_review_grade: null,
                    last_reviewed_at: null,
                    next_review_due: new Date().toISOString(), // Example: Make due now
                    last_studied: null,
                    difficulty_score: null, // Ensure all nullable fields are handled
                };
                return cardInsertData;
            }).filter((card): card is Database['public']['Tables']['cards']['Insert'] => card !== null); // Type guard to remove nulls


            if (cardsToInsert.length > 0) {
                console.log(`[API POST /api/decks] Inserting ${cardsToInsert.length} valid cards...`);
                const { error: cardError } = await supabase
                    .from('cards')
                    .insert(cardsToInsert); // Insert the filtered array

                if (cardError) {
                    console.error(`[API POST /api/decks] Error inserting cards for deck ${newDeckId}:`, cardError);
                    await supabase.from('decks').delete().eq('id', newDeckId); // Attempt rollback
                    console.log(`[API POST /api/decks] Rolled back deck creation (ID: ${newDeckId}).`);
                    return NextResponse.json({ success: false, message: `Failed to insert cards, deck creation rolled back: ${cardError.message}` }, { status: 500 });
                }
                insertedCardsCount = cardsToInsert.length; // Store the count
                console.log(`[API POST /api/decks] Successfully inserted ${insertedCardsCount} cards for deck ${newDeckId}.`);
            } else {
                 console.warn(`[API POST /api/decks] No valid cards found to insert for deck ${newDeckId} after filtering.`);
                 // Deck metadata was still created. Message adjusted in final response.
            }
        } else {
            console.log(`[API POST /api/decks] No cards provided in request, only created deck metadata for ID: ${newDeckId}.`);
        }


        // 7. Return Success Response
        return NextResponse.json({
            success: true,
            // --- FIX: Use stored count for message ---
            message: `Deck "${name}" created successfully${insertedCardsCount > 0 ? ` with ${insertedCardsCount} valid cards` : (flashcards.length > 0 ? ', but no valid cards were inserted' : '')}.`,
            deckId: newDeckId,
            deck: deckData as Tables<'decks'> // Cast result data to the Row type
        }, { status: 201 });

    } catch (error: any) {
        console.error("[API POST /api/decks] Unhandled error in POST handler:", error);
        if (error instanceof SyntaxError) {
             return NextResponse.json({ success: false, message: 'Invalid JSON in request body' }, { status: 400 });
        }
        return NextResponse.json({ success: false, message: `Internal server error: ${error.message}` }, { status: 500 });
    }
}