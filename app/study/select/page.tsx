'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StudySetSelector } from '@/components/study/StudySetSelector';
import { getDecks } from '@/lib/actions/deckActions';
import { getStudySets } from '@/lib/actions/studySetActions';
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudyInput, StudyMode } from '@/store/studySessionStore';
import { PageHeading } from '@/components/ui/page-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function StudySelectPage() {
  const router = useRouter();
  const [isLoadingDecks, setIsLoadingDecks] = useState(true);
  const [isLoadingStudySets, setIsLoadingStudySets] = useState(true);
  const [decks, setDecks] = useState<any[]>([]);
  const [studySets, setStudySets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const { setStudyParameters } = useStudySessionStore();

  // Initialize data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingDecks(true);
        setIsLoadingStudySets(true);
        setError(null);
        
        // Fetch decks
        const decksResult = await getDecks();
        if (decksResult.error) {
          console.error('Error fetching decks:', decksResult.error);
          setError('Failed to load decks');
        } else {
          setDecks(decksResult.data || []);
        }
        setIsLoadingDecks(false);
        
        // Fetch study sets
        const studySetsResult = await getStudySets();
        if (studySetsResult.error) {
          console.error('Error fetching study sets:', studySetsResult.error);
          setError('Failed to load smart playlists');
        } else {
          setStudySets(studySetsResult.data || []);
        }
        setIsLoadingStudySets(false);
      } catch (error) {
        console.error('Error in fetching data:', error);
        setError('Something went wrong');
        setIsLoadingDecks(false);
        setIsLoadingStudySets(false);
      }
    };

    fetchData();
  }, []);

  // Handle starting a study session
  const handleStartStudying = async (studyInput: StudyInput, mode: StudyMode) => {
    try {
      // Initialize the study session in the store
      setStudyParameters(studyInput, mode);
      
      // Navigate to the study session page
      router.push('/study/session');
    } catch (error) {
      console.error('Error starting study session:', error);
      toast.error('Failed to start study session');
    }
  };

  return (
    <div className="container max-w-3xl py-6">
      <PageHeading 
        title="Study Cards" 
        description="Choose what to study and how you want to review" 
        backHref="/"
      />
      
      {error && (
        <div className="mt-6 p-4 border border-destructive/50 rounded-lg bg-destructive/10 text-destructive">
          {error}
        </div>
      )}
      
      <div className="mt-8">
        {isLoadingDecks ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <StudySetSelector 
            decks={decks}
            studySets={studySets}
            isLoadingStudySets={isLoadingStudySets}
            onStartStudying={handleStartStudying}
          />
        )}
      </div>
    </div>
  );
} 