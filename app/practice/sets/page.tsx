// app/practice/sets/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
// import { cookies } from 'next/headers'; // Not strictly needed if createServerClient handles it
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserStudySets } from '@/lib/actions/studySetActions';
import { getDecks as getDecksAction } from '@/lib/actions/deckActions'; // Import deck action
import { getTags as getTagsAction } from '@/lib/actions/tagActions'; // Import getTags action
import { getStudySetCardCountByCriteria, getStudySetSrsDistribution, type SrsDistribution } from '@/lib/actions/studyQueryActions'; // Import new action and type
import { StudySetListClient } from '@/components/study/StudySetListClient'; // Use absolute path
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema'; // For casting criteria
import type { Tables } from '@/types/database'; // For Deck type if needed
import { appLogger } from '@/lib/logger';

// Define a more specific type for the study sets data passed to the client
type StudySetWithCountsAndDeckNames = Tables<'study_sets'> & {
    relatedDeckNames?: string[];
    totalMatchingCardCount: number; // Renamed for clarity
    actionableCardCount: number;  // Explicitly for new/due cards
    srsDistribution?: SrsDistribution | null; // Added for progress bar
    criteriaTags?: Array<{ id: string; name: string; }>; // Added for resolved criteria tags
};

export default async function ListStudySetsPage() {
  const supabase = createServerClient(); // cookies() can be passed if needed by your setup
  const { data: { session } } = await supabase.auth.getSession(); // Removed authError for brevity, assume redirect handles

  if (!session) {
    redirect('/login');
  }

  const [studySetsResult, decksResult, tagsResult] = await Promise.all([
    getUserStudySets(),
    getDecksAction(), // Fetch all user decks
    getTagsAction() // Fetch all user tags
  ]);

  const studySetsRaw = studySetsResult.data || [];
  const allUserDecks = decksResult.data || []; // This will be DeckListItemWithCounts[]
  const allUserTags = tagsResult.data || []; // This will be Tables<'tags'>[]

  // Create a map for quick deck name lookup
  const decksMap = new Map(allUserDecks.map(d => [d.id, d.name]));
  // Create a map for quick tag name lookup
  const tagsMap = new Map(allUserTags.map(t => [t.id, t.name]));

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

      // Resolve criteria tag names
      let criteriaTags: Array<{ id: string; name: string; }> = [];
      if (baseCriteria?.includeTags && Array.isArray(baseCriteria.includeTags)) {
        criteriaTags = baseCriteria.includeTags
          .map(tagId => {
            const tagName = tagsMap.get(tagId);
            return tagName ? { id: tagId, name: tagName } : null;
          })
          .filter(tag => tag !== null) as Array<{ id: string; name: string; }>;
      }

      // Construct criteriaForSet, ensuring tagLogic has a default consistent with StudyQueryCriteria type
      const criteriaForSet: StudyQueryCriteria = {
        ...(baseCriteria || {}),
        // Ensure tagLogic is 'ANY' or 'ALL'. The StudyQueryCriteria type expects this due to Zod's .default('ANY').
        tagLogic: baseCriteria?.tagLogic === 'ALL' ? 'ALL' : 'ANY',
      };
      
      // Ensure allCards is true if no specific deckIds are provided and allCards isn't already defined
      if ((!criteriaForSet.deckIds || criteriaForSet.deckIds.length === 0) && criteriaForSet.allCards === undefined) {
        criteriaForSet.allCards = true;
      }
      
      // The explicit if (!criteriaForSet.tagLogic) { criteriaForSet.tagLogic = 'ANY'; } block
      // should no longer be strictly necessary due to the direct assignment above,
      // but having it doesn't hurt as a safeguard if baseCriteria itself could somehow 
      // have an explicitly undefined tagLogic after the spread, though unlikely with the new assignment.
      // For clarity and to be certain, let's ensure it's explicitly set if the above didn't catch it (e.g. if baseCriteria.tagLogic was null not undefined):
      if (criteriaForSet.tagLogic !== 'ANY' && criteriaForSet.tagLogic !== 'ALL') {
          criteriaForSet.tagLogic = 'ANY';
      }

      // Log the criteria being used for this specific set before fetching distribution
      appLogger.debug(`[ListStudySetsPage] For set '${set.name}' (ID: ${set.id}), using criteria for SRS distribution:`, JSON.stringify(criteriaForSet, null, 2));

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
        srsDistribution: srsDistribution,
        criteriaTags: criteriaTags.length > 0 ? criteriaTags : undefined, // Add resolved tags
      };
    })
  );

  return (
    <div className="py-4 px-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Practice Your Playlists</h1>
        <Button asChild>
          <Link href="/practice/sets/new">Create New Playlist</Link>
        </Button>
      </div>
      {/* Pass the augmented data to the client component */}
      <StudySetListClient initialData={studySetsWithCountsAndDeckNames} />
    </div>
  );
}