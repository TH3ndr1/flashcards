"use server";

import { createActionClient } from '@/lib/supabase/server';
import { revalidatePath } from "next/cache";
import type { DbTag, DbCardTag } from "@/types/database";
import { z } from 'zod';
import type { Database, Tables } from "@/types/database";

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
    console.error("[getSupabaseAndUser] Auth error:", authError);
    return { supabase: null, user: null, error: 'Authentication required.' };
  }
  return { supabase, user, error: null };
}

/**
 * Retrieves all tags for the authenticated user.
 * Ref: Section 4 Data Models
 */
export async function getTags(): Promise<TagActionResponse<DbTag[]>> {
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
      console.error('Error fetching tags:', fetchError);
      return { data: null, error: 'Failed to fetch tags.' };
    }

    return { data: tags ?? [], error: null };

  } catch (error) {
    console.error('Unexpected error in getTags:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Creates a new tag for the authenticated user.
 * Enforces unique constraint (user_id, name).
 * Ref: Section 4 Data Models
 */
export async function createTag(name: string): Promise<TagActionResponse<DbTag>> {
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
      console.error('Error creating tag:', insertError);
      return { data: null, error: 'Failed to create tag.' };
    }

    // Revalidate paths where tags might be displayed
    revalidatePath('/tags'); // Example path, adjust as needed
    revalidatePath('/edit'); // Example path

    return { data: tag, error: null };

  } catch (error) {
    // Catch Zod errors specifically if not using safeParse (though safeParse is preferred)
    // if (error instanceof z.ZodError) {
    //   return { data: null, error: error.errors[0].message };
    // }
    console.error('Unexpected error in createTag:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Deletes a tag and removes all its associations in card_tags.
 * Relies on ON DELETE CASCADE for card_tags cleanup.
 * Ref: Section 4 Data Models
 */
export async function deleteTag(tagId: string): Promise<TagActionResponse<void>> {
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
      console.error('Error deleting tag:', deleteError);
      return { data: null, error: 'Failed to delete tag.' };
    }

    // Revalidate relevant paths
    revalidatePath('/tags');
    revalidatePath('/edit');

    return { data: null, error: null }; // Success

  } catch (error) {
    console.error('Unexpected error in deleteTag:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Associates a tag with a card.
 * Ensures user owns both the tag and the card before linking.
 * Ref: Section 4 Data Models (card_tags structure, denormalized user_id)
 */
export async function addTagToCard(
  cardId: string,
  tagId: string
): Promise<TagActionResponse<void>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!cardId || !tagId) {
    return { data: null, error: 'Card ID and Tag ID are required.' };
  }

  try {
    // 1. Verify user owns the card (optional but good practice, RLS on insert handles this too)
    const { count: cardCount, error: cardCheckError } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (cardCheckError || cardCount === 0) {
      console.error('Card ownership check failed or card not found:', cardCheckError);
      return { data: null, error: 'Card not found or access denied.' };
    }

    // 2. Verify user owns the tag (optional but good practice)
    const { count: tagCount, error: tagCheckError } = await supabase
      .from('tags')
      .select('id', { count: 'exact', head: true })
      .eq('id', tagId)
      .eq('user_id', user.id);

    if (tagCheckError || tagCount === 0) {
      console.error('Tag ownership check failed or tag not found:', tagCheckError);
      return { data: null, error: 'Tag not found or access denied.' };
    }

    // 3. Add the association (upsert handles existing links gracefully)
    // RLS on card_tags will also enforce user_id match on insert.
    const { error: linkError } = await supabase
      .from('card_tags')
      .upsert({
        card_id: cardId,
        tag_id: tagId,
        user_id: user.id // Denormalized user_id for RLS
      }, {
        onConflict: 'card_id,tag_id' // Based on PK (card_id, tag_id)
      });

    if (linkError) {
      if (linkError.code === '23503') { // Foreign key violation
        // This might indicate the card or tag was deleted between the check and insert,
        // or RLS prevented the insert despite the checks (less likely if checks pass).
        console.warn('Foreign key violation on card_tags insert:', linkError);
        return { data: null, error: 'Failed to link tag: Card or tag may no longer exist.' };
      }
      console.error('Error linking tag to card:', linkError);
      return { data: null, error: 'Failed to add tag to card.' };
    }

    // Revalidate paths related to card editing or where card tags are shown
    revalidatePath(`/edit/card/${cardId}`); // Example: Specific card edit page

    return { data: null, error: null }; // Success

  } catch (error) {
    console.error('Unexpected error in addTagToCard:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Removes a tag association from a card.
 * Relies on RLS on card_tags to ensure user can only remove their own links.
 * Ref: Section 4 Data Models
 */
export async function removeTagFromCard(
  cardId: string,
  tagId: string
): Promise<TagActionResponse<void>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!cardId || !tagId) {
    return { data: null, error: 'Card ID and Tag ID are required.' };
  }

  try {
    // Delete the association (RLS ensures user owns the link via user_id check)
    const { error: unlinkError } = await supabase
      .from('card_tags')
      .delete()
      .eq('card_id', cardId)
      .eq('tag_id', tagId)
      .eq('user_id', user.id); // RLS primarily enforces this

    if (unlinkError) {
      console.error('Error removing tag from card:', unlinkError);
      return { data: null, error: 'Failed to remove tag from card.' };
    }

    // Revalidate paths related to card editing
    revalidatePath(`/edit/card/${cardId}`); // Example

    return { data: null, error: null }; // Success

  } catch (error) {
    console.error('Unexpected error in removeTagFromCard:', error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
}

/**
 * Gets all tags associated with a specific card for the authenticated user.
 */
export async function getCardTags(cardId: string): Promise<TagActionResponse<DbTag[]>> {
  const { supabase, user, error: authError } = await getSupabaseAndUser();
  if (authError || !supabase || !user) {
    return { data: null, error: authError };
  }

  if (!cardId) {
    return { data: null, error: 'Card ID is required.' };
  }

  console.log(`[getCardTags] Fetching tags for Card ID: ${cardId}, User: ${user.id}`);

  try {
    // --- Corrected Query: Select from tags, filter via inner join --- 
    const { data: tags, error: fetchError } = await supabase
      .from('tags')
      // Select only columns from the 'tags' table
      .select(`
        id, user_id, name, created_at, 
        card_tags!inner(*)        /* Use join for filtering only */
      `)
      .eq('user_id', user.id)           
      .eq('card_tags.card_id', cardId) // Filter on the joined table column
      .order('name', { ascending: true }); 

    if (fetchError) {
      console.error(`[getCardTags] Error fetching card tags for ${cardId}:`, fetchError);
      return { data: null, error: 'Failed to fetch card tags.' }; 
    }
    
    // Supabase might return the joined data (`card_tags: [...]`) even if not strictly selected.
    // We need to map to ensure we only return DbTag fields.
    const resultTags: DbTag[] = (tags || []).map((tagWithJoin: any) => ({
        id: tagWithJoin.id,
        user_id: tagWithJoin.user_id,
        name: tagWithJoin.name,
        created_at: tagWithJoin.created_at,
    }));

    console.log(`[getCardTags] Found ${resultTags.length} tags for card ${cardId}.`);
    return { data: resultTags, error: null }; 

  } catch (error) {
    console.error(`[getCardTags] Unexpected error for ${cardId}:`, error);
    return { data: null, error: 'An unexpected error occurred.' };
  }
} 