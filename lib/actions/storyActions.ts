// lib/actions/storyActions.ts
'use server';

import { createActionClient } from '@/lib/supabase/server';
import { appLogger } from '@/lib/logger';
import type { ActionResult } from '@/lib/actions/types';
import type { Story, StoryParagraph } from '@/types/story';
import type { Json } from '@/types/database';
import { computeCardsHash } from '@/lib/utils/storyHash';

/**
 * Fetches the most recent story for a deck (belonging to the authenticated user).
 * Returns null if no story exists yet.
 */
export async function getStoryForDeck(deckId: string): Promise<ActionResult<Story | null>> {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'Not authenticated.' };
    }

    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('deck_id', deckId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      appLogger.error('[storyActions] getStoryForDeck error:', error.message);
      return { data: null, error: error.message };
    }

    return { data: data as unknown as Story | null, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    appLogger.error('[storyActions] getStoryForDeck unexpected error:', msg);
    return { data: null, error: msg };
  }
}

/**
 * Saves manual paragraph edits for a story.
 */
export async function updateStoryParagraphs(
  storyId: string,
  paragraphs: StoryParagraph[]
): Promise<ActionResult<Story>> {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'Not authenticated.' };
    }

    const { data, error } = await supabase
      .from('stories')
      .update({
        paragraphs: paragraphs as unknown as Json,
        is_manually_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storyId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error || !data) {
      appLogger.error('[storyActions] updateStoryParagraphs error:', error?.message);
      return { data: null, error: error?.message ?? 'Update failed.' };
    }

    return { data: data as unknown as Story, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    appLogger.error('[storyActions] updateStoryParagraphs unexpected error:', msg);
    return { data: null, error: msg };
  }
}

/**
 * Fetches the name and languages of a deck.
 * Used to determine the TTS language and display name for the story reading view.
 */
export async function getDeckLanguages(
  deckId: string
): Promise<ActionResult<{ name: string; primary_language: string; secondary_language: string | null }>> {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'Not authenticated.' };
    }

    const { data, error } = await supabase
      .from('decks')
      .select('name, primary_language, secondary_language')
      .eq('id', deckId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return { data: null, error: error?.message ?? 'Deck not found.' };
    }

    return {
      data: {
        name: data.name ?? '',
        primary_language: data.primary_language ?? 'en',
        secondary_language: data.secondary_language ?? null,
      },
      error: null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, error: msg };
  }
}

/**
 * Computes the current hash of cards in a deck.
 * Used to detect whether a story is stale.
 */
export async function getDeckCardsHash(deckId: string): Promise<ActionResult<string>> {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'Not authenticated.' };
    }

    const { data: cards, error } = await supabase
      .from('cards')
      .select('question, answer')
      .eq('deck_id', deckId)
      .eq('status', 'active');

    if (error || !cards) {
      return { data: null, error: error?.message ?? 'Failed to fetch cards.' };
    }

    return { data: computeCardsHash(cards), error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, error: msg };
  }
}
