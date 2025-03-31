"use client";

import { cn } from "@/lib/utils";
import type { FlashCard } from "@/types/deck";
import type { Settings } from "@/providers/settings-provider";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, ThumbsDown, ThumbsUp, Zap, Volume2 } from "lucide-react";
import { DifficultyIndicator } from "@/components/difficulty-indicator";
import { getFontClass } from "@/lib/fonts";
import { useTTS } from "@/hooks/use-tts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect } from "react";

interface StudyFlashcardViewProps {
  /** The current flashcard object to display. */
  card: FlashCard;
  /** Whether the card is currently flipped to show the answer. */
  isFlipped: boolean;
  /** Whether the component is transitioning between cards (disables buttons). */
  isTransitioning: boolean;
  /** Callback function to trigger flipping the card. */
  onFlip: () => void;
  /** Callback function when the user grades their answer (1=Again, 2=Hard, 3=Good, 4=Easy). */
  onAnswer: (grade: 1 | 2 | 3 | 4) => void;
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

  // Initialize TTS
  const { speak, loading: ttsLoading } = useTTS();

  // Log the card prop received by the component
  console.log("[StudyFlashcardView] Rendering card:", card);

  // Defensive check in case card is unexpectedly undefined, though page should prevent this.
  if (!card) {
      return <Card className="w-full h-80 flex items-center justify-center"><p className="text-muted-foreground">No card data.</p></Card>;
  }

  // --- Get the dynamic font class --- 
  const fontClass = getFontClass(settings?.cardFont);
  // ---

  // Handle TTS playback
  const handleSpeak = async (text: string, language?: string) => {
    // Log arguments received by handleSpeak
    console.log("[handleSpeak] called with:", { text, language });

    if (!settings?.ttsEnabled) return;
    
    // Default to English if no language is specified
    const languageCode = language || 'en-US';
    
    console.log("TTS: Speaking", { text, languageCode });
    const { error } = await speak(text, languageCode); // Pass potentially undefined text here
    if (error) {
      console.error("TTS Error:", error);
    }
  };

  // Add keyboard event handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      
      // Only handle number keys when card is flipped
      if (!isFlipped) {
        // Space or Enter to flip
        if (e.key === ' ' || e.key === 'Enter') {
          onFlip();
        }
        // 'p' or 't' to play question
        else if ((e.key === 'p' || e.key === 't') && !ttsLoading) {
          const language = card.questionLanguage || card.primaryLanguage || 'en-US';
          handleSpeak(card.question, language);
        }
        return;
      }

      // Prevent handling if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Handle answer keys when flipped
      const grade = parseInt(e.key);
      if (grade >= 1 && grade <= 4) {
        onAnswer(grade as 1 | 2 | 3 | 4);
      }
      // 'p' or 't' to play answer when flipped
      else if ((e.key === 'p' || e.key === 't') && !ttsLoading) {
        const language = card.answerLanguage || card.secondaryLanguage || 'en-US';
        handleSpeak(card.answer, language);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, isTransitioning, onAnswer, card, ttsLoading]);

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={`flip-card ${isFlipped ? "flipped" : ""} w-full h-80 cursor-pointer`}
        onClick={onFlip}
        role="button"
        aria-label={isFlipped ? "Flip to question" : "Flip to answer"}
        tabIndex={0}
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
              <CardContent className="p-6 text-center relative overflow-auto">
                {/* Log value directly in JSX */}
                {console.log("[StudyFlashcardView JSX] Question:", card.question)}
                <p className="text-xl md:text-2xl text-foreground">{card.question}</p>
                {settings?.ttsEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const textToSpeak = card.question;
                      const language = card.questionLanguage || card.primaryLanguage || 'en-US';
                      console.log("[TTS Button Click - Q] Text:", textToSpeak, "Lang:", language);
                      if (textToSpeak) {
                         handleSpeak(textToSpeak, language); 
                      }
                    }}
                    disabled={ttsLoading}
                  >
                    <Volume2 className={cn("h-4 w-4", ttsLoading && "animate-pulse")} />
                  </Button>
                )}
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
              <CardContent className="p-6 text-center relative overflow-auto">
                {/* Log value directly in JSX */}
                {console.log("[StudyFlashcardView JSX] Answer:", card.answer)}
                <p className="text-xl md:text-2xl text-foreground">{card.answer}</p>
                {settings?.ttsEnabled && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute bottom-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const textToSpeak = card.answer;
                      const language = card.answerLanguage || card.secondaryLanguage || 'en-US';
                      console.log("[TTS Button Click - A] Text:", textToSpeak, "Lang:", language);
                      if (textToSpeak) {
                         handleSpeak(textToSpeak, language); 
                      }
                    }}
                    disabled={ttsLoading}
                  >
                    <Volume2 className={cn("h-4 w-4", ttsLoading && "animate-pulse")} />
                  </Button>
                )}
              </CardContent>
              <CardFooter className="text-center text-sm text-muted-foreground bg-muted/50 border-t py-3 space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 border-red-500 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 active:scale-95 transition-all duration-150"
                        onClick={(e) => { e.stopPropagation(); onAnswer(1); }}
                        disabled={isTransitioning}
                        aria-label="Again - Complete reset (Press 1)"
                      >
                        <Repeat className="mr-1 h-4 w-4" /> Again <span className="ml-1 opacity-50">(1)</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-medium">Again (1)</p>
                      <p className="text-sm text-muted-foreground">Complete reset. Use when you completely forgot or got it wrong.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 border-amber-500 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 active:scale-95 transition-all duration-150"
                        onClick={(e) => { e.stopPropagation(); onAnswer(2); }}
                        disabled={isTransitioning}
                        aria-label="Hard - Remember with significant effort (Press 2)"
                      >
                        <ThumbsDown className="mr-1 h-4 w-4" /> Hard <span className="ml-1 opacity-50">(2)</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-medium">Hard (2)</p>
                      <p className="text-sm text-muted-foreground">Remembered with significant effort. Review interval will increase slightly.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 border-green-500 text-green-700 hover:bg-green-500/10 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 active:scale-95 transition-all duration-150"
                        onClick={(e) => { e.stopPropagation(); onAnswer(3); }}
                        disabled={isTransitioning}
                        aria-label="Good - Remember with some effort (Press 3)"
                      >
                        <ThumbsUp className="mr-1 h-4 w-4" /> Good <span className="ml-1 opacity-50">(3)</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-medium">Good (3)</p>
                      <p className="text-sm text-muted-foreground">Remembered with some effort. Normal interval increase.</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 border-blue-500 text-blue-700 hover:bg-blue-500/10 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 active:scale-95 transition-all duration-150"
                        onClick={(e) => { e.stopPropagation(); onAnswer(4); }}
                        disabled={isTransitioning}
                        aria-label="Easy - Remember effortlessly (Press 4)"
                      >
                        <Zap className="mr-1 h-4 w-4" /> Easy <span className="ml-1 opacity-50">(4)</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="font-medium">Easy (4)</p>
                      <p className="text-sm text-muted-foreground">Remembered effortlessly. Larger interval increase.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 