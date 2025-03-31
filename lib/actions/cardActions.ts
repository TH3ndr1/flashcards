"use server";

import { createActionClient, createDynamicRouteClient } from "@/lib/supabase/server";
// import { cookies } from "next/headers";
import type { DbCard } from "@/types/database";
import type { FlashCard } from "@/types/deck"; // Assuming FlashCard is the frontend type
import { headers } from "next/headers";
import { mapDbCardToFlashCard } from "@/lib/cardMappers";

/**
 * Detects if we're being called from a dynamic route by checking the referer header
 */
async function isCalledFromDynamicRoute(searchPattern = '/study/[') {
  try {
    const headerStore = headers();
    const referer = headerStore.get('referer') || '';
    return referer.includes('/study/') && referer.match(/\/study\/[a-zA-Z0-9-]+/);
  } catch (e) {
    return false;
  }
}

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
 * Get details for multiple cards by their IDs
 * 
 * @param cardIds Array of card UUIDs to fetch
 * @returns Promise with array of cards or error
 */
export async function getCardsByIds(
    cardIds: string[]
): Promise<{ data: FlashCard[] | null, error: Error | null }> {
    console.log(`[getCardsByIds] Action started for ${cardIds.length} cards`);
    
    if (!cardIds.length) {
        return { data: [], error: null };
    }
    
    try {
        // Use the standard action client - must await
        const supabase = await createActionClient();
        
        // Fetch user for authentication check
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('[getCardsByIds] Auth error or no user:', authError);
            return { data: null, error: authError || new Error('Not authenticated') };
        }
        
        console.log(`[getCardsByIds] User authenticated: ${user.id}, fetching ${cardIds.length} cards`);

        // Ensure all UUIDs are valid to prevent DB errors
        const validCardIds = cardIds.filter(id => {
            const isValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            if (!isValid) {
                console.warn(`[getCardsByIds] Invalid UUID format: ${id}`);
            }
            return isValid;
        });

        if (validCardIds.length === 0) {
            console.warn('[getCardsByIds] No valid card IDs provided');
            return { data: [], error: null };
        }

        // Query all valid card IDs at once, filtering by user access through decks they own
        const { data: dbCards, error: dbError } = await supabase
            .from('cards')
            .select(`
                id,
                question,
                answer,
                deck_id,
                created_at,
                updated_at,
                last_reviewed_at,
                difficulty_score,
                srs_level,
                correct_count,
                incorrect_count,
                attempt_count,
                decks!inner (
                    id,
                    name,
                    question_language,
                    answer_language,
                    is_bilingual,
                    user_id
                )
            `)
            .in('id', validCardIds)
            .eq('decks.user_id', user.id);

        if (dbError) {
            console.error('[getCardsByIds] Database error:', dbError);
            return { data: null, error: dbError };
        }

        if (!dbCards || !dbCards.length) {
            console.log('[getCardsByIds] No cards found or user does not have access');
            return { data: [], error: null };
        }

        // Map DB cards to FlashCard format
        const flashCards = dbCards.map(dbCard => {
            // Each dbCard has a 'decks' property with deck info due to the join
            const deckInfo = dbCard.decks;
            
            // Create a proper Map with deck language info
            const deckLanguagesMap = new Map();
            deckLanguagesMap.set(dbCard.deck_id, { 
                questionLang: deckInfo.question_language,
                answerLang: deckInfo.answer_language
            });
            
            // Create FlashCard with deck info
            return mapDbCardToFlashCard(dbCard as DbCard, deckLanguagesMap);
        });

        console.log(`[getCardsByIds] Successfully fetched and mapped ${flashCards.length} cards`);
        return { data: flashCards, error: null };
        
    } catch (error) {
        console.error('[getCardsByIds] Caught error:', error);
        return { 
            data: null, 
            error: error instanceof Error 
                ? error 
                : new Error('Unknown error fetching cards') 
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
): Promise<{ data: FlashCard | null, error: Error | null }> {
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