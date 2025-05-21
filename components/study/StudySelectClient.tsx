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

type Deck = Tables<'decks'> & {
   new_count: number;
   learning_count: number;
   young_count: number;
   mature_count: number;
   learn_eligible_count?: number;
   review_eligible_count?: number;
};
type StudySet = Tables<'study_sets'>;

interface StudySelectClientProps {
  initialDecks: Deck[];
  initialStudySets: StudySet[];
  hasErrors: boolean;
}

export function StudySelectClient({
  initialDecks,
  initialStudySets,
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
        isLoadingStudySets={false}
        onStartStudying={handleStartStudying} // This callback now expects SessionType
      />
    </>
  );
}