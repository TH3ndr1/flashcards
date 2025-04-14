"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Database, Tables } from "@/types/database";
type DbCard = Tables<'cards'>;
import type { Settings } from "@/providers/settings-provider";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, ThumbsDown, ThumbsUp, Zap, Volume2 } from "lucide-react";
import { getFontClass } from "@/lib/fonts";
import { useTTS } from "@/hooks/use-tts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ReviewGrade = 1 | 2 | 3 | 4;

interface StudyFlashcardViewProps {
  /** The current flashcard object (DbCard) to display, or null if none. */
  card: DbCard | null;
  /** Whether the card is currently flipped to show the answer. */
  isFlipped: boolean;
  /** Whether the component is transitioning (disables buttons). */
  isTransitioning: boolean;
  /** Callback function to trigger flipping the card. */
  onFlip: () => void;
  /** Callback function when the user grades their answer. */
  onAnswer: (grade: ReviewGrade) => void;
  /** User settings object. */
  settings: Settings | null;
  /** Optional: Progress display string (e.g., "Card 5 / 20"). Could be derived outside. */
  progressText?: string;
}

/**
 * Study flashcard view component for displaying and interacting with flashcards during study sessions.
 * 
 * This component handles the core flashcard study experience, including:
 * - Displaying card content (front and back)
 * - Managing card state (flipped, answered)
 * - Handling user interactions (flip, rate)
 * - Providing study controls and progress tracking
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Card} props.card - The current card being studied
 * @param {boolean} props.isFlipped - Whether the card is currently flipped
 * @param {() => void} props.onFlip - Callback for when the card is flipped
 * @param {(rating: number) => void} props.onRate - Callback for when the card is rated
 * @param {() => void} props.onNext - Callback for moving to the next card
 * @param {() => void} props.onPrevious - Callback for moving to the previous card
 * @param {number} props.currentIndex - Current card index in the session
 * @param {number} props.totalCards - Total number of cards in the session
 * @returns {JSX.Element} The study flashcard view with all interactive elements
 */
export function StudyFlashcardView({
  card,
  isFlipped,
  isTransitioning,
  onFlip,
  onAnswer,
  settings,
  progressText,
}: StudyFlashcardViewProps) {

  const { speak } = useTTS({});
  const [isSpeaking, setIsSpeaking] = useState(false);

  if (!card) {
      return (
          <Card className="w-full max-w-2xl h-80 flex items-center justify-center">
              <p className="text-muted-foreground">Loading card...</p>
          </Card>
      );
  }

  const fontClass = getFontClass(settings?.cardFont);

  const handleSpeak = async (text: string | null | undefined, defaultLang: string) => {
    if (!settings?.ttsEnabled || !text || isSpeaking) return;
    
    setIsSpeaking(true);
    console.log(`TTS: Attempting to speak "${text}" in lang ${defaultLang}`);
    try {
        await speak(text, defaultLang);
    } catch (error) {
        console.error("TTS Error:", error);
    } finally {
        setIsSpeaking(false);
    }
  };

  // Default to en-US when deck language information isn't available
  // card.deck_id exists but we don't have direct access to the deck's language properties here
  const questionLang = settings?.appLanguage ? 
    (settings.languageDialects?.[settings.appLanguage as keyof typeof settings.languageDialects] || 'en-US') : 
    'en-US';
  const answerLang = questionLang; // Default to same language for question and answer

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!isFlipped) {
        if (e.key === ' ' || e.key === 'Enter') onFlip();
        else if ((e.key === 'p' || e.key === 't') && !isSpeaking) handleSpeak(card.question, questionLang);
      } else {
        const grade = parseInt(e.key);
        if (grade >= 1 && grade <= 4) onAnswer(grade as ReviewGrade);
        else if ((e.key === 'p' || e.key === 't') && !isSpeaking) handleSpeak(card.answer, answerLang);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, isTransitioning, onAnswer, onFlip, card?.id, card?.question, card?.answer, questionLang, answerLang, isSpeaking, speak]);

  return (
    <div className="w-full max-w-2xl mx-auto"> 
      <div
        className={`flip-card ${isFlipped ? "flipped" : ""} w-full h-80 cursor-pointer`}
        onClick={onFlip}
        role="button"
        aria-label={isFlipped ? "Flip to question" : "Flip to answer"}
        tabIndex={0}
      >
        <div className="flip-card-inner relative w-full h-full">
          <div className="flip-card-front absolute w-full h-full">
            <Card className={cn("w-full h-full flex flex-col", fontClass)}>
              <CardHeader className="text-xs text-muted-foreground bg-muted/50 border-b py-2 px-4">
                 <div className="flex justify-between items-center">
                  <span>{progressText || '\u00A0'}</span>
                </div>
              </CardHeader>
              <CardContent className="p-6 text-center relative overflow-auto flex-grow flex items-center justify-center">
                <p className="text-xl md:text-2xl text-foreground">{card.question}</p>
                {settings?.ttsEnabled && card.question && (
                  <Button
                    variant="ghost" size="icon" className="absolute bottom-2 right-2"
                    onClick={(e) => { e.stopPropagation(); handleSpeak(card.question, questionLang); }}
                    disabled={isSpeaking} aria-label="Speak question"
                  > <Volume2 className={cn("h-4 w-4", isSpeaking && "animate-pulse")} /> </Button>
                )}
              </CardContent>
              <CardFooter className="justify-center text-sm text-muted-foreground bg-muted/50 border-t py-3 min-h-[52px]">
                Click card to reveal answer
              </CardFooter>
            </Card>
          </div>

          <div className="flip-card-back absolute w-full h-full">
            <Card className={cn("w-full h-full flex flex-col", fontClass)}>
               <CardHeader className="text-xs text-muted-foreground bg-muted/50 border-b py-2 px-4">
                 <div className="flex justify-between items-center">
                  <span>{progressText || '\u00A0'}</span>
                </div>
              </CardHeader>
              <CardContent className="p-6 text-center relative overflow-auto flex-grow flex items-center justify-center">
                <p className="text-xl md:text-2xl text-foreground">{card.answer}</p>
                 {settings?.ttsEnabled && card.answer && (
                  <Button
                    variant="ghost" size="icon" className="absolute bottom-2 right-2"
                    onClick={(e) => { e.stopPropagation(); handleSpeak(card.answer, answerLang); }}
                    disabled={isSpeaking} aria-label="Speak answer"
                  > <Volume2 className={cn("h-4 w-4", isSpeaking && "animate-pulse")} /> </Button>
                )}
              </CardContent>
              <CardFooter className="text-center text-sm text-muted-foreground bg-muted/50 border-t py-3 space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild><Button variant="outline" className="flex-1 border-red-500 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 active:scale-95 transition-all duration-150" onClick={(e) => { e.stopPropagation(); onAnswer(1); }} disabled={isTransitioning || isSpeaking} aria-label="Again - Complete reset (Press 1)"><Repeat className="mr-1 h-4 w-4" /> Again <span className="ml-1 opacity-50">(1)</span></Button></TooltipTrigger>
                    <TooltipContent side="bottom"><p className="font-medium">Again (1)</p><p className="text-sm text-muted-foreground">Complete reset. Use when you completely forgot or got it wrong.</p></TooltipContent>
                  </Tooltip>
                   <Tooltip>
                     <TooltipTrigger asChild><Button variant="outline" className="flex-1 border-amber-500 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 active:scale-95 transition-all duration-150" onClick={(e) => { e.stopPropagation(); onAnswer(2); }} disabled={isTransitioning || isSpeaking} aria-label="Hard - Remember with significant effort (Press 2)"><ThumbsDown className="mr-1 h-4 w-4" /> Hard <span className="ml-1 opacity-50">(2)</span></Button></TooltipTrigger>
                    <TooltipContent side="bottom"><p className="font-medium">Hard (2)</p><p className="text-sm text-muted-foreground">Remembered with significant effort. Review interval will increase slightly.</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild><Button variant="outline" className="flex-1 border-green-500 text-green-700 hover:bg-green-500/10 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 active:scale-95 transition-all duration-150" onClick={(e) => { e.stopPropagation(); onAnswer(3); }} disabled={isTransitioning || isSpeaking} aria-label="Good - Remember with some effort (Press 3)"><ThumbsUp className="mr-1 h-4 w-4" /> Good <span className="ml-1 opacity-50">(3)</span></Button></TooltipTrigger>
                     <TooltipContent side="bottom"><p className="font-medium">Good (3)</p><p className="text-sm text-muted-foreground">Remembered with some effort. Normal interval increase.</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild><Button variant="outline" className="flex-1 border-blue-500 text-blue-700 hover:bg-blue-500/10 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 active:scale-95 transition-all duration-150" onClick={(e) => { e.stopPropagation(); onAnswer(4); }} disabled={isTransitioning || isSpeaking} aria-label="Easy - Remember effortlessly (Press 4)"><Zap className="mr-1 h-4 w-4" /> Easy <span className="ml-1 opacity-50">(4)</span></Button></TooltipTrigger>
                    <TooltipContent side="bottom"><p className="font-medium">Easy (4)</p><p className="text-sm text-muted-foreground">Remembered effortlessly. Larger interval increase.</p></TooltipContent>
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