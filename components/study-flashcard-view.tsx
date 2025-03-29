"use client";

import { cn } from "@/lib/utils";
import type { FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { DifficultyIndicator } from "@/components/difficulty-indicator";
import { getFontClass } from "@/lib/fonts";

interface StudyFlashcardViewProps {
  /** The current flashcard object to display. */
  card: FlashCard;
  /** Whether the card is currently flipped to show the answer. */
  isFlipped: boolean;
  /** Whether the component is transitioning between cards (disables buttons). */
  isTransitioning: boolean;
  /** Callback function to trigger flipping the card. */
  onFlip: () => void;
  /** Callback function when the user marks the answer as correct or incorrect. */
  onAnswer: (isCorrect: boolean) => void;
  /** User settings object, used for features like showing difficulty. */
  settings: Settings | null;
  /** Pre-calculated text displaying the card's progress (e.g., "2 / 3 correct"). */
  cardProgressText: string;
  /** The index of the current card in the study session sequence. */
  currentCardIndex: number;
  /** The total number of cards in the current study session sequence. */
  totalStudyCards: number;
  /** Indicates if the study session is currently focused on difficult cards. */
  isDifficultMode: boolean;
}

/**
 * Renders the interactive, flippable flashcard view for a study session.
 * Handles displaying the question and answer, flip animations, and answer buttons.
 */
export function StudyFlashcardView({
  card,
  isFlipped,
  isTransitioning,
  onFlip,
  onAnswer,
  settings,
  cardProgressText,
  currentCardIndex,
  totalStudyCards,
  isDifficultMode,
}: StudyFlashcardViewProps) {

  // Defensive check in case card is unexpectedly undefined, though page should prevent this.
  if (!card) {
      return <Card className="w-full h-80 flex items-center justify-center"><p className="text-muted-foreground">No card data.</p></Card>;
  }

  // --- Get the dynamic font class --- 
  const fontClass = getFontClass(settings?.cardFont);
  // ---

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={`flip-card ${isFlipped ? "flipped" : ""} w-full h-80 cursor-pointer`}
        onClick={onFlip} // Use the passed callback
        role="button"
        aria-label={isFlipped ? "Flip to question" : "Flip to answer"}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') onFlip(); }} // Use the passed callback
      >
        <div className="flip-card-inner relative w-full h-full">
          {/* Front Side (Question) */}
          <div className="flip-card-front absolute w-full h-full">
            <Card className={cn(
              "w-full h-full flex flex-col",
              isDifficultMode && "border-amber-500",
              fontClass
            )}>
              <CardHeader className="text-center text-sm text-muted-foreground bg-muted/50 border-b py-3">
                 <div className="flex justify-between items-center">
                  <div className="text-xs font-medium">Card {currentCardIndex + 1} of {totalStudyCards}</div>
                  <div className="text-xs font-medium">{cardProgressText}</div>
                  {settings?.showDifficulty && (
                    <DifficultyIndicator
                      difficultyScore={card.difficultyScore ?? null}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
                <p className="text-xl md:text-2xl">{card.question}</p>
              </CardContent>
              <CardFooter className="justify-center text-sm text-muted-foreground bg-muted/50 border-t py-3 min-h-[52px]">
                Click card to reveal answer
              </CardFooter>
            </Card>
          </div>

          {/* Back Side (Answer) */}
          <div className="flip-card-back absolute w-full h-full">
            <Card className={cn(
              "w-full h-full flex flex-col",
              isDifficultMode && "border-amber-500",
              fontClass
            )}>
              <CardHeader className="text-center text-sm text-muted-foreground bg-muted/50 border-b py-3">
                  <div className="flex justify-between items-center">
                  <div className="text-xs font-medium">Card {currentCardIndex + 1} of {totalStudyCards}</div>
                  <div className="text-xs font-medium">{cardProgressText}</div>
                  {settings?.showDifficulty && (
                    <DifficultyIndicator
                      difficultyScore={card.difficultyScore ?? null}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
                <p className="text-xl md:text-2xl">{card.answer}</p>
              </CardContent>
              <CardFooter className="text-center text-sm text-muted-foreground bg-muted/50 border-t py-3 space-x-4">
                   <Button
                  variant="outline"
                  className="flex-1 border-red-500 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 active:scale-95 transition-all duration-150"
                  onClick={(e) => { e.stopPropagation(); onAnswer(false); }} // Use the passed callback
                  disabled={isTransitioning}
                  aria-label="Mark as incorrect"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" /> Incorrect
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-green-500 text-green-700 hover:bg-green-500/10 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 active:scale-95 transition-all duration-150"
                  onClick={(e) => { e.stopPropagation(); onAnswer(true); }} // Use the passed callback
                  disabled={isTransitioning}
                  aria-label="Mark as correct"
                >
                  <ThumbsUp className="mr-2 h-4 w-4" /> Correct
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 