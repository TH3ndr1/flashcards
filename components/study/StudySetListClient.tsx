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
import { Edit, Play, Loader2 as IconLoader } from 'lucide-react';
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

// Updated type for the study set data passed from the server component
// This should match the type defined in app/practice/sets/page.tsx
type StudySetWithCountsAndDeckNames = Tables<'study_sets'> & {
  relatedDeckNames?: string[];
  totalMatchingCardCount: number;
  actionableCardCount: number;
  srsDistribution?: SrsDistribution | null; // Added for progress bar
};

interface StudySetListClientProps {
  initialData?: StudySetWithCountsAndDeckNames[];
  // TODO: Potentially add a user setting prop for showing progress bars on sets
  // showStudySetProgress?: boolean;
}

// StudySetCardItem sub-component
interface StudySetCardItemProps {
  set: StudySetWithCountsAndDeckNames;
}

const StudySetCardItem = React.memo(function StudySetCardItem({ set }: StudySetCardItemProps) {
  return (
    <Card key={set.id} className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent dark:border-slate-700">
      <CardHeader className="pt-4 pb-2 space-y-1 px-4">
        <div className="flex justify-between items-center">
          <CardTitle className="truncate" title={set.name}>{set.name}</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground" aria-label={`Edit ${set.name}`} asChild>
                <Link href={`/practice/sets/${set.id}/edit`}><Edit className="h-4 w-4" /></Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Edit Playlist</p></TooltipContent>
          </Tooltip>
        </div>
        <CardDescription className="text-muted-foreground gap-1 pt-1">
          <span>{set.totalMatchingCardCount} cards</span>
        </CardDescription>
        {/* Display Related Deck Names */}
        {set.relatedDeckNames && set.relatedDeckNames.length > 0 && (
          <div className="mt-1 pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
              <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Decks:</span> {set.relatedDeckNames.join(', ')}
              </p>
          </div>
        )}
      </CardHeader>
      <CardFooter className="flex justify-center items-center mt-auto pt-4 px-4 pb-4">
        <PlaylistPracticeButton studySetId={set.id} studySetName={set.name} actionableCardCount={set.actionableCardCount} />
      </CardFooter>
      {/* Add Progress Bar here */}
      {set.srsDistribution && set.totalMatchingCardCount > 0 && (
        <>
          <Separator />
          <CardContent className="px-4 pt-4 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg">
            <DeckProgressBar
              newCount={set.srsDistribution.new_count}
              learningCount={set.srsDistribution.learning_count}
              relearningCount={set.srsDistribution.relearning_count}
              youngCount={set.srsDistribution.young_count}
              matureCount={set.srsDistribution.mature_count}
            />
          </CardContent>
        </>
      )}
    </Card>
  );
});

// PlaylistPracticeButton sub-component
interface PlaylistPracticeButtonProps {
  studySetId: string;
  studySetName: string;
  actionableCardCount: number; // Changed from totalCardCount
}

function PlaylistPracticeButtonInternal({ studySetId, studySetName, actionableCardCount }: PlaylistPracticeButtonProps) {
  const router = useRouter();
  const { setStudyParameters, clearStudyParameters } = useStudySessionStore();

  const handlePractice = () => {
    if (actionableCardCount === 0) { 
      toast.info(`No cards currently available to practice in "${studySetName}".`); 
      return; 
    }
    
    const studyInput: StudySessionInput = { studySetId };
    const sessionType: SessionType = 'unified'; // Or derive as needed
    appLogger.info(`[PlaylistPracticeButton] Starting '${sessionType}' session for StudySet ${studySetId} with ${actionableCardCount} cards.`);
    clearStudyParameters(); 
    setStudyParameters(studyInput, sessionType);
    router.push('/study/session');
  };

  return (
    <Button 
      onClick={handlePractice} 
      disabled={actionableCardCount === 0} 
      size="sm" 
      className="w-full bg-primary hover:bg-primary/90 justify-center"
      title={actionableCardCount === 0 ? `No cards to practice in "${studySetName}"` : `Practice ${actionableCardCount} card(s) from "${studySetName}"`}
    >
      <Play className="h-4 w-4 mr-2" />
      Practice {actionableCardCount > 0 ? `(${actionableCardCount})` : ''}
    </Button>
  );
}

const PlaylistPracticeButton = React.memo(PlaylistPracticeButtonInternal);

export function StudySetListClient({ initialData = [] }: StudySetListClientProps) {
  const studySets = initialData;
  // const showProgress = showStudySetProgress ?? true; // Example if we add a setting

  if (studySets.length === 0) {
    return (
      <p className="text-center text-muted-foreground mt-10">You haven't created any smart playlists yet.</p>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studySets.map((set) => (
          <StudySetCardItem set={set} key={set.id} />
        ))}
      </div>
      {/* Consider if a legend is needed here like in DeckListClient */}
    </TooltipProvider>
  );
}