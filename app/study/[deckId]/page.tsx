"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// UI Components
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

// Custom Hooks & Types
import type { FlashCard } from "@/types/deck"
import { useSettings } from "@/providers/settings-provider"
import { useStudySession } from "@/hooks/use-study-session"
import type { ReviewGrade } from "@/lib/srs"
import type { StudyQueryCriteria, SrsProgression } from "@/types/study"

// Extracted Study Components
import { DeckHeader } from "@/components/deck-header"
import { StudyProgress } from "@/components/study-progress"
import { StudyCompletionScreen } from '@/components/study-completion-screen'
import { StudyFlashcardView } from '@/components/study-flashcard-view'

// Restore getDeckName server action import
import { getDeckName } from "@/lib/actions/deckActions";

/**
 * Study Deck Page Component (Refactored for Query-Based Study Session).
 *
 * This component orchestrates the flashcard study session for cards belonging
 * to a specific deck ID passed in the route.
 * It uses the refactored `useStudySession` hook, initializing it with criteria
 * to select cards from the specified deck.
 *
 * Key Changes:
 * - Uses query criteria `{ includeDecks: [deckId] }` to load cards.
 * - Relies on `useStudySession` for card fetching, SRS logic, and state management.
 * - UI adapted to work with the state provided by the new hook.
 * - Answer buttons mapped to SRS grades (1-4).
 *
 * @returns {JSX.Element} The study session UI, loading indicator, error message, or completion screen.
 */
export default function StudyDeckPage() {
  // Log when component mounts/re-renders
  console.log("[StudyDeckPage] Component rendered/mounted.");

  // --- Hooks --- 
  const { deckId } = useParams<{ deckId: string }>()
  const router = useRouter()
  const { settings } = useSettings() // Restore settings for font support

  // --- State --- 
  // State to potentially hold deck name fetched separately for the header
  const [deckName, setDeckName] = useState<string | null>(null);
  
  // Add SRS level tracking
  const [srsLevels, setSrsLevels] = useState({
    new: 0,
    learning: 0,
    review: 0
  });
  
  // Add SRS progression tracking
  const [srsProgression, setSrsProgression] = useState<SrsProgression>({
    newToLearning: 0,
    learningToReview: 0,
    stayedInLearning: 0,
    droppedToLearning: 0
  });

  // Create study criteria using useMemo instead of useState
  const studyCriteria = useMemo<StudyQueryCriteria | undefined>(() => {
    // Log the raw param value *inside* useMemo
    console.log("[StudyDeckPage useMemo] deckId from useParams:", deckId);
    if (!deckId || typeof deckId !== 'string' || deckId.includes('Unknown')) { // Add extra check
       console.warn("[StudyDeckPage useMemo] Invalid deckId detected:", deckId);
       return undefined;
    }
    
    return {
      deckId,
      includeNew: true,
      includeReview: true,
      includeLearning: true,
      limit: 50
    };
  }, [deckId]);
  
  // --- Effect to Set Deck Name --- 
  useEffect(() => {
    if (deckId) {
      getDeckName(deckId).then(({ data, error }) => {
        if (error) {
          console.error("Error fetching deck name (Action):", error);
          setDeckName("Unknown Deck");
        } else {
          setDeckName(data || "Unknown Deck");
        }
      });
    } else {
      console.error("StudyDeckPage: deckId is missing!");
      setDeckName("Unknown Deck");
    }
  }, [deckId]);

  // Log the criteria being passed to the hook
  console.log("[StudyDeckPage] Rendering with criteria:", studyCriteria);

  // --- Instantiate the Refactored Study Session Hook --- 
  const {
    studyCards,
    currentStudyCard,
    isFlipped,
    isLoading,
    error,
    isTransitioning,
    isSessionInitialized,
    isSessionComplete,
    currentCardIndex,
    studyQueueCount,
    startSession,
    flipCard,
    answerCard,
  } = useStudySession({ criteria: studyCriteria });

  // Update useEffect to calculate initial SRS levels
  useEffect(() => {
    if (studyCards) {
      const levels = studyCards.reduce((acc, card) => {
        if (!card.srs_level || card.srs_level === 0) {
          acc.new++;
        } else if (card.srs_level < 4) {
          acc.learning++;
        } else {
          acc.review++;
        }
        return acc;
      }, { new: 0, learning: 0, review: 0 });
      setSrsLevels(levels);
    }
  }, [studyCards]);

  // --- Effect for Auth Redirect (If session hook throws auth error) --- 
  useEffect(() => {
    if (!isLoading && !isSessionInitialized && error && error.toLowerCase().includes("user not authenticated")) {
      const callbackUrl = encodeURIComponent(`/study/${deckId}`);
      console.log("Auth error detected, redirecting to login...");
      router.push(`/login?callbackUrl=${callbackUrl}`);
    }
  }, [isLoading, isSessionInitialized, error, router, deckId]); // Dependencies for the effect

  // Update onAnswer to use the hook's answerCard directly
  const onAnswer = async (grade: ReviewGrade) => {
    if (!currentStudyCard) return;

    // Track SRS level changes before answering
    const oldLevel = currentStudyCard.srs_level ?? 0;
    
    // Call the hook's answerCard function
    answerCard(grade);

    // Update SRS levels based on the grade
    setSrsLevels(prev => {
      const newLevels = { ...prev };
      
      // Remove from previous category
      if (!currentStudyCard.srs_level || currentStudyCard.srs_level === 0) {
        newLevels.new--;
      } else if (currentStudyCard.srs_level < 4) {
        newLevels.learning--;
      } else {
        newLevels.review--;
      }

      // Add to new category based on grade
      if (grade === 1) { // Again
        newLevels.learning++;
      } else if (grade === 2) { // Hard
        newLevels.learning++;
      } else if (grade >= 3) { // Good or Easy
        newLevels.review++;
      }

      return newLevels;
    });

    // Update progression stats
    setSrsProgression(prev => {
      const updated = { ...prev };
      
      // Calculate new level based on grade
      let newLevel: number;
      if (grade === 1) { // Again
        newLevel = Math.max(0, oldLevel - 1);
      } else if (grade === 2) { // Hard
        newLevel = oldLevel;
      } else if (grade === 3) { // Good
        newLevel = oldLevel + 1;
      } else { // Easy
        newLevel = oldLevel + 2;
      }
      
      if (oldLevel === 0) { // Was New
        if (newLevel > 0) updated.newToLearning++;
      } else if (oldLevel < 4) { // Was Learning
        if (newLevel >= 4) updated.learningToReview++;
        else if (newLevel > 0) updated.stayedInLearning++;
      } else { // Was Review
        if (newLevel < 4) updated.droppedToLearning++;
      }
      
      return updated;
    });
  };

  // --- Render Logic --- 

  // Loading State (Waiting for initial card resolution and fetch)
  if (!studyCriteria || isLoading || !isSessionInitialized && !error) {
     return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <span className="ml-4 text-muted-foreground">Loading Study Session...</span>
      </div>
    )
  }

  // --- Post-Loading Checks --- 

  // Error State (Handles errors from the hook during initialization)
  if (error) {
    // Specific check for auth error (already handled by useEffect, but keep UI consistent)
    if (error.toLowerCase().includes("user not authenticated")) {
      return (
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="ml-4 text-muted-foreground">Redirecting to login...</span>
        </div>
      );
    } else {
      // Handle other initialization errors
      return (
        <div className="container mx-auto px-4 py-8 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-4">Error Starting Session</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push("/")}><ArrowLeft className="mr-2 h-4 w-4"/> Return to Home</Button>
        </div>
      )
    }
  }

  // Session Initialized but Empty State (No cards matched the criteria)
  if (isSessionInitialized && studyQueueCount === 0) {
      return (
      <main className="container mx-auto px-4 py-8">
        {/* Use placeholder/fetched name */}
        <DeckHeader 
          deckName={deckName || "Study Session"} 
          showReset={false}
          onReset={() => {}} // Empty function since showReset is false
        /> 
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="flex flex-col items-center justify-center p-6 py-10 text-center">
            <p className="text-muted-foreground mb-4">No cards found for this study session.</p>
            {/* Link back home or to deck edit page? */} 
            <Link href={`/`} passHref>
              <Button variant="outline">Go Home</Button>
            </Link>
             {deckId && <Link href={`/edit/${deckId}`} passHref className="ml-2">
              <Button>Edit Deck</Button>
            </Link>}
          </CardContent>
        </Card>
      </main>
    )
  }

  // --- Session Complete State --- 
  if (isSessionComplete) {
    console.log("Rendering completion screen: Study queue finished.");
    
    // Ensure deckId is valid before rendering completion screen
    if (!deckId || typeof deckId !== 'string' || deckId.includes('Unknown')) {
      console.error("Cannot render completion screen: Invalid deckId", deckId);
      // Optionally redirect or show a generic error
      return (
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-destructive">Error: Invalid session state. Cannot determine deck.</p>
          <Button onClick={() => router.push("/")}><ArrowLeft className="mr-2 h-4 w-4"/> Return to Home</Button>
        </div>
      );
    }
    
    // Define handler to restart session with original criteria
    const handleStudyAgain = () => {
      console.log("--- [StudyDeckPage] handleStudyAgain CLICKED --- Criteria:", studyCriteria);
      if (studyCriteria) { // Ensure criteria exist before restarting
        startSession(studyCriteria); 
      } else {
        console.error("--- [StudyDeckPage] handleStudyAgain - studyCriteria is undefined! Cannot restart. ---");
      }
    };
    
    return (
      <StudyCompletionScreen
        // Deck Info
        deckId={deckId}
        deckName={deckName || "Study Session"} 
        totalCards={studyQueueCount} 
        cardsReviewedCount={studyQueueCount}

        // Progress Info (simplified for SRS-based system)
        masteredCount={srsLevels.review}
        totalAchievedCorrectAnswers={studyQueueCount} // All cards were answered
        totalRequiredCorrectAnswers={studyQueueCount}
        overallProgressPercent={100} // Session is complete
        masteryProgressPercent={(srsLevels.review / studyQueueCount) * 100}

        // Action Handlers (simplified for now)
        onResetProgress={() => router.push('/')}
        onPracticeDifficult={() => router.push('/')}
        onStudyAgain={handleStudyAgain}

        // Context
        difficultCardsCount={srsLevels.learning} // Cards still in learning state
        isDifficultModeCompletion={false}
        
        // SRS Progression
        srsProgression={srsProgression}
      />
    )
  }

  // --- Active Session Guard --- 
  // If we reach here, session is active and currentStudyCard should exist.
  if (!currentStudyCard) {
      console.error("StudyDeckPage: Reached active render block but currentStudyCard is missing. This shouldn't happen.");
       return (
       <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-destructive">Error: Cannot display current card data.</p>
          <Button onClick={() => router.push("/")}><ArrowLeft className="mr-2 h-4 w-4"/> Return to Home</Button>
       </div>
      );
  }

  // --- Active Study Session Render --- 
  return (
    <main className="container mx-auto px-4 py-8">
      <DeckHeader 
        deckName={deckName || `Studying...`} 
        showReset={false}
        onReset={() => {}} // Empty function since showReset is false
      />
      
      <StudyProgress
        currentCardInQueue={currentCardIndex + 1}
        totalCardsInQueue={studyQueueCount}
        srsLevels={srsLevels}
      />

      <StudyFlashcardView
        card={currentStudyCard}
        isFlipped={isFlipped}
        isTransitioning={isTransitioning}
        onFlip={flipCard}
        onAnswer={(grade) => onAnswer(grade as ReviewGrade)}
        settings={settings}
        cardProgressText={`SRS Level: ${currentStudyCard?.srs_level ?? 0}`}
        currentCardIndex={currentCardIndex}
        totalStudyCards={studyQueueCount}
        isDifficultMode={false}
      />
    </main>
  )
}
