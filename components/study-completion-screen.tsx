// components/study-completion-screen.tsx
"use client";

import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StudyProgress } from '@/components/study-progress'; // Assuming this path is correct
import { DeckHeader } from '@/components/deck-header'; // Assuming this path is correct

interface StudyCompletionScreenProps {
  // Deck Info
  deckId: string;
  deckName: string;
  totalCards: number;
  cardsReviewedCount: number;

  // Progress Info
  masteredCount: number;
  totalAchievedCorrectAnswers: number;
  totalRequiredCorrectAnswers: number;
  overallProgressPercent: number;
  masteryProgressPercent: number;

  // Action Handlers
  onResetProgress: () => void; // Practice all
  onPracticeDifficult: () => void;
  onStudyAgain: () => void; // <-- Add handler for Study Again

  // Context
  difficultCardsCount: number;
  isDifficultModeCompletion: boolean; // True if completing a "difficult cards only" session

  srsProgression: {
    newToLearning: number;
    learningToReview: number;
    stayedInLearning: number;
    droppedToLearning: number;
  };
}

export function StudyCompletionScreen({
  deckId,
  deckName,
  totalCards,
  cardsReviewedCount,
  masteredCount,
  totalAchievedCorrectAnswers,
  totalRequiredCorrectAnswers,
  overallProgressPercent,
  masteryProgressPercent,
  onResetProgress,
  onPracticeDifficult,
  onStudyAgain, // <-- Destructure handler
  difficultCardsCount,
  isDifficultModeCompletion,
  srsProgression,
}: StudyCompletionScreenProps) {

  const hasRemainingDifficult = difficultCardsCount > 0;

  const title = isDifficultModeCompletion ? "Well Done! 🍪" : "Congratulations! 🎉";
  let message: string;

  if (isDifficultModeCompletion) {
    message = hasRemainingDifficult
      ? `You've mastered this set of difficult cards! However, there are still ${difficultCardsCount} difficult ${difficultCardsCount === 1 ? 'card' : 'cards'} to practice.`
      : "You've mastered all the difficult cards! Each card has been answered correctly 3 times.";
  } else {
     message = `You've mastered all ${totalCards} cards in this deck!`;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-primary">
            <Trophy className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Session Complete!</CardTitle>
          <CardDescription>
            You've completed your study session for {deckName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Statistics */}
          <div className="rounded-lg bg-muted p-6">
            <h3 className="text-lg font-semibold mb-4">Session Summary</h3>
            <div className="grid gap-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Cards Reviewed:</span>
                <span className="font-medium">{cardsReviewedCount}</span>
              </div>
              
              {/* SRS Progression */}
              <div className="border-t pt-4 mt-2">
                <h4 className="font-medium mb-3">SRS Level Changes:</h4>
                <div className="space-y-2">
                  {srsProgression.newToLearning > 0 && (
                    <div className="flex justify-between items-center text-blue-500">
                      <span>New → Learning:</span>
                      <span>+{srsProgression.newToLearning}</span>
                    </div>
                  )}
                  {srsProgression.learningToReview > 0 && (
                    <div className="flex justify-between items-center text-green-500">
                      <span>Learning → Review:</span>
                      <span>+{srsProgression.learningToReview}</span>
                    </div>
                  )}
                  {srsProgression.stayedInLearning > 0 && (
                    <div className="flex justify-between items-center text-amber-500">
                      <span>Stayed in Learning:</span>
                      <span>{srsProgression.stayedInLearning}</span>
                    </div>
                  )}
                  {srsProgression.droppedToLearning > 0 && (
                    <div className="flex justify-between items-center text-red-500">
                      <span>Dropped to Learning:</span>
                      <span>{srsProgression.droppedToLearning}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Link href="/" passHref>
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return Home
              </Button>
            </Link>
            <Button className="w-full sm:w-auto" onClick={onStudyAgain}>
              Study Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}