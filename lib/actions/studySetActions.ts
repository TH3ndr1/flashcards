"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { DbStudySet } from "@/types/database";
import type { StudyQueryCriteria } from "./studyQueryActions"; // Import the criteria type

/**
 * Fetches all study sets belonging to the current user.
 */
export async function getStudySets(): Promise<{ data: DbStudySet[] | null, error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("getStudySets: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }

    try {
        console.log("Fetching study sets for user:", user.id);
        const { data, error } = await supabase
            .from('study_sets')
            .select('*') // Select all fields for DbStudySet
            .eq('user_id', user.id)
            .order('name', { ascending: true })
            .returns<DbStudySet[]>();

        if (error) throw error;

        console.log(`getStudySets: Found ${data?.length ?? 0} study sets.`);
        return { data: data ?? [], error: null }; // Return empty array if data is null

    } catch (error) {
        console.error("getStudySets: Error fetching study sets:", error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to fetch study sets.") };
    }
}

/**
 * Fetches a specific study set by its ID for the current user.
 */
export async function getStudySet(studySetId: string): Promise<{ data: DbStudySet | null, error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("getStudySet: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }
    if (!studySetId) {
        return { data: null, error: new Error("Study Set ID is required.") };
    }

    try {
        console.log("Fetching study set:", studySetId, "for user:", user.id);
        const { data, error } = await supabase
            .from('study_sets')
            .select('*')
            .eq('id', studySetId)
            .eq('user_id', user.id)
            .maybeSingle<DbStudySet>(); // Use maybeSingle as it might not exist

        if (error) throw error;

        if (!data) {
             console.log(`getStudySet: Study set ${studySetId} not found for user ${user.id}.`);
             return { data: null, error: null }; // Not found is not an error here
        }

        console.log(`getStudySet: Found study set ${studySetId}.`);
        return { data, error: null };

    } catch (error) {
        console.error("getStudySet: Error fetching study set:", studySetId, error);
        return { data: null, error: error instanceof Error ? error : new Error("Failed to fetch study set.") };
    }
}

/**
 * Creates a new study set for the current user.
 * TODO: Add validation for queryCriteria structure (e.g., using Zod).
 */
export async function createStudySet(name: string, description: string | null, queryCriteria: StudyQueryCriteria): Promise<{ data: DbStudySet | null, error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("createStudySet: Auth error or no user", authError);
        return { data: null, error: authError || new Error("User not authenticated") };
    }

    const trimmedName = name?.trim();
    if (!trimmedName) {
        return { data: null, error: new Error("Study set name cannot be empty.") };
    }
    // Basic check for queryCriteria - consider more robust validation
    if (typeof queryCriteria !== 'object' || queryCriteria === null || Object.keys(queryCriteria).length === 0) {
         return { data: null, error: new Error("Valid query criteria are required.") };
    }

    try {
        console.log("Creating study set for user:", user.id, "with name:", trimmedName);
        const { data, error } = await supabase
            .from('study_sets')
            .insert({
                name: trimmedName,
                description: description,
                query_criteria: queryCriteria, // Stored as JSONB
                user_id: user.id
            })
            .select('*') // Select all fields of the new set
            .single<DbStudySet>();

        if (error) throw error;

        console.log(`createStudySet: Study set created successfully with ID: ${data?.id}`);
        // Revalidate paths where study sets are listed
        revalidatePath('/study-sets'); // Example page
        revalidatePath('/study'); // General study selection page?

        return { data, error: null };

    } catch (error) {
        console.error("createStudySet: Error creating study set:", error);
        // Add specific error handling? e.g., duplicate name constraint if added
        return { data: null, error: error instanceof Error ? error : new Error("Failed to create study set.") };
    }
}

/**
 * Updates an existing study set for the current user.
 * TODO: Add validation for queryCriteria structure in updates.
 */
export async function updateStudySet(studySetId: string, updates: Partial<Pick<DbStudySet, 'name' | 'description' | 'query_criteria'>>): Promise<{ error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("updateStudySet: Auth error or no user", authError);
        return { error: authError || new Error("User not authenticated") };
    }
    if (!studySetId) {
         return { error: new Error("Study Set ID is required for update.") };
    }
    if (updates.name !== undefined && !updates.name.trim()) {
         return { error: new Error("Study set name cannot be empty.") };
    }
     // Basic check for queryCriteria if being updated
    if (updates.query_criteria !== undefined && (typeof updates.query_criteria !== 'object' || updates.query_criteria === null)) {
         return { error: new Error("Invalid query criteria provided.") };
    }

    // Prepare update object, trimming name if present
    const finalUpdates: Partial<DbStudySet> = { ...updates };
    if (finalUpdates.name) {
        finalUpdates.name = finalUpdates.name.trim();
    }
    finalUpdates.updated_at = new Date().toISOString(); // Add if trigger isn't used

    try {
        console.log("Updating study set:", studySetId, "for user:", user.id);
        const { error } = await supabase
            .from('study_sets')
            .update(finalUpdates)
            .eq('id', studySetId)
            .eq('user_id', user.id); // Ensure ownership

        if (error) throw error;

        console.log(`updateStudySet: Study set ${studySetId} updated successfully.`);
        // Revalidate relevant paths
        revalidatePath('/study-sets');
        revalidatePath(`/study-set/${studySetId}`); // Example detail page

        return { error: null };

    } catch (error) {
        console.error("updateStudySet: Error updating study set:", studySetId, error);
        return { error: error instanceof Error ? error : new Error("Failed to update study set.") };
    }
}

/**
 * Deletes a study set for the current user.
 */
export async function deleteStudySet(studySetId: string): Promise<{ error: Error | null }> {
    const cookieStore = cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error("deleteStudySet: Auth error or no user", authError);
        return { error: authError || new Error("User not authenticated") };
    }
    if (!studySetId) {
         return { error: new Error("Study Set ID is required for deletion.") };
    }

    try {
        console.log("Deleting study set:", studySetId, "for user:", user.id);
        const { error } = await supabase
            .from('study_sets')
            .delete()
            .eq('id', studySetId)
            .eq('user_id', user.id); // Ensure ownership

        if (error) throw error;

        console.log(`deleteStudySet: Study set ${studySetId} deleted successfully.`);
        // Revalidate paths
        revalidatePath('/study-sets');
        revalidatePath('/study');

        return { error: null };

    } catch (error) {
        console.error("deleteStudySet: Error deleting study set:", studySetId, error);
        return { error: error instanceof Error ? error : new Error("Failed to delete study set.") };
    }
} 