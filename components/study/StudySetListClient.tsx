// components/study/StudySetListClient.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react'; // Added useEffect, useCallback
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { getCardSrsStatesByIds } from '@/lib/actions/cardActions';
import { isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { appLogger } from '@/lib/logger';
import { useRouter } from 'next/navigation'; // Import useRouter

// Updated type for the study set data passed from the server component
type StudySetWithDeckNames = Tables<'study_sets'> & {
  relatedDeckNames?: string[];
};

interface StudySetListClientProps {
  initialData?: StudySetWithDeckNames[];
}

// PlaylistPracticeButton sub-component (same as previously corrected version)
interface PlaylistPracticeButtonProps {
  studySetId: string;
  studySetName: string;
}
function PlaylistPracticeButton({ studySetId, studySetName }: PlaylistPracticeButtonProps) {
  const router = useRouter();
  const { setStudyParameters, clearStudyParameters } = useStudySessionStore();
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);
  const [learnEligibleCount, setLearnEligibleCount] = useState(0);
  const [reviewEligibleCount, setReviewEligibleCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      setIsLoadingCounts(true); setFetchError(null);
      try {
        appLogger.info(`[PlaylistPracticeButton] Fetching card IDs for StudySet: ${studySetId}`);
        const idResult = await resolveStudyQuery({ studySetId });
        if (!isMounted) return;
        if (idResult.error || !idResult.data) throw new Error(idResult.error || "Failed to resolve study set card IDs.");
        if (idResult.data.length === 0) { if(isMounted){setLearnEligibleCount(0); setReviewEligibleCount(0); setIsLoadingCounts(false);} return; }
        const srsStatesResult = await getCardSrsStatesByIds(idResult.data);
        if (!isMounted) return;
        if (srsStatesResult.error || !srsStatesResult.data) throw new Error(srsStatesResult.error || "Failed to fetch SRS states.");
        const cardStates = srsStatesResult.data;
        const now = new Date();
        const learnCards = cardStates.filter(c => c.srs_level === 0 && (c.learning_state === null || c.learning_state === 'learning')).length;
        const reviewCards = cardStates.filter(c => {
          const isReviewable = (c.srs_level != null && c.srs_level >= 1) || (c.srs_level === 0 && c.learning_state === 'relearning');
          const isDue = c.next_review_due && isValid(parseISO(c.next_review_due)) && parseISO(c.next_review_due) <= now;
          return isReviewable && isDue;
        }).length;
        if(isMounted){setLearnEligibleCount(learnCards); setReviewEligibleCount(reviewCards);}
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error fetching counts.";
        appLogger.error(`[PlaylistPracticeButton] Error for ${studySetId}:`, message);
        if(isMounted) setFetchError(message);
      } finally {
        if(isMounted) setIsLoadingCounts(false);
      }
    };
    fetchCounts();
    return () => { isMounted = false; };
  }, [studySetId]);

  const totalPracticeable = learnEligibleCount + reviewEligibleCount;
  const handlePractice = () => {
    if (totalPracticeable === 0 && !isLoadingCounts && !fetchError) { toast.info(`No cards currently available to practice in "${studySetName}".`); return; }
    if (fetchError && !isLoadingCounts){ toast.error(`Cannot start practice for "${studySetName}" due to an error loading card counts.`); return; }
    const studyInput: StudySessionInput = { studySetId };
    const sessionType: SessionType = 'unified';
    appLogger.info(`[PlaylistPracticeButton] Starting '${sessionType}' session for StudySet ${studySetId}`);
    clearStudyParameters(); setStudyParameters(studyInput, sessionType); router.push('/study/session');
  };
  if (isLoadingCounts) return <Button size="sm" disabled className="w-full justify-center"><IconLoader className="h-4 w-4 mr-2 animate-spin" /> Checking Cards...</Button>;
  if(fetchError) return <Button size="sm" variant="outline" className="w-full justify-center border-destructive text-destructive hover:bg-destructive/10" onClick={handlePractice} title={fetchError}><Play className="h-4 w-4 mr-2" /> Practice (Error)</Button>;
  return <Button onClick={handlePractice} disabled={totalPracticeable === 0} size="sm" className="w-full bg-primary hover:bg-primary/90 justify-center" title={totalPracticeable === 0 ? `No cards to practice in "${studySetName}"` : `Practice ${totalPracticeable} card(s) from "${studySetName}"`}><Play className="h-4 w-4 mr-2" />Practice {totalPracticeable > 0 ? `(${totalPracticeable})` : ''}</Button>;
}


export function StudySetListClient({ initialData = [] }: StudySetListClientProps) {
  const studySets = initialData;

  if (studySets.length === 0) {
    return (
      <p className="text-center text-muted-foreground mt-10">You haven't created any smart playlists yet.</p>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {studySets.map((set) => (
          <Card key={set.id} className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent dark:border-slate-700">
            <CardHeader className="pt-4 pb-2 space-y-1 px-4">
              <div className="flex justify-between items-center">
                <CardTitle className="truncate" title={set.name}>{set.name}</CardTitle>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground" aria-label={`Edit ${set.name}`} asChild>
                      <Link href={`/study/sets/${set.id}/edit`}><Edit className="h-4 w-4" /></Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Edit Playlist</p></TooltipContent>
                </Tooltip>
              </div>
              <CardDescription>
                {set.description || `Updated ${formatDistanceToNow(new Date(set.updated_at), { addSuffix: true })}`}
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
            {/* Removed CardContent that was empty */}
            <CardFooter className="flex justify-end items-center mt-auto pt-4 px-4 pb-4">
              <PlaylistPracticeButton studySetId={set.id} studySetName={set.name} />
            </CardFooter>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}