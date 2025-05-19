"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudySetSelector } from '@/components/study/StudySetSelector';
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudyInput, StudyMode } from '@/store/studySessionStore';
import { toast } from 'sonner';
import type { Tables } from '@/types/database';
import { appLogger, statusLogger } from '@/lib/logger';

// Define types using Tables helper
type Deck = Tables<'decks'> & {
  new_count: number;
  learning_count: number;
  young_count: number;
  mature_count: number;
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
  const { setStudyParameters } = useStudySessionStore();
  const [error] = useState<string | null>(hasErrors ? 'There was an issue loading some data' : null);

  // Handle starting a study session
  const handleStartStudying = async (studyInput: StudyInput, mode: StudyMode) => {
    try {
      // Initialize the study session in the store
      setStudyParameters(studyInput, mode);
      
      // Navigate to the study session page
      router.push('/study/session');
    } catch (error) {
      appLogger.error('Error starting study session:', error);
      toast.error('Failed to start study session.');
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
        onStartStudying={handleStartStudying}
      />
    </>
  );
} 