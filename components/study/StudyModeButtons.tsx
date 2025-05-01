'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { resolveStudyQuery } from '@/lib/actions/studyQueryActions';
import { useStudySessionStore, type StudyInput, type StudyMode } from '@/store/studySessionStore';
import { Loader2 as IconLoader, GraduationCap, Play } from 'lucide-react';
import { toast } from 'sonner';

interface StudyModeButtonsProps {
  /** Type of content to study - either a deck or a study set */
  studyType: 'deck' | 'studySet';
  /** ID of the deck or study set */
  contentId: string;
  /** Optional CSS class to apply to the button container */
  className?: string;
  /** Optional size variant for the buttons */
  size?: 'default' | 'sm' | 'lg';
  /** Optional label for the Learn button (default: "Learn") */
  learnLabel?: string;
  /** Optional label for the Review button (default: "Review") */
  reviewLabel?: string;
}

export function StudyModeButtons({
  studyType,
  contentId,
  className = '',
  size = 'default',
  learnLabel = 'Learn',
  reviewLabel = 'Review'
}: StudyModeButtonsProps) {
  const router = useRouter();
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);
  const clearStudyParameters = useStudySessionStore((state) => state.clearStudyParameters);
  
  const [isLoading, setIsLoading] = useState(false);
  const [learnCount, setLearnCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCardCounts = async () => {
      if (!contentId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // For study sets, we need different approaches for Learn vs Review
        // because the criteria is stored in the database
        if (studyType === 'studySet') {
          // For Learn mode with study sets
          const learnCriteria = {
            srsLevel: { operator: 'equals', value: 0 },
            includeLearning: true
          };
          
          const learnResult = await resolveStudyQuery({
            studySetId: contentId,
            criteria: learnCriteria
          });
          
          // For Review mode with study sets
          const reviewCriteria = {
            srsLevel: { operator: 'greaterThan', value: 0 },
            nextReviewDue: { operator: 'isDue' }
          };
          
          const reviewResult = await resolveStudyQuery({
            studySetId: contentId,
            criteria: reviewCriteria
          });
          
          if (learnResult.error || reviewResult.error) {
            console.error("Error fetching card counts:", learnResult.error || reviewResult.error);
            setError("Failed to check available cards");
          }
          
          // Log the results for debugging
          console.log(`[StudyModeButtons] Learn count result:`, learnResult.data?.length || 0);
          console.log(`[StudyModeButtons] Review count result:`, reviewResult.data?.length || 0);
          
          setLearnCount(learnResult.data?.length || 0);
          setReviewCount(reviewResult.data?.length || 0);
        } else {
          // Existing code for deck type
          console.log(`[StudyModeButtons] Fetching counts for ${studyType} ID: ${contentId}`);
          
          // Query for learning-eligible cards
          const learnResult = await resolveStudyQuery({
            criteria: {
              deckId: contentId,
              tagLogic: 'ANY',
              includeDifficult: false,
              srsLevel: { 
                operator: 'equals', 
                value: 0 
              },
              // We don't want cards in relearning state (which have srs_level=0 but learning_state='relearning')
              // The DB function should handle this properly with a specific criteria
              includeLearning: true
            }
          });
            
          // Query for review-eligible cards
          const reviewResult = await resolveStudyQuery({
            criteria: {
              deckId: contentId,
              tagLogic: 'ANY',
              includeDifficult: false,
              nextReviewDue: { operator: 'isDue' },
              // Exclude cards counted in Learn mode (only include graduated cards)
              srsLevel: { operator: 'greaterThan', value: 0 }
            }
          });
            
          if (learnResult.error || reviewResult.error) {
            console.error("Error fetching card counts:", learnResult.error || reviewResult.error);
            setError("Failed to check available cards");
          }
          
          // Log the results for debugging
          console.log(`[StudyModeButtons] Learn count result:`, learnResult.data?.length || 0);
          console.log(`[StudyModeButtons] Review count result:`, reviewResult.data?.length || 0);
          
          // Set counts
          setLearnCount(learnResult.data?.length || 0);
          setReviewCount(reviewResult.data?.length || 0);
        }
      } catch (error) {
        console.error("Error fetching card counts:", error);
        setError("Error checking available cards");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCardCounts();
  }, [contentId, studyType]);
  
  const handleStartStudying = (mode: StudyMode) => {
    // Create the appropriate StudyInput based on type and mode
    let studyInput: StudyInput;
    
    if (studyType === 'studySet') {
      // For study sets, we need to pass studySetId directly (not under criteria)
      // but we still need to add filtering criteria
      const criteria: any = {
        // Add specific criteria based on mode
        ...(mode === 'learn' ? {
          srsLevel: { operator: 'equals', value: 0 },
          includeLearning: true
        } : {}),
        ...(mode === 'review' ? {
          srsLevel: { operator: 'greaterThan', value: 0 },
          nextReviewDue: { operator: 'isDue' }
        } : {})
      };
      
      studyInput = {
        studySetId: contentId,
        criteria: criteria
      };
    } else {
      // For decks, use the existing approach
      studyInput = {
        criteria: { 
          deckId: contentId, 
          tagLogic: 'ANY', 
          includeDifficult: false,
          // Include special criteria for Learn mode to match what we counted
          ...(mode === 'learn' ? {
            srsLevel: { operator: 'equals', value: 0 },
            includeLearning: true
          } : {}),
          // Include special criteria for Review mode to match what we counted
          ...(mode === 'review' ? {
            nextReviewDue: { operator: 'isDue' },
            srsLevel: { operator: 'greaterThan', value: 0 }
          } : {})
        } 
      };
    }
    
    console.log(`[StudyModeButtons] Starting ${mode} mode with input:`, studyInput);
      
    // Verify counts for the selected mode
    if (mode === 'learn' && learnCount === 0) {
      toast.error("No cards available for learning in this selection.");
      return;
    }
    
    if (mode === 'review' && reviewCount === 0) {
      toast.error("No cards due for review in this selection.");
      return;
    }
    
    // Clear previous params BEFORE setting new ones
    clearStudyParameters();
    
    // Set parameters and navigate
    setStudyParameters(studyInput, mode);
    router.push('/study/session');
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {isLoading ? (
        <div className="flex items-center text-muted-foreground text-sm">
          <IconLoader className="w-3 h-3 mr-2 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          <Button
            variant="secondary"
            size={size}
            className="bg-rose-500 hover:bg-rose-600 text-white"
            onClick={() => handleStartStudying('learn')}
            disabled={learnCount === 0}
          >
            <GraduationCap className="h-4 w-4 mr-1" /> {learnLabel} {learnCount > 0 && `(${learnCount})`}
          </Button>
          
          <Button
            variant="secondary"
            size={size}
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={() => handleStartStudying('review')}
            disabled={reviewCount === 0}
          >
            <Play className="h-4 w-4 mr-1" /> {reviewLabel} {reviewCount > 0 && `(${reviewCount})`}
          </Button>
        </>
      )}
    </div>
  );
} 