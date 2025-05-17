"use server";

import { createActionClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";
import type { ActionResult } from '@/lib/actions/types';

/**
 * Efficiently retrieves only SRS state information for a list of card IDs
 * Used for optimized card counting by SRS state without fetching full card data
 */
export async function getCardSrsStatesByIds(cardIds: string[]): Promise<ActionResult<Partial<Tables<'cards'>>[]>> {
  try {
    // If no card IDs provided, return empty result
    if (!cardIds?.length) {
      return { data: [], error: null };
    }

    // Create Supabase client
    const supabase = createActionClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Error in authentication:', authError);
      return { error: 'Not authenticated', data: null };
    }

    // Limited to 1000 cards for performance reasons
    const limitedCardIds = cardIds.slice(0, 1000);

    // Fetch only the SRS-related fields we need for counting
    const { data, error } = await supabase
      .from('cards')
      .select(`
        id,
        srs_level,
        learning_state,
        next_review_due,
        learning_step_index,
        failed_attempts_in_learn,
        hard_attempts_in_learn
      `)
      .in('id', limitedCardIds)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching card SRS states:', error);
      return { error: error.message, data: null };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getCardSrsStatesByIds:', error);
    return {
      error: error instanceof Error ? error.message : 'Unknown error getting card SRS states',
      data: null
    };
  }
} 