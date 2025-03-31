"use server";

import { createActionClient } from "@/lib/supabase/server";
// import { cookies } from "next/headers";
import type { DbCard } from "@/types/database";
import type { FlashCard } from "@/types/deck"; // Assuming FlashCard is the frontend type

/**
 * Maps a card object from the database (snake_case) to the frontend FlashCard type (camelCase).
 * Converts timestamp strings to Date objects.
 * 
 * @param dbCard The card object fetched from the database.
 * @returns The mapped FlashCard object.
 */
function mapDbCardToFlashCard(
    dbCard: DbCard, 
    deckLanguagesMap: Map<string, { questionLang: string | null, answerLang: string | null }>
): FlashCard {
    // Get languages from the map using the card's deck_id
    const deckLangs = deckLanguagesMap.get(dbCard.deck_id) || { questionLang: null, answerLang: null };
    const deckQuestionLanguage = deckLangs.questionLang;
    const deckAnswerLanguage = deckLangs.answerLang;

    const flashCard: FlashCard = {
        id: dbCard.id,
        deck_id: dbCard.deck_id,
        question: dbCard.question,
        answer: dbCard.answer,
        // Assign deck languages using correct names
        deckQuestionLanguage: deckQuestionLanguage, // Renamed field
        deckAnswerLanguage: deckAnswerLanguage,   // Renamed field
        // Keep original card-specific languages if they exist (might be overrides)
        questionLanguage: dbCard.questionLanguage ?? null,
        answerLanguage: dbCard.answerLanguage ?? null,
        correctCount: dbCard.correct_count ?? 0,
        incorrectCount: dbCard.incorrect_count ?? 0,
        attemptCount: (dbCard.correct_count ?? 0) + (dbCard.incorrect_count ?? 0),
        last_reviewed_at: dbCard.last_reviewed_at,
        next_review_due: dbCard.next_review_due,
        srs_level: dbCard.srs_level ?? 0,
        easiness_factor: dbCard.easiness_factor,
        interval_days: dbCard.interval_days,
        stability: dbCard.stability,
        difficulty: dbCard.difficulty,
        last_review_grade: dbCard.last_review_grade,
    };
    return flashCard;
}

/**
 * Fetches multiple cards by their IDs for the authenticated user.
 * 
 * @param cardIds An array of card UUIDs to fetch.
 * @returns Promise<{ data: FlashCard[] | null, error: Error | null }>
 */
export async function getCardsByIds(cardIds: string[]): Promise<{ data: FlashCard[] | null, error: Error | null }> {
    console.log(`[getCardsByIds] Action started for ${cardIds.length} card IDs:`, cardIds);
    if (!cardIds || cardIds.length === 0) {
        return { data: [], error: null };
    }
    
    const supabase = createActionClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("[getCardsByIds] Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }
    console.log("[getCardsByIds] User authenticated:", user.id);

    try {
        console.log(`[getCardsByIds] Fetching ${cardIds.length} cards for user: ${user.id}`);
        // Step 1: Fetch only card data
        const { data: dbCards, error: fetchCardsError } = await supabase
            .from('cards')
            .select(`*`) // Select only card columns
            .in('id', cardIds)
            .returns<DbCard[]>(); // Add type hint for return

        console.log("[getCardsByIds] Supabase card fetch result:", { dbCards, fetchCardsError });

        if (fetchCardsError) {
            console.error("[getCardsByIds] Supabase card fetch error:", fetchCardsError);
            throw fetchCardsError;
        }

        if (!dbCards || dbCards.length === 0) {
             console.warn("[getCardsByIds] No cards found for the given IDs.");
            return { data: [], error: null };
        }

        // Step 2: Fetch deck languages separately
        const uniqueDeckIds = [...new Set(dbCards.map(card => card.deck_id))];
        console.log("[getCardsByIds] Fetching languages for unique deck IDs:", uniqueDeckIds);
        
        const { data: deckLanguagesData, error: fetchDecksError } = await supabase
            .from('decks')
            .select('id, question_language, answer_language') // Use correct column names
            .in('id', uniqueDeckIds);
            
        console.log("[getCardsByIds] Supabase deck languages fetch result:", { deckLanguagesData, fetchDecksError });

        if (fetchDecksError) {
            console.error("[getCardsByIds] Supabase deck languages fetch error:", fetchDecksError);
            // Decide if this is critical - maybe proceed without deck languages?
            // For now, let's treat it as an error that prevents mapping.
            throw fetchDecksError; 
        }

        // Create a map for easy lookup: deckId -> { questionLang, answerLang }
        const deckLanguagesMap = new Map<string, { questionLang: string | null, answerLang: string | null }>();
        deckLanguagesData?.forEach(deck => {
            deckLanguagesMap.set(deck.id, { 
                questionLang: deck.question_language,
                answerLang: deck.answer_language 
            });
        });
        console.log("[getCardsByIds] Created deck languages map:", deckLanguagesMap);

        // Step 3: Map cards using the fetched languages
        const flashCards = dbCards.map(card => mapDbCardToFlashCard(card, deckLanguagesMap));
        console.log(`[getCardsByIds] Successfully fetched and mapped ${flashCards.length} cards.`);
        
        return { data: flashCards, error: null };

    } catch (error) {
        console.error("[getCardsByIds] Caught error:", error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to fetch card details") };
    }
}

// TODO: Implement function to get a single card by ID (if needed elsewhere)
// This can be refactored to use the same mapping logic
export async function getCardById(cardId: string): Promise<{ data: FlashCard | null, error: Error | null }> {
     const supabase = createActionClient();
     
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

        const mappedCard = mapDbCardToFlashCard(dbCard, new Map<string, { questionLang: string | null, answerLang: string | null }>());
        console.log("getCardById: Successfully fetched and mapped card:", cardId);
        return { data: mappedCard, error: null };

    } catch (error) {
         console.error("getCardById: Unexpected error:", cardId, error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to fetch card by ID.") };
    }
}

// Add other card-related actions if necessary (e.g., create, update, delete)
// These might overlap with deckService.ts initially; decide on final location/structure.

// --- Add other card CRUD actions if needed (Create, Update, Delete) ---
// Placeholder for potential future actions like creating/updating/deleting single cards
// outside the deckService context, although deckService might still be suitable.

// Example: Create a single card (maybe useful for quick add?)
/*
export async function createCard(deckId: string, cardData: Omit<FlashCard, 'id' | 'user_id' | 'deck_id' | 'created_at' | 'updated_at' | 'srs_level' | 'easiness_factor' | 'interval_days' | 'last_reviewed_at' | 'next_review_due' | 'last_review_grade'>):
    Promise<{ data: FlashCard | null, error: Error | null }> {

    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { data: null, error: new Error("User not authenticated.") };
    }

    // Optional: Check if user owns the deckId first

    try {
        const { data, error } = await supabase
            .from('cards')
            .insert({
                ...cardData,
                deck_id: deckId,
                user_id: user.id,
                // Default SRS values are set by DB
            })
            .select("*")
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error("Error creating card:", error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to create card.") };
    }
}
*/ 