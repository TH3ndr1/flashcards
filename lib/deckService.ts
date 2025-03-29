// File: lib/deckService.ts

import type { Deck, FlashCard } from "@/types/deck";
import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { calculateDifficultyScore } from "@/lib/study-utils"; // Import needed function

// --- Helper Type for raw Supabase query result (replace with generated types if possible) ---
// This reflects the snake_case structure returned by the query
interface RawDeckQueryResult {
  id: string;
  name: string;
  language: string | null; // Keep original fields for clarity before mapping
  is_bilingual: boolean | null;
  question_language: string | null;
  answer_language: string | null;
  progress: { correct: number; total: number } | null; // Assuming progress is JSONB
  cards: RawCardQueryResult[]; // Use RawCardQueryResult here
}

interface RawCardQueryResult {
  id: string;
  question: string;
  answer: string;
  correct_count: number | null;
  incorrect_count: number | null;
  last_studied: string | null;
  attempt_count: number | null;
  difficulty_score: number | null;
}
// --- End Helper Type ---

/**
 * Fetches all decks belonging to a specific user, including their associated cards.
 * 
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user whose decks are to be fetched.
 * @returns {Promise<{ data: Deck[] | null; error: PostgrestError | Error | null }>} 
 *          An object containing the fetched decks on success (or null if none found),
 *          or an error object if the fetch fails.
 */
export async function fetchDecks(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: Deck[] | null; error: PostgrestError | Error | null }> {
  // --- 1. Use type for query result --- 
  const { data: rawData, error } = await supabase
    .from("decks")
    .select(`
      id,
      name,
      language, 
      is_bilingual,
      question_language,
      answer_language,
      progress,
      cards (
        id,
        question,
        answer,
        correct_count,
        incorrect_count,
        last_studied,
        attempt_count,
        difficulty_score
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<RawDeckQueryResult[]>(); // Specify expected return type structure

  if (error) {
    console.error("Error fetching decks:", error);
    // --- 2. Return error object instead of throwing ---
    return { data: null, error }; 
  }

  // --- 3. Handle case where data might be null (though .returns should give array) ---
  if (!rawData) {
    return { data: [], error: null }; // Return empty array if Supabase returns null/undefined data
  }

  // --- 4. Type-safe transformation --- 
  try {
    const transformedDecks: Deck[] = rawData.map((deck): Deck => {
      // Map cards safely
      const cards: FlashCard[] = (deck.cards || []).map((card: RawCardQueryResult): FlashCard => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
        correctCount: card.correct_count ?? 0,
        incorrectCount: card.incorrect_count ?? 0,
        lastStudied: card.last_studied ? new Date(card.last_studied) : null,
        attemptCount: card.attempt_count ?? 0,
        difficultyScore: card.difficulty_score ?? 0
      }));

      // Map deck safely
      return {
        id: deck.id,
        name: deck.name,
        // Prefer specific language fields, fallback to potentially deprecated 'language'
        language: deck.question_language || deck.language || 'unknown', 
        isBilingual: deck.is_bilingual ?? false,
        questionLanguage: deck.question_language || deck.language || 'unknown',
        answerLanguage: deck.answer_language || deck.language || 'unknown',
        cards: cards,
        progress: deck.progress ?? { correct: 0, total: 0 },
      };
    });
    // --- 5. Return data on success ---
    return { data: transformedDecks, error: null };
  } catch (transformError) {
     console.error("Error transforming deck data:", transformError);
     // --- 6. Return transformation error (as a generic PostgrestError-like structure) ---
     // Ideally, define a custom error type, but this mimics the structure.
     return { data: null, error: new Error(`Failed to process deck data: ${transformError}`) };
  }
}

// Interface for parameters to create a deck
interface CreateDeckParams {
  name: string;
  isBilingual: boolean;
  questionLanguage: string;
  answerLanguage: string;
}

/**
 * Creates a new deck for a given user.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user creating the deck.
 * @param {CreateDeckParams} params - The properties of the new deck.
 * @returns {Promise<{ data: Deck | null; error: PostgrestError | Error | null }>} 
 *          An object containing the newly created deck on success,
 *          or an error object if the creation fails.
 */
export async function createDeckService(
  supabase: SupabaseClient,
  userId: string,
  params: CreateDeckParams
): Promise<{ data: Deck | null; error: PostgrestError | Error | null }> {
  const newDeckId = crypto.randomUUID(); // Generate ID client-side for immediate use if needed
  
  // --- 1. Use type for query result --- 
  const { data: rawData, error } = await supabase
    .from("decks")
    .insert([
      {
        id: newDeckId,
        user_id: userId,
        name: params.name,
        is_bilingual: params.isBilingual,
        question_language: params.questionLanguage,
        answer_language: params.answerLanguage,
        language: params.questionLanguage, // Keep for potential backward compatibility if needed
        progress: { correct: 0, total: 0 }, // Initialize progress
        // created_at is handled by the database default
      },
    ])
    .select(`
      id,
      name,
      language,
      is_bilingual,
      question_language,
      answer_language,
      progress
    `) // No need to select cards here, as a new deck has none
    .single() // Expecting a single record back
    .returns<RawDeckQueryResult | null>(); // Specify expected return type (can be null on error)

  if (error) {
    // Log the full error object for more detail
    console.error("Error creating deck in createDeckService:", JSON.stringify(error, null, 2));
    // --- 2. Return error object --- 
    return { data: null, error };
  }

  // --- 3. Handle case where insert succeeded but select returned null (shouldn't usually happen with .single()) ---
  if (!rawData) {
    console.error("No data returned from Supabase after creating deck, though no error reported.");
    return { data: null, error: new Error("Failed to retrieve created deck data after insert.") };
  }

  // --- 4. Type-safe transformation --- 
  try {
    const newDeck: Deck = {
      id: rawData.id,
      name: rawData.name,
      language: rawData.question_language || rawData.language || 'unknown',
      isBilingual: rawData.is_bilingual ?? false,
      questionLanguage: rawData.question_language || rawData.language || 'unknown',
      answerLanguage: rawData.answer_language || rawData.language || 'unknown',
      cards: [], // New deck starts with no cards
      progress: rawData.progress ?? { correct: 0, total: 0 },
    };
    // --- 5. Return data on success ---
    return { data: newDeck, error: null };
  } catch (transformError) {
     console.error("Error transforming created deck data:", transformError);
     // --- 6. Return transformation error ---
     return { data: null, error: new Error(`Failed to process created deck data: ${transformError}`) };
  }
}

/**
 * Fetches a single deck by its ID for a specific user, including its cards.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user who owns the deck.
 * @param {string} deckId - The ID of the deck to fetch.
 * @returns {Promise<{ data: Deck | null; error: PostgrestError | Error | null }>} 
 *          An object containing the fetched deck on success,
 *          null data if not found, or an error object if the fetch fails.
 */
export async function getDeckService(
  supabase: SupabaseClient,
  userId: string,
  deckId: string
): Promise<{ data: Deck | null; error: PostgrestError | Error | null }> {
  // --- 1. Use type for query result --- 
  const { data: rawData, error } = await supabase
    .from("decks")
    .select(`
      id,
      name,
      language,
      is_bilingual,
      question_language,
      answer_language,
      progress,
      cards (
        id,
        question,
        answer,
        correct_count,
        incorrect_count,
        last_studied,
        attempt_count,
        difficulty_score
      )
    `)
    .eq("id", deckId)
    .eq("user_id", userId)
    .single() // Expecting one or zero records
    .returns<RawDeckQueryResult | null>(); // Specify expected return type

  // --- 2. Handle specific "Not Found" error from .single() ---
  // Supabase returns an error with code 'PGRST116' when .single() finds no rows
  if (error && error.code === 'PGRST116') {
    return { data: null, error: null }; // Deck not found for this user, return null data
  }

  if (error) {
    console.error("Error fetching single deck:", error);
    return { data: null, error };
  }

  // --- 4. Handle case where no error but data is null (shouldn't happen with .single() unless PGRST116 was missed) ---
  if (!rawData) {
     // This case might indicate an issue if error was not PGRST116
    console.warn("No data returned for getDeckService, but no PGRST116 error. Deck might not exist or RLS issue?");
    return { data: null, error: null }; 
  }

  // --- 5. Type-safe transformation --- 
  try {
    const cards: FlashCard[] = (rawData.cards || []).map((card: RawCardQueryResult): FlashCard => ({
        id: card.id,
        question: card.question,
        answer: card.answer,
        correctCount: card.correct_count ?? 0,
        incorrectCount: card.incorrect_count ?? 0,
        lastStudied: card.last_studied ? new Date(card.last_studied) : null,
        attemptCount: card.attempt_count ?? 0,
        difficultyScore: card.difficulty_score ?? 0
    }));

    const fetchedDeck: Deck = {
      id: rawData.id,
      name: rawData.name,
      language: rawData.question_language || rawData.language || 'unknown',
      isBilingual: rawData.is_bilingual ?? false,
      questionLanguage: rawData.question_language || rawData.language || 'unknown',
      answerLanguage: rawData.answer_language || rawData.language || 'unknown',
      cards: cards,
      progress: rawData.progress ?? { correct: 0, total: 0 },
    };
    // --- 6. Return data on success ---
    return { data: fetchedDeck, error: null };
  } catch (transformError) {
    console.error("Error transforming single deck data:", transformError);
    // --- 7. Return transformation error ---
    return { data: null, error: new Error(`Failed to process fetched deck data: ${transformError}`) };
  }
}

// Define a type similar to PostgrestError for custom errors
interface CustomError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

/**
 * Updates an existing deck and its associated cards.
 * 
 * **Warning:** This operation involves multiple database calls (update deck, fetch cards,
 * upsert cards, delete cards) and is NOT executed within a single transaction.
 * If an error occurs partway through, the data might be left in an inconsistent state.
 * Consider migrating this logic to a Supabase Database Function (RPC) for atomicity.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user performing the update (for RLS).
 * @param {Deck} updatedDeck - The deck object containing the updated data and cards.
 * @returns {Promise<{ error: PostgrestError | Error | null }>} 
 *          An object containing an error if any step fails, or null on success.
 */
export async function updateDeckService(
  supabase: SupabaseClient,
  userId: string,
  updatedDeck: Deck
): Promise<{ error: PostgrestError | Error | null }> {
  // 1. Update deck metadata
  console.log(`Updating deck metadata for ID: ${updatedDeck.id}`);
  const { error: deckError } = await supabase
    .from("decks")
    .update({
      name: updatedDeck.name,
      is_bilingual: updatedDeck.isBilingual,
      question_language: updatedDeck.questionLanguage,
      answer_language: updatedDeck.answerLanguage,
      progress: updatedDeck.progress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", updatedDeck.id)
    .eq("user_id", userId);

  if (deckError) {
    console.error(`Error updating deck metadata (ID: ${updatedDeck.id}):`, deckError);
    return { error: deckError };
  }
  console.log(`Deck metadata updated successfully for ID: ${updatedDeck.id}`);

  // 2. Get existing card IDs for comparison
  console.log(`Fetching existing card IDs for deck ID: ${updatedDeck.id}`);
  const { data: existingCardsData, error: fetchError } = await supabase
    .from("cards")
    .select("id")
    .eq("deck_id", updatedDeck.id)
    .returns<{ id: string }[] | null>();

  if (fetchError) {
    console.error(`Error fetching existing card IDs (Deck ID: ${updatedDeck.id}):`, fetchError);
    return { error: fetchError };
  }

  // --- Explicit check and initialization for existing cards ---
  let existingCardIds: Set<string> = new Set(); // Initialize as empty Set
  if (existingCardsData && Array.isArray(existingCardsData)) {
      // Now we know it's an array, proceed safely
      console.log(`Fetched ${existingCardsData.length} existing card IDs for deck ID: ${updatedDeck.id}`);
      // Explicitly type 'c' in map
      existingCardIds = new Set(existingCardsData.map((c: { id: string }) => c.id));
  } else {
      // Handle null or non-array case (treat as no existing cards)
      console.log(`No existing cards found or invalid data received for deck ID: ${updatedDeck.id}`);
  }
  // --- End explicit check ---

  // 3. Prepare card upserts
  const cardUpserts = updatedDeck.cards.map((card) => ({
    id: card.id || crypto.randomUUID(),
    deck_id: updatedDeck.id,
    question: card.question,
    answer: card.answer,
    correct_count: card.correctCount,
    incorrect_count: card.incorrectCount,
    last_studied: card.lastStudied?.toISOString(), 
    attempt_count: card.attemptCount,
    difficulty_score: card.difficultyScore,
    updated_at: new Date().toISOString(),
  }));

  if (cardUpserts.length > 0) {
    console.log(`Upserting ${cardUpserts.length} cards for deck ID: ${updatedDeck.id}`);
    const { error: cardsUpsertError } = await supabase
      .from("cards")
      .upsert(cardUpserts, { onConflict: "id" });

    if (cardsUpsertError) {
      console.error(`Error upserting cards (Deck ID: ${updatedDeck.id}):`, cardsUpsertError);
      return { error: cardsUpsertError };
    }
     console.log(`Cards upserted successfully for deck ID: ${updatedDeck.id}`);
  } else {
    console.log(`No cards to upsert for deck ID: ${updatedDeck.id}`);
  }

  // 4. Identify and delete cards that were removed
  const updatedCardIds = new Set(cardUpserts.map((c) => c.id));
  // Explicitly type 'id' in filter callback
  const cardsToDelete = Array.from(existingCardIds).filter(
    (id: string) => !updatedCardIds.has(id)
  );

  if (cardsToDelete.length > 0) {
    console.log(`Deleting ${cardsToDelete.length} cards for deck ID: ${updatedDeck.id}`);
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("deck_id", updatedDeck.id) 
      .in("id", cardsToDelete);

    if (deleteError) {
      console.error(`Error deleting cards (Deck ID: ${updatedDeck.id}):`, deleteError);
      return { error: deleteError };
    }
    console.log(`Cards deleted successfully for deck ID: ${updatedDeck.id}`);
  }

  // 5. Success
  console.log(`Deck update process completed successfully for ID: ${updatedDeck.id}`);
  return { error: null };
}

/**
 * Deletes a deck and all its associated cards.
 * 
 * Performs card deletion first, then deck deletion.
 * **Note:** While this approach is safer than relying solely on cascade deletes,
 * it's still not fully atomic without a database transaction (RPC).
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user performing the deletion (for RLS).
 * @param {string} deckId - The ID of the deck to delete.
 * @returns {Promise<{ error: PostgrestError | null }>} 
 *          An object containing an error if deletion fails, or null on success.
 */
export async function deleteDeckService(
  supabase: SupabaseClient,
  userId: string, // userId might not be strictly needed here if RLS handles ownership
  deckId: string
): Promise<{ error: PostgrestError | null }> {
  // 1. Delete associated cards first
  console.log(`Deleting cards for deck ID: ${deckId}`);
  const { error: cardsError } = await supabase
    .from("cards")
    .delete()
    .eq("deck_id", deckId);
    // RLS policy on 'cards' table should prevent deleting cards not owned by the user
    // (assuming policy checks ownership via the linked deck_id -> decks.user_id)

  if (cardsError) {
    console.error(`Error deleting cards for deck (ID: ${deckId}):`, cardsError);
    return { error: cardsError };
  }
  console.log(`Cards deleted successfully for deck ID: ${deckId}`);

  // 2. Delete the deck itself
  console.log(`Deleting deck metadata for ID: ${deckId}`);
  const { error: deckError } = await supabase
    .from("decks")
    .delete()
    .eq("id", deckId)
    .eq("user_id", userId); // Ensure user owns the deck (RLS should also handle this)

  if (deckError) {
    console.error(`Error deleting deck metadata (ID: ${deckId}):`, deckError);
    return { error: deckError };
  }

  // 3. Success
  console.log(`Deck deleted successfully (ID: ${deckId})`);
  return { error: null };
}

/**
 * Updates the study statistics for a single flashcard.
 *
 * Fetches the current card state, calculates new counts and difficulty score based
 * on the result (`isCorrect`), and updates the card record in the database.
 *
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {string} userId - The ID of the user performing the action (for RLS/logging).
 * @param {string} deckId - The ID of the deck the card belongs to (for context/RLS).
 * @param {string} cardId - The ID of the card to update.
 * @param {boolean | null} isCorrect - True if answered correctly, false if incorrect, null if skipped (counts not updated).
 * @returns {Promise<{ data: FlashCard | null; error: PostgrestError | Error | null }>} 
 *          An object containing the updated card data on success,
 *          or an error object if the update fails.
 */
export async function updateCardResultService(
  supabase: SupabaseClient,
  userId: string, // For RLS/logging
  deckId: string, // For context/RLS
  cardId: string,
  isCorrect: boolean | null // null indicates 'skip'
): Promise<{ data: FlashCard | null; error: PostgrestError | Error | null }> {

  // 1. Fetch current card data
  const { data: currentCardData, error: fetchError } = await supabase
    .from('cards')
    .select('correct_count, incorrect_count, attempt_count, difficulty_score')
    .eq('id', cardId)
    // RLS should ideally handle ownership, but adding deckId check can be safer if needed
    // .eq('deck_id', deckId) 
    .single<Pick<RawCardQueryResult, 'correct_count' | 'incorrect_count' | 'attempt_count' | 'difficulty_score'>>();

  if (fetchError || !currentCardData) {
    console.error(`Error fetching card ${cardId} for update:`, fetchError);
    return { data: null, error: fetchError || new Error("Card not found or fetch failed before update.") };
  }

  // 2. Calculate new values
  const now = new Date();
  let newCorrectCount = currentCardData.correct_count ?? 0;
  let newIncorrectCount = currentCardData.incorrect_count ?? 0;
  let newAttemptCount = currentCardData.attempt_count ?? 0;

  if (isCorrect !== null) { // Only update counts if not skipped
    newAttemptCount += 1;
    if (isCorrect) {
      newCorrectCount += 1;
    } else {
      newIncorrectCount += 1;
    }
  }

  // 3. Calculate new difficulty score
  const tempCardForScore: FlashCard = {
      id: cardId,
      question: '', // Not needed for score calc
      answer: '',   // Not needed for score calc
      correctCount: newCorrectCount,
      incorrectCount: newIncorrectCount,
      attemptCount: newAttemptCount,
      lastStudied: now, 
      difficultyScore: currentCardData.difficulty_score ?? 0
  };
  const newDifficultyScore = calculateDifficultyScore(tempCardForScore);

  // 4. Perform the update
  const { data: updatedRawCard, error: updateError } = await supabase
    .from('cards')
    .update({
      correct_count: newCorrectCount,
      incorrect_count: newIncorrectCount,
      attempt_count: newAttemptCount,
      last_studied: now.toISOString(),
      difficulty_score: newDifficultyScore,
    })
    .eq('id', cardId)
    .select(`
        id,
        question,
        answer,
        correct_count,
        incorrect_count,
        last_studied,
        attempt_count,
        difficulty_score
      `) // Select necessary fields to reconstruct the Card type
    .single<RawCardQueryResult>(); 

  if (updateError) {
    console.error(`Error updating card ${cardId}:`, updateError);
    return { data: null, error: updateError };
  }

  if (!updatedRawCard) {
      console.error("No data returned from Supabase after updating card, though no error reported.");
      return { data: null, error: new Error("Failed to retrieve updated card data after update.") };
  }

  // 5. Transform and return
  try {
    const updatedCard: FlashCard = {
        id: updatedRawCard.id,
        question: updatedRawCard.question,
        answer: updatedRawCard.answer,
        correctCount: updatedRawCard.correct_count ?? 0,
        incorrectCount: updatedRawCard.incorrect_count ?? 0,
        lastStudied: updatedRawCard.last_studied ? new Date(updatedRawCard.last_studied) : null,
        attemptCount: updatedRawCard.attempt_count ?? 0,
        difficultyScore: updatedRawCard.difficulty_score ?? 0
    };
    return { data: updatedCard, error: null };
  } catch (transformError) {
     console.error("Error transforming updated card data:", transformError);
     return { data: null, error: new Error(`Failed to process updated card data: ${transformError}`) };
  }
}