// app/study/sets/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
// import { cookies } from 'next/headers'; // Not strictly needed if createServerClient handles it
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserStudySets } from '@/lib/actions/studySetActions';
import { getDecks as getDecksAction } from '@/lib/actions/deckActions'; // Import deck action
import { StudySetListClient } from '@/components/study/StudySetListClient'; // Use absolute path
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // For casting criteria
import type { Tables } from '@/types/database'; // For Deck type if needed

// Define a more specific type for the study sets data passed to the client
type StudySetWithDeckNames = Tables<'study_sets'> & {
    relatedDeckNames?: string[];
};

export default async function ListStudySetsPage() {
  const supabase = createServerClient(); // cookies() can be passed if needed by your setup
  const { data: { session } } = await supabase.auth.getSession(); // Removed authError for brevity, assume redirect handles

  if (!session) {
    redirect('/login');
  }

  const [studySetsResult, decksResult] = await Promise.all([
    getUserStudySets(),
    getDecksAction() // Fetch all user decks
  ]);

  const studySetsRaw = studySetsResult.data || [];
  const allUserDecks = decksResult.data || []; // This will be DeckListItemWithCounts[]

  // Create a map for quick deck name lookup
  const decksMap = new Map(allUserDecks.map(d => [d.id, d.name]));

  const studySetsWithDeckNames: StudySetWithDeckNames[] = studySetsRaw.map(set => {
    let relatedDeckNames: string[] = [];
    // Safely access query_criteria and then deckIds
    const criteria = set.query_criteria as Partial<StudyQueryCriteria> | null; // Cast to allow checking properties
    if (criteria && criteria.deckIds && criteria.deckIds.length > 0) {
      relatedDeckNames = criteria.deckIds
        .map(id => decksMap.get(id)) // Get name from map
        .filter(name => name !== undefined) as string[]; // Filter out undefineds and assert as string[]
    }
    return { ...set, relatedDeckNames: relatedDeckNames.length > 0 ? relatedDeckNames : undefined };
  });

  return (
    <div className="py-4 px-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Smart Playlists</h1>
        <Button asChild>
          <Link href="/study/sets/new">Create New Playlist</Link>
        </Button>
      </div>
      {/* Pass the augmented data to the client component */}
      <StudySetListClient initialData={studySetsWithDeckNames} />
    </div>
  );
}