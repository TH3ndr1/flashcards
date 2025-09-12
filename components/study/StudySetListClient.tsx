// components/study/StudySetListClient.tsx
"use client";

import React from 'react'; // Removed useState, useEffect, useCallback as they are no longer needed in PlaylistPracticeButton for counts
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Edit, Play, Loader2 as IconLoader, CalendarCheck as AgendaIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Tables } from '@/types/database';
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudySessionInput, SessionType } from '@/types/study';
// resolveStudyQuery and getCardSrsStatesByIds are no longer needed here
// import { isValid, parseISO } from 'date-fns'; // No longer needed here
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import { useRouter } from 'next/navigation';
import { DeckProgressBar } from "@/components/deck/DeckProgressBar"; // Import progress bar
import { Separator } from "@/components/ui/separator"; // Import Separator
import type { SrsDistribution } from '@/lib/actions/studyQueryActions'; // Import SrsDistribution type
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import { Badge } from "@/components/ui/badge";
import { ItemInfoBadges } from '@/components/ItemInfoBadges'; // Updated import path
import { DeckProgressLegend } from '@/components/deck/DeckProgressLegend'; // Import the new legend component

// Updated type for the study set data passed from the server component
// This should match the type defined in app/practice/sets/page.tsx
type StudySetWithCountsAndDeckNames = Tables<'study_sets'> & {
  relatedDeckNames?: string[];
  totalMatchingCardCount: number;
  actionableCardCount: number;
  srsDistribution?: SrsDistribution | null; // Added for progress bar
  criteriaTags?: Array<{ id: string; name: string; }>; // Ensure this matches server-side type
};

interface StudySetListClientProps {
  initialData?: StudySetWithCountsAndDeckNames[];
  // TODO: Potentially add a user setting prop for showing progress bars on sets
  // showStudySetProgress?: boolean;
}

// StudySetCardItem sub-component
interface StudySetCardItemProps {
  set: StudySetWithCountsAndDeckNames;
  onPractice: (studySetId: string, studySetName: string, actionableCardCount: number, queryCriteria: StudyQueryCriteria | null) => void;
}

const StudySetCardItem = React.memo(function StudySetCardItem({ set, onPractice }: StudySetCardItemProps) {
  const criteria = set.query_criteria as Partial<StudyQueryCriteria> | null;
  const criteriaTagsToDisplay = set.criteriaTags || [];

  const handleCardClick = () => {
    onPractice(set.id, set.name, set.actionableCardCount, set.query_criteria as StudyQueryCriteria);
  };

  return (
    <Card 
      key={set.id} 
      className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent dark:border-slate-700 cursor-pointer"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCardClick();
        }
      }}
    >
      <CardHeader className="pt-4 pb-2 space-y-1 px-4">
        <div className="flex justify-between items-start"> {/* items-start for top alignment of edit button */}
          <CardTitle className="text-lg font-semibold leading-none tracking-wide font-atkinson truncate mr-2" title={set.name}>
            {set.name}
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground" aria-label={`Edit ${set.name}`} asChild>
                <Link href={`/practice/sets/${set.id}/edit`} onClick={(e) => e.stopPropagation()}><Edit className="h-4 w-4" /></Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Edit Study Set</p></TooltipContent>
          </Tooltip>
        </div>
        {/* ItemInfoBadges moved to CardContent, RelatedDeckNames also moved */}
      </CardHeader>
      
      {/* Content Section: Badges, Separator, Progress (if applicable) */}
      {/* This CardContent will always be shown if there are badges or progress */}
      {(set.totalMatchingCardCount > 0 || (set.relatedDeckNames && set.relatedDeckNames.length > 0) || set.srsDistribution) && (
        <CardContent className="px-4 pt-3 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg space-y-3">
          <ItemInfoBadges 
            primaryLanguage={undefined} // Study sets use languageCriterion
            secondaryLanguage={undefined}
            isBilingual={false}
            languageCriterion={criteria?.containsLanguage}
            cardCount={set.totalMatchingCardCount}
            tags={criteriaTagsToDisplay}
            // practiceableCount is omitted or 0 for sets, so badge shows default total style
          />
          {/* Display Related Deck Names */}
          {set.relatedDeckNames && set.relatedDeckNames.length > 0 && (
            <div className="text-xs text-muted-foreground">
                <span className="font-medium">Decks:</span> {set.relatedDeckNames.join(', ')}
            </div>
          )}
          {set.srsDistribution && set.totalMatchingCardCount > 0 && (
            <>
              <Separator />
              <DeckProgressBar
                newCount={set.srsDistribution.new_count}
                learningCount={set.srsDistribution.learning_count}
                relearningCount={set.srsDistribution.relearning_count}
                youngCount={set.srsDistribution.young_count}
                matureCount={set.srsDistribution.mature_count}
              />
              {/* DeckProgressLegend removed from individual card */}
            </>
          )}
        </CardContent>
      )}
      {/* CardFooter with PlaylistPracticeButton removed */}
    </Card>
  );
});

// PlaylistPracticeButton sub-component REMOVED (logic integrated or passed to StudySetCardItem)

export function StudySetListClient({ initialData = [] }: StudySetListClientProps) {
  const studySets = initialData;
  const router = useRouter();
  const { setStudyParameters, clearStudyParameters } = useStudySessionStore();

  const handlePracticeSet = (studySetId: string, studySetName: string, actionableCardCount: number, queryCriteria: StudyQueryCriteria | null) => {
    if (actionableCardCount === 0) { 
      toast.info(`No cards currently available to practice in "${studySetName}".`); 
      return; 
    }
    
    let studyInput: StudySessionInput;
    if (queryCriteria) {
      studyInput = { criteria: queryCriteria, studySetId: undefined, deckId: undefined };
      appLogger.info(`[StudySetListClient] Starting session for StudySet ${studySetId} using criteria. Actionable: ${actionableCardCount} cards.`);
    } else {
      studyInput = { studySetId: studySetId, criteria: undefined, deckId: undefined };
      appLogger.warn(`[StudySetListClient] Starting session for StudySet ${studySetId} using only ID (queryCriteria was null). Actionable: ${actionableCardCount} cards.`);
    }
    
    const sessionType: SessionType = 'unified';
    clearStudyParameters(); 
    setStudyParameters(studyInput, sessionType, undefined, true);
    router.push('/study/session');
  };

  if (studySets.length === 0) {
    return (
      <p className="text-center text-muted-foreground mt-10">You haven't created any smart playlists yet.</p>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Changed gap-4 to gap-6 */}
        {studySets.map((set) => (
          <StudySetCardItem set={set} key={set.id} onPractice={handlePracticeSet} />
        ))}
      </div>
      {/* Global DeckProgressLegend - show if any set has srsDistribution */}
      {studySets.some(set => set.srsDistribution && set.totalMatchingCardCount > 0) && (
        <div className="mt-8 pt-4 border-t dark:border-slate-700 flex justify-center">
          <DeckProgressLegend 
            newCount={0}
            learningCount={0}
            relearningCount={0}
            youngCount={0}
            matureCount={0}
            showEmptyStages={true}
          />
        </div>
      )}
    </TooltipProvider>
  );
}