import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDecks } from '@/lib/actions/deckActions';
import { getUserStudySets } from '@/lib/actions/studySetActions';
import { PageHeading } from '@/components/ui/page-heading';
import { StudySelectClient } from '../../../components/study/StudySelectClient';
import type { Tables } from '@/types/database';

/**
 * Study Selection Page
 * 
 * This is a Server Component that pre-fetches both decks and study sets data
 * server-side before rendering the page, eliminating client-side data fetching delays.
 * 
 * @returns {Promise<JSX.Element>} The Study Selection page with pre-fetched data
 */
export default async function StudySelectPage() {
  // Check authentication server-side
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (!session) {
    redirect("/login");
  }

  // Pre-fetch both decks and study sets in parallel server-side
  const [decksResult, studySetsResult] = await Promise.all([
    getDecks(),
    getUserStudySets()
  ]);

  const hasErrors = Boolean(decksResult.error || studySetsResult.error);

  // Type for Deck with SRS counts from StudySelectClient
  type DeckWithCounts = Tables<'decks'> & {
    new_count: number;
    learning_count: number;
    young_count: number;
    mature_count: number;
  };

  return (
    <div className="container py-6">
      <PageHeading 
        title="Choose Study Material"
        description="Select what you want to review" 
        backHref="/"
      />
      <StudySelectClient 
        initialDecks={(decksResult.data || []) as unknown as DeckWithCounts[]} 
        initialStudySets={studySetsResult.data || []}
        hasErrors={hasErrors}
      />
    </div>
  );
} 