// components/study/StudySelectClient.tsx
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
// Assuming StudySetSelector is now in the same directory or adjust path
import { StudySetSelector } from './StudySetSelector'; // Changed path
import { useStudySessionStore } from '@/store/studySessionStore';
// CORRECTED IMPORTS:
import type { StudySessionInput, SessionType } from '@/types/study';
import { toast } from 'sonner';
import type { Tables } from '@/types/database';
import type { DeckListItemWithCounts } from '@/lib/actions/deckActions'; // For Deck type with SRS counts
import type { UserGlobalSrsSummary } from '@/lib/actions/studyQueryActions'; // Import the new type

// Expected augmented types from the server component
type DeckWithTotalCount = DeckListItemWithCounts & {
  totalCardCount: number;
};

type StudySetWithTotalCount = Tables<'study_sets'> & {
  totalCardCount: number;
};

interface StudySelectClientProps {
  initialDecks: DeckWithTotalCount[];
  initialStudySets: StudySetWithTotalCount[];
  initialGlobalSrsSummary: UserGlobalSrsSummary; // Added new prop
  hasErrors: boolean;
}

export function StudySelectClient({
  initialDecks,
  initialStudySets,
  initialGlobalSrsSummary, // Destructure new prop
  hasErrors
}: StudySelectClientProps) {
  const router = useRouter();
  const { setStudyParameters, clearStudyParameters } = useStudySessionStore();
  const [error] = useState<string | null>(hasErrors ? 'There was an issue loading some data' : null);

  // onStartStudying now expects SessionType from StudySetSelector
  const handleStartStudying = async (input: StudySessionInput, sessionType: SessionType) => {
    try {
      console.log(`[StudySelectClient] Setting params for ${sessionType} session:`, input);
      clearStudyParameters();
      setStudyParameters(input, sessionType); // Pass SessionType to store
      router.push('/study/session');
    } catch (error) {
      console.error('Error starting study session:', error);
      toast.error('Failed to start study session');
    }
  };

  return (
    <>
      {error && (
        <div className="mt-6 mb-6 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      )}
      <StudySetSelector
        decks={initialDecks}
        studySets={initialStudySets}
        globalSrsSummary={initialGlobalSrsSummary} // Pass new prop
        isLoadingStudySets={false}
        onStartStudying={handleStartStudying} // This callback now expects SessionType
      />
    </>
  );
}