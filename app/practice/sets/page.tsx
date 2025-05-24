// app/study/sets/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
// import { cookies } from 'next/headers'; // Not strictly needed if createServerClient handles it
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserStudySets } from '@/lib/actions/studySetActions';
import { getDecks as getDecksAction } from '@/lib/actions/deckActions'; // Import deck action
import { getStudySetCardCountByCriteria, getStudySetSrsDistribution, type SrsDistribution } from '@/lib/actions/studyQueryActions'; // Import new action and type
import { StudySetListClient } from '@/components/study/StudySetListClient'; // Use absolute path
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // For casting criteria
import type { Tables } from '@/types/database'; // For Deck type if needed

// Define a more specific type for the study sets data passed to the client
type StudySetWithCountsAndDeckNames = Tables<'study_sets'> & {
    relatedDeckNames?: string[];
    totalMatchingCardCount: number; // Renamed for clarity
    actionableCardCount: number;  // Explicitly for new/due cards
    srsDistribution?: SrsDistribution | null; // Added for progress bar
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

  // Fetch card counts for all study sets in parallel
  const studySetsWithCountsAndDeckNames: StudySetWithCountsAndDeckNames[] = await Promise.all(
    studySetsRaw.map(async (set) => {
      let relatedDeckNames: string[] = [];
      const baseCriteria = set.query_criteria as Partial<StudyQueryCriteria> | null;
      
      if (baseCriteria && baseCriteria.deckIds && baseCriteria.deckIds.length > 0) {
        relatedDeckNames = baseCriteria.deckIds
          .map(id => decksMap.get(id))
          .filter(name => name !== undefined) as string[];
      }

      // Base criteria for the set (used for SRS distribution and actionable count)
      const criteriaForSet: StudyQueryCriteria = {
        ...(baseCriteria || {}),
      };
      if (!criteriaForSet.deckIds || criteriaForSet.deckIds.length === 0) {
        if (criteriaForSet.allCards === undefined) { 
            criteriaForSet.allCards = true;
        }
      }
      if (!criteriaForSet.tagLogic) { 
        criteriaForSet.tagLogic = 'ANY';
      }

      // 1. Fetch SRS distribution (which now includes actionable_count)
      const distributionResult = await getStudySetSrsDistribution({ criteria: criteriaForSet });
      const srsDistribution = distributionResult.data;

      // Calculate totalMatchingCardCount from srsDistribution
      let totalMatchingCardCount = 0;
      let actionableCardCount = 0; // Initialize actionableCardCount

      if (srsDistribution) {
        totalMatchingCardCount = 
          srsDistribution.new_count +
          srsDistribution.learning_count +
          srsDistribution.relearning_count +
          srsDistribution.young_count +
          srsDistribution.mature_count;
        actionableCardCount = srsDistribution.actionable_count; // Use directly from distribution
      }
      
      // The separate call for actionableCardCount is no longer needed.
      // const criteriaForActionable: StudyQueryCriteria = {
      //   ...criteriaForSet, 
      //   srsFilter: 'new_review'   
      // };
      // const actionableResult = await getStudySetCardCountByCriteria({ 
      //   criteria: criteriaForActionable
      // });
      // const actionableCardCount = actionableResult.data ?? 0;

      return { 
        ...set, 
        relatedDeckNames: relatedDeckNames.length > 0 ? relatedDeckNames : undefined,
        totalMatchingCardCount: totalMatchingCardCount, 
        actionableCardCount: actionableCardCount, // Now derived from srsDistribution
        srsDistribution: srsDistribution 
      };
    })
  );

  return (
    <div className="py-4 px-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Smart Playlists</h1>
        <Button asChild>
          <Link href="/study/sets/new">Create New Playlist</Link>
        </Button>
      </div>
      {/* Pass the augmented data to the client component */}
      <StudySetListClient initialData={studySetsWithCountsAndDeckNames} />
    </div>
  );
}