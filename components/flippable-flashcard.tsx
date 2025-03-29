// components/flippable-flashcard.tsx
"use client";

import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DifficultyIndicator } from '@/components/difficulty-indicator'; // Assuming this path is correct

interface FlippableFlashcardProps {
  // Card Content
  question: string;
  answer: string;
  difficultyScore?: number | null;

  // State & Interaction
  isFlipped: boolean;
  isTransitioning: boolean;
  onFlip: () => void;
  onAnswer: (correct: boolean) => void;

  // Styling & Context
  fontClass: string;
  isDifficultMode?: boolean;
  showDifficultySetting?: boolean;
  cardPositionText: string; // e.g., "Card 1 of 10"
  cardProgressText: string; // e.g., "1 / 3 correct"
}

export function FlippableFlashcard({
  question,
  answer,
  difficultyScore,
  isFlipped,
  isTransitioning,
  onFlip,
  onAnswer,
  fontClass,
  isDifficultMode = false,
  showDifficultySetting = false,
  cardPositionText,
  cardProgressText,
}: FlippableFlashcardProps) {

  // Stop propagation for answer buttons to prevent card flip
  const handleAnswerClick = (e: React.MouseEvent, correct: boolean) => {
    e.stopPropagation();
    onAnswer(correct);
  };

  // Allow flipping with space/enter keys
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault(); // Prevent scrolling or button activation
      onFlip();
    }
  };

  // Internal shared header component for DRYness
  const CardHeaderContent = () => (
     <div className="flex justify-between items-center">
       <div className="text-xs font-medium">{cardPositionText}</div>
       <div className="text-xs font-medium">{cardProgressText}</div>
       {showDifficultySetting && (
         <DifficultyIndicator
           difficultyScore={difficultyScore ?? null}
         />
       )}
     </div>
  );

  return (
    <div
      className={`flip-card ${isFlipped ? "flipped" : ""} w-full h-80 cursor-pointer`}
      onClick={onFlip}
      role="button"
      aria-label={isFlipped ? "Flip to question" : "Flip to answer"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flip-card-inner relative w-full h-full">
        {/* --- Front of Card --- */}
        <div className="flip-card-front absolute w-full h-full">
          <Card className={cn(
            "w-full h-full flex flex-col",
            isDifficultMode && "border-amber-500",
            fontClass // Apply dynamic font class
          )}>
            <CardHeader className="text-center text-sm text-muted-foreground bg-muted/50 border-b py-3">
              <CardHeaderContent />
            </CardHeader>
            <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
              <p className="text-xl md:text-2xl">{question}</p>
            </CardContent>
            <CardFooter className="justify-center text-sm text-muted-foreground bg-muted/50 border-t py-3 min-h-[52px]">
              Click card to reveal answer
            </CardFooter>
          </Card>
        </div>

        {/* --- Back of Card --- */}
        <div className="flip-card-back absolute w-full h-full">
          <Card className={cn(
            "w-full h-full flex flex-col",
            isDifficultMode && "border-amber-500",
            fontClass // Apply dynamic font class
          )}>
            <CardHeader className="text-center text-sm text-muted-foreground bg-muted/50 border-b py-3">
               <CardHeaderContent />
            </CardHeader>
            <CardContent className="flex-grow flex items-center justify-center p-6 text-center">
              <p className="text-xl md:text-2xl">{answer}</p>
            </CardContent>
            <CardFooter className="text-center text-sm text-muted-foreground bg-muted/50 border-t py-3 space-x-4">
              <Button
                variant="outline"
                className="flex-1 border-red-500 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 active:scale-95 transition-all duration-150"
                onClick={(e) => handleAnswerClick(e, false)}
                disabled={isTransitioning}
                aria-label="Mark as incorrect"
              >
                <ThumbsDown className="mr-2 h-4 w-4" /> Incorrect
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-green-500 text-green-700 hover:bg-green-500/10 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 active:scale-95 transition-all duration-150"
                onClick={(e) => handleAnswerClick(e, true)}
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
  );
}