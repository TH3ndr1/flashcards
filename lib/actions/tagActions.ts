"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { DbTag, DbCardTag } from "@/types/database";

/**
 * Fetches all tags created by the current user.
 */
export async function getTags(): Promise<{ data: DbTag[] | null, error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("getTags: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }

    try {
        console.log("Fetching tags for user:", user.id);
        const { data, error } = await supabase
            .from('tags')
            .select('id, user_id, name, created_at')
            .eq('user_id', user.id)
            .order('name', { ascending: true })
            .returns<DbTag[]>();

        if (error) throw error;

        console.log(`getTags: Found ${data?.length ?? 0} tags.`);
        return { data: data ?? [], error: null }; // Return empty array if data is null

    } catch (error) {
        console.error("getTags: Error fetching tags:", error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to fetch tags.") };
    }
}

/**
 * Creates a new tag for the current user.
 */
export async function createTag(name: string): Promise<{ data: DbTag | null, error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("createTag: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }

    const trimmedName = name?.trim();
    if (!trimmedName) {
        return { data: null, error: new Error("Tag name cannot be empty.") };
    }

    try {
        console.log("Creating tag for user:", user.id, "with name:", trimmedName);
        const { data, error } = await supabase
            .from('tags')
            .insert({ name: trimmedName, user_id: user.id })
            .select('id, user_id, name, created_at')
            .single<DbTag>();

        if (error) {
            // Handle unique constraint violation (PostgreSQL code 23505)
            if (error.code === '23505') {
                console.warn(`createTag: Tag "${trimmedName}" already exists for user ${user.id}.`);
                return { data: null, error: new Error(`Tag "${trimmedName}" already exists.`) };
            }
            throw error;
        }

        console.log(`createTag: Tag created successfully with ID: ${data?.id}`);
        // Revalidate paths where tags are displayed or used
        revalidatePath('/tags'); // Example tag management page
        revalidatePath('/edit'); // Example deck/card editing pages

        return { data, error: null };

    } catch (error) {
        console.error("createTag: Error creating tag:", error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to create tag.") };
    }
}

/**
 * Updates the name of an existing tag.
 */
export async function updateTag(tagId: string, newName: string): Promise<{ error: Error | null }> {
     const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("updateTag: Auth error or no user", authError);
        return { error: authError || new Error("User not authenticated") };
    }

     const trimmedNewName = newName?.trim();
    if (!trimmedNewName) {
        return { error: new Error("New tag name cannot be empty.") };
    }
     if (!tagId) {
        return { error: new Error("Tag ID is required for update.") };
    }

    try {
        console.log("Updating tag:", tagId, "for user:", user.id, "to name:", trimmedNewName);
        const { error } = await supabase
            .from('tags')
            .update({ name: trimmedNewName })
            .eq('id', tagId)
            .eq('user_id', user.id); // Ensure user owns the tag

        if (error) {
             // Handle unique constraint violation if name already exists for this user
             if (error.code === '23505') {
                 console.warn(`updateTag: New name "${trimmedNewName}" already exists for user ${user.id}.`);
                 return { error: new Error(`Tag name "${trimmedNewName}" already exists.`) };
             }
            throw error;
        }

        console.log(`updateTag: Tag ${tagId} updated successfully.`);
        // Revalidate relevant paths
        revalidatePath('/tags'); 
        revalidatePath('/edit');

        return { error: null };

    } catch (error) {
        console.error("updateTag: Error updating tag:", tagId, error);
        return { error: error instanceof Error ? error : new Error("Failed to update tag.") };
    }
}

/**
 * Deletes a tag. Also removes associated links in `card_tags` due to CASCADE constraint.
 */
export async function deleteTag(tagId: string): Promise<{ error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("deleteTag: Auth error or no user", authError);
        return { error: authError || new Error("User not authenticated") };
    }
     if (!tagId) {
        return { error: new Error("Tag ID is required for deletion.") };
    }

    try {
        console.log("Deleting tag:", tagId, "for user:", user.id);
        // Note: Deleting from 'tags' should automatically delete related 'card_tags' 
        // entries because of the ON DELETE CASCADE foreign key constraint.
        // If CASCADE wasn't set, you'd need to delete from card_tags first.
        const { error } = await supabase
            .from('tags')
            .delete()
            .eq('id', tagId)
            .eq('user_id', user.id); // Ensure user owns the tag

        if (error) throw error;

        console.log(`deleteTag: Tag ${tagId} deleted successfully.`);
        // Revalidate paths
        revalidatePath('/tags');
        revalidatePath('/edit');

        return { error: null };

    } catch (error) {
        console.error("deleteTag: Error deleting tag:", tagId, error);
        return { error: error instanceof Error ? error : new Error("Failed to delete tag.") };
    }
}

// --- Card-Tag Linking ---

/**
 * Assigns a list of tags to a specific card.
 * This replaces all existing tags for the card with the new list.
 */
export async function assignTagsToCard(cardId: string, tagIds: string[]): Promise<{ error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("assignTagsToCard: Auth error or no user", authError);
        return { error: authError || new Error("User not authenticated") };
    }
    if (!cardId) {
        return { error: new Error("Card ID is required.") };
    }

    // Ensure tagIds is an array, even if empty
    const finalTagIds = Array.isArray(tagIds) ? tagIds : [];

    try {
        console.log("Assigning tags:", finalTagIds, "to card:", cardId, "for user:", user.id);

        // 1. Delete existing links for this card (owned by the user)
        // RLS on card_tags ensures we only delete links the user owns.
        const { error: deleteError } = await supabase
            .from('card_tags')
            .delete()
            .eq('card_id', cardId)
            .eq('user_id', user.id); // Crucial for security

        if (deleteError) {
            console.error("assignTagsToCard: Error deleting existing tags for card:", cardId, deleteError);
            throw new Error(`Failed to clear existing tags: ${deleteError.message}`);
        }

        // 2. Insert new links if any tag IDs are provided
        if (finalTagIds.length > 0) {
            const newLinks = finalTagIds.map(tagId => ({
                card_id: cardId,
                tag_id: tagId,
                user_id: user.id // Include user_id for RLS on insert
            }));

            const { error: insertError } = await supabase
                .from('card_tags')
                .insert(newLinks);

            if (insertError) {
                 console.error("assignTagsToCard: Error inserting new tags for card:", cardId, insertError);
                 // Handle potential FK violation (e.g., non-existent tagId)
                 if (insertError.code === '23503') {
                     throw new Error("One or more selected tags do not exist.");
                 }
                throw new Error(`Failed to assign new tags: ${insertError.message}`);
            }
        }

         console.log(`assignTagsToCard: Tags successfully updated for card ${cardId}.`);
         // Revalidate card edit path? Might be useful.
         // revalidatePath(`/edit/...`);

        return { error: null };

    } catch (error) {
         console.error("assignTagsToCard: Error assigning tags to card:", cardId, error);
         return { error: error instanceof Error ? error : new Error("Failed to assign tags to card.") };
    }
}

/**
 * Gets all tags associated with a specific card.
 */
export async function getTagsForCard(cardId: string): Promise<{ data: DbTag[] | null, error: Error | null }> {
     const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("getTagsForCard: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }
    if (!cardId) {
        return { data: null, error: new Error("Card ID is required.") };
    }

    try {
        console.log("Getting tags for card:", cardId);
        // Query through the join table
        // RLS on card_tags and tags should ensure user only gets their own data
        const { data, error } = await supabase
            .from('card_tags')
            .select(`
                tags ( id, user_id, name, created_at )
            `)
            .eq('card_id', cardId)
            .eq('user_id', user.id)
            .returns<{ tags: DbTag }[]>(); // Expect array of objects with nested tag
            
        if (error) throw error;

        // Extract the nested tag objects
        const tags = data?.map(item => item.tags).filter(tag => tag !== null) as DbTag[] ?? [];
        
        console.log(`getTagsForCard: Found ${tags.length} tags for card ${cardId}.`);
        return { data: tags, error: null };

    } catch (error) {
         console.error("getTagsForCard: Error fetching tags for card:", cardId, error);
         return { data: null, error: error instanceof Error ? error : new Error("Failed to fetch tags for card.") };
    }
} 