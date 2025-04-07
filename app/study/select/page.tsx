'use client';

import React from 'react';
import { useRouter } from 'next/navigation'; 
import { StudySetSelector } from '@/components/StudySetSelector'; // Adjust path if needed
import { useStudySessionStore, StudyInput } from '@/store/studySessionStore'; 
import { useDecks } from '@/hooks/useDecks'; // Adjust path if needed
import { Loader2 as IconLoader } from 'lucide-react';

type StudyMode = 'learn' | 'review'; // Define or import StudyMode

export default function StudySetupPage() {
  const router = useRouter();
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);
  const { decks, isLoading: isLoadingDecks, error: decksError } = useDecks();

  // Callback for StudySetSelector
  const handleStartStudying = (
    actionInput: StudyInput,
    mode: StudyMode
  ) => {
    console.log("Setting study parameters and navigating:", { actionInput, mode });
    setStudyParameters(actionInput, mode);
    router.push('/study/session'); 
  };

  if (isLoadingDecks) {
    return (
        <div className="flex justify-center items-center h-40">
            <IconLoader className="h-6 w-6 animate-spin mr-2" /> Loading decks...
        </div>
    );
  }

  if (decksError) {
     return <div className="text-destructive p-4">Error loading decks: {decksError}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Start a Study Session</h1>
      <StudySetSelector 
         decks={decks} // Pass fetched decks
         onStartStudying={handleStartStudying} // Pass the callback
       />
    </div>
  );
} 