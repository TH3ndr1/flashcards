import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDecks } from '@/lib/actions/deckActions';
import { getUserStudySetsWithCounts, type StudySetWithTotalCount as FetchedStudySetWithTotalCount } from '@/lib/actions/studySetActions';
import { getUserGlobalSrsSummary, type UserGlobalSrsSummary } from '@/lib/actions/studyQueryActions';
import { PageHeading } from '@/components/ui/page-heading';
import { StudySelectClient } from '../../../components/study/StudySelectClient';
import type { DeckListItemWithCounts } from '@/lib/actions/deckActions';
import type { Tables } from '@/types/database';

/**
 * Study Selection Page
 * 
 * This is a Server Component that pre-fetches both decks and study sets data
 * server-side before rendering the page, eliminating client-side data fetching delays.
 * 
 * @returns {Promise<JSX.Element>} The Study Selection page with pre-fetched data
 */

// Type for props passed to StudySelectClient
// This should include all fields from Tables<'study_sets'> and the camelCased totalCardCount
type ClientStudySet = Tables<'study_sets'> & {
  totalCardCount: number;
};

// Type for deck props passed to StudySelectClient
type ClientDeck = DeckListItemWithCounts & {
  totalCardCount: number;
};

export default async function StudySelectPage() {
  // Check authentication server-side
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (!session) {
    redirect("/login");
  }

  // Pre-fetch decks, study sets with counts, and global SRS summary in parallel
  const [
    decksResult, 
    studySetsWithCountsResult,
    globalSrsSummaryResult
  ] = await Promise.all([
    getDecks(),
    getUserStudySetsWithCounts(),
    getUserGlobalSrsSummary()
  ]);

  const allUserDecksRaw = decksResult.data || [];
  const fetchedStudySets: FetchedStudySetWithTotalCount[] = studySetsWithCountsResult.data || [];
  const globalSrsSummary: UserGlobalSrsSummary = globalSrsSummaryResult.data ?? 
    { total_cards: 0, new_cards: 0, due_cards: 0, new_review_cards: 0 };

  const hasErrors = Boolean(
    decksResult.error || 
    studySetsWithCountsResult.error ||
    globalSrsSummaryResult.error
  );

  // Map decks to ClientDeck type (with camelCase totalCardCount)
  const clientDecks: ClientDeck[] = allUserDecksRaw.map(deck => ({
    ...deck,
    totalCardCount: (deck.new_count ?? 0) + 
                    (deck.learning_count ?? 0) + 
                    (deck.relearning_count ?? 0) + 
                    (deck.young_count ?? 0) + 
                    (deck.mature_count ?? 0)
  }));

  // Map fetchedStudySets to ClientStudySet type
  // This keeps all original study set fields and adds/maps totalCardCount
  const clientStudySets: ClientStudySet[] = fetchedStudySets.map(set => ({
    ...set, // Spread all properties from the fetched set (which has total_card_count)
    totalCardCount: set.total_card_count // Add totalCardCount (camelCase) from total_card_count (snake_case)
  }));

  return (
    <div className="container py-6">
      <PageHeading 
        title="Choose Study Material"
        description="Select what you want to review" 
      />
      <StudySelectClient 
        initialDecks={clientDecks} 
        initialStudySets={clientStudySets}
        initialGlobalSrsSummary={globalSrsSummary}
        hasErrors={hasErrors}
      />
    </div>
  );
} 