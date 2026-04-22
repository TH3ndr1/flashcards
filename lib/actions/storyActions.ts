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
 * Fetches all decks for the user, joined with their most-recent story (if any).
 * Used to power the /practice/stories library page.
 * Sorted: decks with stories first (newest updated_at first), then decks without (alphabetical).
 */
export interface StoryWithDeck {
  deck_id: string;
  deck_name: string;
  primary_language: string;
  secondary_language: string | null;
  tags: string[];
  watermark_type: string | null;
  story: Story | null;
}

export async function getAllStoriesWithDecks(): Promise<ActionResult<StoryWithDeck[]>> {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: 'Not authenticated.' };
    }

    const [decksResult, storiesResult, tagsResult] = await Promise.all([
      supabase
        .from('decks')
        .select('id, name, primary_language, secondary_language, watermark_type')
        .eq('user_id', user.id)
        .order('name', { ascending: true }),
      supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('deck_tags')
        .select('deck_id, tags(name)')
        .eq('user_id', user.id),
    ]);

    if (decksResult.error) {
      return { data: null, error: decksResult.error.message };
    }

    // Build map: deck_id → most-recent story (stories are already ordered newest-first)
    const storyMap = new Map<string, Story>();
    for (const s of (storiesResult.data ?? [])) {
      if (!storyMap.has(s.deck_id)) {
        storyMap.set(s.deck_id, s as unknown as Story);
      }
    }

    // Build map: deck_id → tag names
    const tagMap = new Map<string, string[]>();
    for (const row of (tagsResult.data ?? [])) {
      const tagName = (row as any).tags?.name;
      if (tagName) {
        const existing = tagMap.get(row.deck_id) ?? [];
        existing.push(tagName);
        tagMap.set(row.deck_id, existing);
      }
    }

    const items: StoryWithDeck[] = (decksResult.data ?? []).map((deck) => ({
      deck_id: deck.id,
      deck_name: deck.name ?? '',
      primary_language: deck.primary_language ?? 'en',
      secondary_language: deck.secondary_language ?? null,
      tags: tagMap.get(deck.id) ?? [],
      watermark_type: (deck as any).watermark_type ?? null,
      story: storyMap.get(deck.id) ?? null,
    }));

    // Sort: decks with stories first (by updated_at desc), then without (alphabetical)
    items.sort((a, b) => {
      if (a.story && b.story) {
        return (b.story.updated_at ?? '').localeCompare(a.story.updated_at ?? '');
      }
      if (a.story && !b.story) return -1;
      if (!a.story && b.story) return 1;
      return a.deck_name.localeCompare(b.deck_name);
    });

    return { data: items, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    appLogger.error('[storyActions] getAllStoriesWithDecks unexpected error:', msg);
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

/**
 * Deletes all cached story rows for a deck (e.g. before replacing all cards so hashes stay consistent).
 */
export async function deleteStoriesForDeck(
  deckId: string
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { data: null, error: authError?.message || 'Not authenticated.' };
    }

    const { error, count } = await supabase
      .from('stories')
      .delete({ count: 'exact' })
      .eq('deck_id', deckId)
      .eq('user_id', user.id);

    if (error) {
      appLogger.error('[storyActions] deleteStoriesForDeck error:', error.message);
      return { data: null, error: error.message };
    }

    return { data: { deletedCount: count ?? 0 }, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    appLogger.error('[storyActions] deleteStoriesForDeck unexpected error:', msg);
    return { data: null, error: msg };
  }
}
