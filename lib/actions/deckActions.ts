'use server';

import { createActionClient } from "@/lib/supabase/server";

/**
 * Get the name of a deck by its ID
 */
export async function getDeckName(deckId: string): Promise<{ data: string | null, error: Error | null }> {
    console.log("[getDeckName] Action started for deckId:", deckId);
    const supabase = createActionClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('[getDeckName] Auth error or no user:', authError);
        return { data: null, error: new Error('Not authenticated') };
    }
    
    console.log("[getDeckName] User authenticated:", user.id);

    try {
        console.log(`[getDeckName] Querying decks table for id: ${deckId} and user_id: ${user.id}`);
        const { data, error } = await supabase
            .from('decks')
            .select('name')
            .eq('id', deckId)
            .eq('user_id', user.id)
            .single();
            
        // Log result immediately
        console.log("[getDeckName] Supabase query result:", { data, error });

        if (error) {
           console.error("[getDeckName] Supabase query failed:", error);
           // Throw the original Supabase error if possible
           throw error;
        }
        
        console.log("[getDeckName] Successfully fetched name:", data?.name);
        return { data: data?.name ?? null, error: null };
        
    } catch (error) {
        // Log the caught error more specifically before returning generic one
        console.error('[getDeckName] Caught error during query execution:', error);
        return { data: null, error: error instanceof Error ? error : new Error('Unknown error fetching deck name') };
    }
} 