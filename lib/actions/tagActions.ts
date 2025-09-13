"use server";

import { createActionClient } from '@/lib/supabase/server';
import { revalidatePath } from "next/cache";
import { z } from 'zod';
import type { Database, Tables } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';
import { createCardsBatch, type CreateCardInput } from './cardActions'; // Assume CreateCardInput is defined
import { appLogger, statusLogger } from '@/lib/logger';

// Zod schema for tag validation
const tagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(50, 'Tag name too long'),
});

// Common response structure
interface TagActionResponse<T = any> {
  data: T | null;
  error: string | null;
}

// Helper to get Supabase client and user
async function getSupabaseAndUser() {
  const supabase = createActionClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    appLogger.error("[getSupabaseAndUser] Auth error:", authError);
    return { supabase: null, user: null, error: 'Authentication required.' };
  }
  return { supabase, user, error: null };
}

/**
 * Server actions for managing tags and deck-tag relationships.
 * 
 * This module provides:
 * - Tag creation, reading, updating, and deletion
 * - Deck-tag relationship management
 * - Tag query and filtering operations
 * 
 * @module tagActions
 */

/**
 * Fetches all tags for the current user.
 * 
 * @returns {Promise<Tag[]>} Array of user's tags
 * @throws {Error} If tag fetch fails or user is not authenticated
 */
export async function getTags(): Promise<TagActionResponse<Tables<'tags'>[]>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  try {
    const { data: tags, error: fetchError } = await supabase
      .from('tags')
      .select('id, user_id, name, created_at')
      .eq('user_id', user.id)
      .order('name');

    if (fetchError) {
      appLogger.error('Error fetching tags:', fetchError);
      return { data: null, error: 'Failed to fetch tags.' };
    }

    return { data: tags ?? [], error: null };

  } catch (error) {
    appLogger.error('Unexpected error in getTags:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Creates a new tag for the authenticated user.
 * Enforces unique constraint (user_id, name).
 * Ref: Section 4 Data Models
 */
export async function createTag(name: string): Promise<ActionResult<Tables<'tags'>>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  try {
    // 1. Validate input
    const validation = tagSchema.safeParse({ name });
    if (!validation.success) {
      return { data: null, error: validation.error.errors[0].message };
    }
    const validatedName = validation.data.name;

    // 2. Insert new tag (DB handles unique constraint)
    const { data: tag, error: insertError } = await supabase
      .from('tags')
      .insert({ name: validatedName, user_id: user.id })
      .select('id, user_id, name, created_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Handle unique constraint violation
        return { data: null, error: 'A tag with this name already exists.' };
      }
      appLogger.error('Error creating tag:', insertError);
      return { data: null, error: 'Failed to create tag.' };
    }

    // Revalidate paths where tags might be displayed
    revalidatePath('/tags'); // Example path, adjust as needed
    // Skip revalidatePath for /edit to prevent page refresh during editing

    return { data: tag, error: null };

  } catch (error) {
    // Catch Zod errors specifically if not using safeParse (though safeParse is preferred)
    // if (error instanceof z.ZodError) {
    //   return { data: null, error: error.errors[0].message };
    // }
    appLogger.error('Unexpected error in createTag:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Deletes a tag and removes all its associations in deck_tags.
 * Relies on ON DELETE CASCADE for deck_tags cleanup.
 * Ref: Section 4 Data Models
 */
export async function deleteTag(tagId: string): Promise<TagActionResponse<null>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!tagId) {
    return { data: null, error: 'Tag ID is required for deletion.' };
  }

  try {
    // Delete tag (RLS + user_id check ensures ownership)
    const { error: deleteError } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', user.id);

    if (deleteError) {
      appLogger.error('Error deleting tag:', deleteError);
      return { data: null, error: 'Failed to delete tag.' };
    }

    // Revalidate relevant paths
    revalidatePath('/tags');
    // Skip revalidatePath for /edit to prevent page refresh during editing

    return { data: null, error: null }; // Success

  } catch (error) {
    appLogger.error('Unexpected error in deleteTag:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Associates a tag with a deck.
 * Ensures the user owns both the tag and the deck.
 */
export async function addTagToDeck(
  deckId: string,
  tagId: string
): Promise<ActionResult<null>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!deckId || !tagId) {
    return { data: null, error: 'Deck ID and Tag ID are required.' };
  }

  try {
    // Optional: Verify user owns the deck and tag (RLS should handle this too)
    // Insert into deck_tags table. The DB schema should enforce FK constraints and uniqueness.
    const { error: insertError } = await supabase
      .from('deck_tags')
      .insert({ deck_id: deckId, tag_id: tagId, user_id: user.id });

    if (insertError) {
      if (insertError.code === '23505') { // unique_violation
        // Already exists, consider it a success (or return a specific message)
        appLogger.info(`Deck tag association already exists: deck=${deckId}, tag=${tagId}`);
        return { data: null, error: null };
      }
       if (insertError.code === '23503') { // foreign_key_violation
         appLogger.error('Add deck tag FK violation:', insertError);
         return { data: null, error: 'Deck or Tag not found.' };
       }
      appLogger.error('Error adding tag to deck:', insertError);
      return { data: null, error: 'Failed to add tag to deck.' };
    }

    // Skip revalidatePath for edit page to prevent page refresh during editing
    // Only revalidate dashboard/deck list if tags are shown there
    revalidatePath('/'); 

    return { data: null, error: null }; // Success

  } catch (error) {
    appLogger.error('Unexpected error in addTagToDeck:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Removes the association between a tag and a deck.
 */
export async function removeTagFromDeck(
  deckId: string,
  tagId: string
): Promise<ActionResult<null>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!deckId || !tagId) {
    return { data: null, error: 'Deck ID and Tag ID are required.' };
  }

  try {
    // Delete the association from deck_tags table (RLS + user_id check)
    const { error: deleteError } = await supabase
      .from('deck_tags')
      .delete()
      .eq('deck_id', deckId)
      .eq('tag_id', tagId)
      .eq('user_id', user.id);

    if (deleteError) {
      appLogger.error('Error removing tag from deck:', deleteError);
      return { data: null, error: 'Failed to remove tag from deck.' };
    }

    // Check if any row was actually deleted? Supabase delete doesn't return count easily
    // If the row didn't exist, it's still effectively a success.

    // Skip revalidatePath for edit page to prevent page refresh during editing  
    // Only revalidate dashboard/deck list if tags are shown there
    revalidatePath('/');

    return { data: null, error: null }; // Success

  } catch (error) {
    appLogger.error('Unexpected error in removeTagFromDeck:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Fetches all tags associated with a specific deck for the current user.
 */
export async function getDeckTags(deckId: string): Promise<ActionResult<Tables<'tags'>[]>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!deckId) {
    return { data: null, error: 'Deck ID is required.' };
  }

  try {
    // Query deck_tags, join with tags, filter by deck_id and user_id
    const { data, error: fetchError } = await supabase
      .from('deck_tags')
      .select(`
        tags (*)
      `)
      .eq('deck_id', deckId)
      .eq('user_id', user.id);

    if (fetchError) {
      appLogger.error('Error fetching deck tags:', fetchError);
      return { data: null, error: 'Failed to fetch deck tags.' };
    }

    // Extract the tag objects from the join result
    // The result is an array of objects like { tags: { id: ..., name: ... } } or { tags: null }
    const tags = data?.map(item => item.tags).filter(tag => tag !== null) as Tables<'tags'>[] ?? [];

    return { data: tags, error: null };

  } catch (error) {
    appLogger.error('Unexpected error in getDeckTags:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Fetches all tags associated with a specific card (via its deck) for the current user.
 */
export async function getCardTags(cardId: string): Promise<ActionResult<Tables<'tags'>[]>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!cardId) {
    return { data: null, error: "Card ID is required." };
  }

  try {
    // 1. Fetch the card to get its deck_id
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, deck_id')
      .eq('id', cardId)
      // RLS policy on cards table ensures user can only access cards in their own decks.
      // Direct user_id check here is not needed and column doesn't exist on cards table.
      .single();

    if (cardError) {
      appLogger.error(`Error fetching card ${cardId} to get deck_id:`, cardError);
      return { data: null, error: "Failed to fetch card details to retrieve tags." };
    }

    if (!card || !card.deck_id) {
      appLogger.error(`Card ${cardId} not found or has no deck_id.`);
      return { data: null, error: "Card not found or not associated with a deck." };
    }

    // 2. Call getDeckTags with the obtained deck_id
    // Make sure getDeckTags is imported or defined above if in the same file.
    return getDeckTags(card.deck_id);

  } catch (error) {
    appLogger.error(`Unexpected error in getCardTags for card ${cardId}:`, error);
    return { data: null, error: 'An unexpected error occurred while fetching tags for the card.' };
  }
}

/**
 * Creates a new study set for the user.
 */
