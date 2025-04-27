'use client';

import React from 'react';
import { useRouter } from 'next/navigation'; 
import { StudySetSelector } from '@/components/StudySetSelector'; // Adjust path if needed
import { useStudySessionStore, StudyInput } from '@/store/studySessionStore'; 
import { useDecks } from '@/hooks/useDecks'; // Adjust path if needed
import { useStudySets } from '@/hooks/useStudySets'; // Import hook for study sets
import { Loader2 as IconLoader } from 'lucide-react';
import type { StudyMode } from '@/store/studySessionStore'; // Import StudyMode type

export default function StudySetupPage() {
  const router = useRouter();
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);
  const clearStudyParameters = useStudySessionStore((state) => state.clearStudyParameters); // Get clear action
  
  // Fetch both decks and study sets
  const { decks, isLoading: isLoadingDecks, error: decksError } = useDecks();
  const { studySets, isLoading: isLoadingStudySets, error: studySetsError } = useStudySets();

  // Callback for StudySetSelector
  const handleStartStudying = (
    actionInput: StudyInput,
    mode: StudyMode
  ) => {
    console.log("Setting study parameters and navigating:", { actionInput, mode });
    
    // Clear previous params BEFORE setting new ones and navigating
    clearStudyParameters(); 
    
    setStudyParameters(actionInput, mode);
    router.push('/study/session'); 
  };

  // Combine loading states
  const isLoadingData = isLoadingDecks || isLoadingStudySets;
  // Combine errors (show first one)
  const dataError = decksError || studySetsError;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold mb-6">Start a Study Session</h1>
      
      {isLoadingData && (
          <div className="flex justify-center items-center h-40">
              <IconLoader className="h-6 w-6 animate-spin mr-2" /> Loading options...
          </div>
      )}
      
      {dataError && (
           <div className="text-destructive p-4">Error loading options: {dataError}</div>
      )}

      {!isLoadingData && !dataError && (
          <StudySetSelector 
             decks={decks} // Pass fetched decks
             studySets={studySets} // Pass fetched study sets
             isLoadingStudySets={isLoadingStudySets} // Pass loading state for study sets
             onStartStudying={handleStartStudying} 
          />
      )}
    </div>
  );
} 