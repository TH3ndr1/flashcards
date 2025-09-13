import React from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDecks } from '@/lib/actions/deckActions';
import { ManageDecksClient } from '@/components/ManageDecksClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Type for deck data including SRS counts, similar to EnhancedDeck in DeckListClient
interface ManageDeckItem {
  id: string;
  name: string;
  primary_language: string | null;
  secondary_language: string | null;
  is_bilingual: boolean;
  updated_at: string | null; 
  new_count: number;
  learning_count: number;
  young_count: number;
  mature_count: number;
  relearning_count: number;
  deck_tags_json?: any; // Added to hold tags, type can be refined
  // learn_eligible_count and review_eligible_count might not be directly needed for manage view
}

export default async function ManageDecksPage() {
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (!session || authError) {
    redirect('/login');
  }

  // The getDecks action is expected to return data compatible with ManageDeckItem[]
  // It calls get_decks_with_complete_srs_counts RPC.
  const { data: decksData, error: fetchError } = await getDecks();
  
  // Explicitly cast or map if the return type of getDecks is not exactly ManageDeckItem[]
  // For now, assuming it's compatible or that getDecks has been updated.
  const decks: ManageDeckItem[] = decksData || [];

  return (
    <ManageDecksClient 
      initialDecks={decks}
      fetchError={fetchError}
    />
  );
} 