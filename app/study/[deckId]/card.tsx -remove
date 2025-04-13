"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTTS } from "@/hooks/use-tts";
import { useSettings } from "@/providers/settings-provider";
import type { Deck, FlashCard } from "@/types/deck";
import type { FontOption } from "@/providers/settings-provider";
import { getFontClass } from "@/lib/fonts";

interface CardProps {
  card: {
    question: string;
    answer: string;
  };
  onAnswer: (result: 'easy' | 'medium' | 'hard') => void;
}

export default function Card({ card, onAnswer }: CardProps) {
  const { settings, loading } = useSettings(); // Assume settings = { cardFont: 'opendyslexic' | 'atkinson' | 'sans' | undefined }
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  // REMOVE: const [fontsLoaded, setFontsLoaded] = useState(false);

  // Get the font class based on the selected font
  const getFontClass = (font: FontOption | undefined): string => {
    switch (font) {
      case 'opendyslexic':
        return 'font-opendyslexic'; // Matches tailwind.config.js key
      case 'atkinson':
        return 'font-atkinson';   // Matches tailwind.config.js key
      default:
        return 'font-sans';         // Default font class
    }
  };

  // REMOVE: useEffect for font loading detection - next/font handles this

  const handleShowAnswer = () => {
    // Reset state when flipping to a new card *before* showing answer
    if (!showAnswer) {
        setIsFlipping(true);
        setShowAnswer(true);
        setTimeout(() => {
        setIsFlipping(false);
        }, 300); // Match animation duration
    }
  };

  const handleAnswer = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (isAnswering || isFlipping) return; // Prevent answering during flip
    setIsAnswering(true);
    // Optionally reset flip state immediately or wait for onAnswer callback
    setShowAnswer(false);
    // setIsAnswering(false); // Reset this after onAnswer completes in parent or via prop
    onAnswer(difficulty);
    // Add a small delay before resetting answering state if needed,
    // otherwise the card might flip back too quickly if onAnswer is fast.
    // Consider managing isAnswering state based on parent component logic after onAnswer.
    setTimeout(() => setIsAnswering(false), 100); // Example quick reset
  };

   // Reset showAnswer state when the card prop changes (new card is loaded)
   useEffect(() => {
       setShowAnswer(false);
       setIsAnswering(false); // Ensure answering state is reset for new card
       // No need to reset isFlipping here, it's transient
   }, [card]);


  // If still loading settings, show loading state
  // Font loading is handled implicitly by next/font and CSS
  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto p-8 text-center">
        Loading settings...
      </div>
    );
  }

  const fontClass = getFontClass(settings?.cardFont);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        className={cn(
          "relative w-full aspect-[3/2] perspective-1000",
          isFlipping && "cursor-wait" // Indicate loading during flip
        )}
      >
        <div
          className={cn(
            "w-full h-full duration-300 preserve-3d relative transition-transform ease-in-out", // Ensure transition properties are set
            showAnswer && "rotate-y-180"
          )}
          style={{ transformStyle: "preserve-3d" }} // Explicit style sometimes helps
        >
          {/* Front of card (Question) */}
          <div
            className={cn(
              "w-full h-full backface-hidden absolute bg-card border rounded-lg shadow-md overflow-hidden", // Added common card styles
              fontClass // Apply dynamic font class
            )}
            style={{ backfaceVisibility: "hidden" }} // Explicit style
          >
            <div className="w-full h-full flex flex-col">
              <CardContent className="flex-grow flex items-center justify-center p-6 md:p-8">
                 {/* Apply font class directly here too if needed, but inheriting should work */}
                <div className="text-center text-xl md:text-2xl">{card.question}</div>
              </CardContent>
              <CardFooter className="flex justify-center p-4">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={isFlipping || showAnswer} // Disable if flipping or already shown
                  onClick={handleShowAnswer}
                >
                  Show Answer
                </Button>
              </CardFooter>
            </div>
          </div>

          {/* Back of card (Answer) */}
          <div
            className={cn(
              "w-full h-full backface-hidden absolute rotate-y-180 bg-card border rounded-lg shadow-md overflow-hidden", // Added common card styles
              fontClass // Apply dynamic font class
            )}
             style={{ backfaceVisibility: "hidden" }} // Explicit style
          >
            <div className="w-full h-full flex flex-col">
              <CardContent className="flex-grow flex items-center justify-center p-6 md:p-8">
                {/* Apply font class directly here too if needed */}
                <div className="text-center text-xl md:text-2xl">{card.answer}</div>
              </CardContent>
              <CardFooter className="flex justify-center gap-2 sm:gap-4 p-4">
                <Button
                  variant="destructive"
                  size="lg" // Consistent size
                  disabled={isAnswering || isFlipping} // Disable if answering or flipping
                  onClick={() => handleAnswer('hard')}
                >
                  Hard
                </Button>
                <Button
                  variant="default"
                   size="lg" // Consistent size
                  disabled={isAnswering || isFlipping}
                  onClick={() => handleAnswer('medium')}
                >
                  Medium
                </Button>
                <Button
                  variant="outline"
                   size="lg" // Consistent size
                  disabled={isAnswering || isFlipping}
                  onClick={() => handleAnswer('easy')}
                >
                  Easy
                </Button>
              </CardFooter>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}