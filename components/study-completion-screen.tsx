// components/study-completion-screen.tsx
"use client";

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StudyProgress } from '@/components/study-progress'; // Assuming this path is correct
import { DeckHeader } from '@/components/deck-header'; // Assuming this path is correct

interface StudyCompletionScreenProps {
  // Deck Info
  deckName: string;
  totalCards: number;

  // Progress Info
  masteredCount: number;
  totalAchievedCorrectAnswers: number;
  totalRequiredCorrectAnswers: number;
  overallProgressPercent: number;
  masteryProgressPercent: number;

  // Action Handlers
  onResetProgress: () => void; // Practice all
  onPracticeDifficult: () => void;

  // Context
  difficultCardsCount: number;
  isDifficultModeCompletion: boolean; // True if completing a "difficult cards only" session
}

export function StudyCompletionScreen({
  deckName,
  totalCards,
  masteredCount,
  totalAchievedCorrectAnswers,
  totalRequiredCorrectAnswers,
  overallProgressPercent,
  masteryProgressPercent,
  onResetProgress,
  onPracticeDifficult,
  difficultCardsCount,
  isDifficultModeCompletion,
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
    <main className="container mx-auto px-4 py-8">
      <DeckHeader deckName={deckName} onReset={onResetProgress} showReset={true} />
      <StudyProgress
        totalCorrect={totalAchievedCorrectAnswers}
        totalRequired={totalRequiredCorrectAnswers}
        overallPercent={overallProgressPercent}
        masteredCount={masteredCount}
        totalCards={totalCards}
        masteryPercent={masteryProgressPercent}
      />
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="flex flex-col items-center justify-center p-6 py-10 text-center">
          <h2 className="text-xl font-semibold mb-2">{title}</h2>
          <p className="text-muted-foreground mb-6">{message}</p>
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {/* Always show "Practice All" button after any completion */}
            <Button
              variant="outline"
              onClick={onResetProgress} // Renamed handler for clarity
              className="w-full"
            >
              Practice All Cards Again
            </Button>

            {/* Show "Practice Difficult" if there are difficult cards */}
            {hasRemainingDifficult && (
              <Button
                variant="outline"
                onClick={onPracticeDifficult} // Renamed handler
                className="w-full border-amber-500 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
              >
                Practice {difficultCardsCount} Difficult {difficultCardsCount === 1 ? 'Card' : 'Cards'} 🍪
              </Button>
            )}

            <Link href="/" passHref className="w-full">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Decks
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}