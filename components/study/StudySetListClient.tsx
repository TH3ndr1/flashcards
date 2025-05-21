// components/study/StudySelectClient.tsx
"use client";

import { useState } from 'react'; // Keep for error state
import { useRouter } from 'next/navigation';
import { StudySetSelector } from './StudySetSelector'; // Using relative path assuming it's in same dir
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudySessionInput, SessionType } from '@/types/study';
import { toast } from 'sonner';
import type { Tables } from '@/types/database';
import { appLogger } from '@/lib/logger';

// Type for Deck with SRS counts, assuming this is what initialDecks will be
type DeckWithEligibleCounts = Pick<Tables<'decks'>, 'id' | 'name'> & {
  // These counts might come from a different source or calculation if not directly on deck type
  learn_eligible_count?: number;
  review_eligible_count?: number;
  // Add other counts if DeckSetSelector uses them for display or logic
  new_count?: number;
  learning_count?: number;
  young_count?: number;
  mature_count?: number;
};

type StudySet = Pick<Tables<'study_sets'>, 'id' | 'name'>; // Simplified for this component

interface StudySelectClientProps {
  initialDecks: DeckWithEligibleCounts[];
  initialStudySets: StudySet[];
  hasErrors: boolean; // If server-side fetching had errors
}

export function StudySelectClient({
  initialDecks,
  initialStudySets,
  hasErrors
}: StudySelectClientProps) {
  const router = useRouter();
  const { setStudyParameters, clearStudyParameters } = useStudySessionStore();
  // Error state is primarily for server-side fetch errors passed via props
  const [error] = useState<string | null>(hasErrors ? 'There was an issue loading initial selection data.' : null);

  const handleStartStudying = async (input: StudySessionInput, sessionType: SessionType) => {
    try {
      appLogger.info(`[StudySelectClient] Setting params for ${sessionType} session:`, {input, sessionType});
      clearStudyParameters();
      setStudyParameters(input, sessionType); // Store uses SessionType now
      router.push('/study/session');
    } catch (err) {
      appLogger.error('[StudySelectClient] Error starting study session:', err);
      toast.error('Failed to start study session. Please try again.');
    }
  };

  return (
    <>
      {error && (
        <div className="mt-6 mb-6 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <StudySetSelector
        decks={initialDecks} // Pass simplified deck type
        studySets={initialStudySets}
        isLoadingStudySets={false} // Assuming data is pre-fetched by server component
        onStartStudying={handleStartStudying}
      />
    </>
  );
}