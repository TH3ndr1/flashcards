import React from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDecksForManagement, type DeckListItemWithCountsAndStatus } from '@/lib/actions/deckActions';
import { ManageDecksClient } from '@/components/ManageDecksClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Use the proper type from deckActions instead of defining our own
type ManageDeckItem = DeckListItemWithCountsAndStatus;

export default async function ManageDecksPage() {
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (!session || authError) {
    redirect('/login');
  }

  // The getDecksForManagement action is expected to return data compatible with ManageDeckItem[]
  // It calls get_decks_for_management RPC and includes both active and archived decks.
  const { data: decksData, error: fetchError } = await getDecksForManagement();
  
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