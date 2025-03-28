// File: lib/deckService.ts

import type { Deck } from "@/types/deck";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchDecks(supabase: SupabaseClient, userId: string): Promise<Deck[]> {
  const { data, error } = await supabase
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
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error fetching decks: ${JSON.stringify(error)}`);
  }
  if (!data) {
    throw new Error("No data returned from Supabase");
  }

  // Transform raw data into Deck type
  const transformedDecks: Deck[] = data.map((deck: any) => ({
    id: deck.id,
    name: deck.name,
    language: deck.language || deck.question_language,
    isBilingual: deck.is_bilingual || false,
    questionLanguage: deck.question_language || deck.language,
    answerLanguage: deck.answer_language || deck.language,
    cards: (deck.cards || []).map((card: any) => ({
      id: card.id,
      question: card.question,
      answer: card.answer,
      correctCount: card.correct_count || 0,
      incorrectCount: card.incorrect_count || 0,
      lastStudied: card.last_studied,
      attemptCount: card.attempt_count || 0,
      difficultyScore: card.difficulty_score || 0
    })),
    progress: deck.progress || { correct: 0, total: 0 },
  }));
  return transformedDecks;
}

export async function createDeckService(
  supabase: SupabaseClient,
  userId: string,
  params: {
    name: string;
    isBilingual: boolean;
    questionLanguage: string;
    answerLanguage: string;
  }
): Promise<Deck> {
  const newDeckId = crypto.randomUUID();
  const { data, error } = await supabase
    .from("decks")
    .insert([
      {
        id: newDeckId,
        name: params.name,
        user_id: userId,
        language: params.questionLanguage, // for backward compatibility
        is_bilingual: params.isBilingual,
        question_language: params.questionLanguage,
        answer_language: params.answerLanguage,
        progress: { correct: 0, total: 0 },
      },
    ])
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
        last_studied
      )
    `)
    .single();

  if (error) {
    throw new Error(`Error creating deck: ${JSON.stringify(error)}`);
  }
  if (!data) {
    throw new Error("No data returned from Supabase after creating deck");
  }

  const newDeck: Deck = {
    id: data.id,
    name: data.name,
    language: data.language || data.question_language,
    isBilingual: data.is_bilingual || false,
    questionLanguage: data.question_language || data.language,
    answerLanguage: data.answer_language || data.language,
    cards: [],
    progress: data.progress || { correct: 0, total: 0 },
  };
  return newDeck;
}

export async function getDeckService(
  supabase: SupabaseClient,
  userId: string,
  deckId: string
): Promise<Deck | null> {
  const { data, error } = await supabase
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
    .single();

  if (error) {
    throw new Error(`Error fetching deck from Supabase: ${JSON.stringify(error)}`);
  }
  if (!data) return null;

  const fetchedDeck: Deck = {
    id: data.id,
    name: data.name,
    language: data.language || data.question_language,
    isBilingual: data.is_bilingual || false,
    questionLanguage: data.question_language || data.language,
    answerLanguage: data.answer_language || data.language,
    cards: (data.cards || []).map((card: any) => ({
      id: card.id,
      question: card.question,
      answer: card.answer,
      correctCount: card.correct_count || 0,
      incorrectCount: card.incorrect_count || 0,
      lastStudied: card.last_studied,
      attemptCount: card.attempt_count || 0,
      difficultyScore: card.difficulty_score || 0
    })),
    progress: data.progress || { correct: 0, total: 0 },
  };
  return fetchedDeck;
}

export async function updateDeckService(
  supabase: SupabaseClient,
  userId: string,
  updatedDeck: Deck
): Promise<void> {
  // First update the deck record
  const { error: deckError } = await supabase
    .from("decks")
    .update({
      name: updatedDeck.name,
      language: updatedDeck.questionLanguage, // backward compatibility
      is_bilingual: updatedDeck.isBilingual,
      question_language: updatedDeck.questionLanguage,
      answer_language: updatedDeck.answerLanguage,
      progress: updatedDeck.progress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", updatedDeck.id)
    .eq("user_id", userId);

  if (deckError) {
    throw new Error(`Error updating deck: ${JSON.stringify(deckError)}`);
  }

  // Get existing cards to identify which ones to delete
  const { data: existingCards, error: fetchError } = await supabase
    .from("cards")
    .select("id")
    .eq("deck_id", updatedDeck.id);

  if (fetchError) {
    throw new Error(`Error fetching existing cards: ${JSON.stringify(fetchError)}`);
  }

  // Prepare card updates/inserts
  const cardUpserts = updatedDeck.cards.map((card) => ({
    id: card.id,
    deck_id: updatedDeck.id,
    question: card.question,
    answer: card.answer,
    correct_count: card.correctCount,
    incorrect_count: card.incorrectCount,
    last_studied: card.lastStudied,
    attempt_count: card.attemptCount,
    difficulty_score: card.difficultyScore,
    updated_at: new Date().toISOString(),
  }));

  // Update all cards in a single operation
  const { error: cardsError } = await supabase
    .from("cards")
    .upsert(cardUpserts, { onConflict: "id" });

  if (cardsError) {
    throw new Error(`Error updating cards: ${JSON.stringify(cardsError)}`);
  }

  // Delete cards that are no longer in the deck
  const existingCardIds = new Set(existingCards?.map((c: any) => c.id) || []);
  const updatedCardIds = new Set(updatedDeck.cards.map((c) => c.id));
  const cardsToDelete = Array.from(existingCardIds).filter(
    (id) => !updatedCardIds.has(id)
  );

  if (cardsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("deck_id", updatedDeck.id)
      .in("id", cardsToDelete);

    if (deleteError) {
      throw new Error(`Error deleting removed cards: ${JSON.stringify(deleteError)}`);
    }
  }
}

export async function deleteDeckService(
  supabase: SupabaseClient,
  userId: string,
  deckId: string
): Promise<void> {
  const { error } = await supabase
    .from("decks")
    .delete()
    .eq("id", deckId)
    .eq("user_id", userId);
  if (error) {
    throw new Error(`Error deleting deck: ${JSON.stringify(error)}`);
  }
}