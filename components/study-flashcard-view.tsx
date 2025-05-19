"use client";

// --- Add useMemo import ---
import React, { useEffect, useState, useMemo } from "react";
// -------------------------
import { cn } from "@/lib/utils";
import type { Database, Tables } from "@/types/database";
type DbCard = Tables<'cards'>;
// --- Import Settings AND Palette types/data ---
import type { Settings } from "@/providers/settings-provider";
// Assuming palettes are defined in lib/palettes.ts or provider, adjust path:
import {
    PREDEFINED_PALETTES,
    DEFAULT_PALETTE_CONFIG,
    DARK_MODE_CARD_BG
} from "@/lib/palettes";
import type { Palette, ColorPair } from "@/lib/palettes";
// ------------------------------------------
// --- Import useTheme ---
import { useTheme } from "next-themes";
// ---------------------
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThumbsDown, ThumbsUp, Volume2, ChevronsDown, ChevronsUp } from "lucide-react"; // Keep original imports
import { getFontClass } from "@/lib/fonts";
import { useTTS } from "@/hooks/use-tts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appLogger } from '@/lib/logger';

type ReviewGrade = 1 | 2 | 3 | 4;

interface StudyFlashcardViewProps {
  card: DbCard | null;
  isFlipped: boolean;
  isTransitioning: boolean;
  onFlip: () => void;
  onAnswer: (grade: ReviewGrade) => void;
  settings: Settings | null; // Now includes palette config and enable flags
  progressText?: string;
}


// --- UPDATED Helper function ---
function getWordStyles(
    pos: string | null | undefined,
    gender: string | null | undefined,
    textLanguageCode: string | undefined, // NEW: Language of the text itself
    settings: Settings | null,
    theme: string | undefined // 'light' | 'dark' | 'system'
): React.CSSProperties {
    const defaultStyle = {};
    if (!pos || pos === 'N/A' || !settings || !textLanguageCode) {
        return defaultStyle; // Cannot style without info
    }

    // --- NEW: Check if coloring should be skipped based on native language setting ---
    appLogger.debug('[getWordStyles] Checking native language:', {
        colorOnlyNonNative: settings.colorOnlyNonNative,
        appLanguage: settings.appLanguage,
        textLanguageCode: textLanguageCode,
        shouldSkip: settings.colorOnlyNonNative && settings.appLanguage === textLanguageCode
    });
    if (settings.colorOnlyNonNative && settings.appLanguage === textLanguageCode) {
        appLogger.debug(`[getWordStyles] Skipping color for native language (${textLanguageCode}) word.`);
        return defaultStyle; // Skip styling if it's the native language and setting is ON
    }
    // ---------------------------------------------------------------------------------

    const posKey = pos;
    const isBasicPos = ['Noun', 'Verb'].includes(posKey);
    const isEnabled = isBasicPos ? settings.enableBasicColorCoding : settings.enableAdvancedColorCoding;
    if (!isEnabled) { return defaultStyle; } // Styling not enabled for this PoS type

    const effectiveTheme = theme === 'dark' ? 'dark' : 'light';
    // Use paletteConfig from settings
    const paletteConfig = settings.wordPaletteConfig ?? DEFAULT_PALETTE_CONFIG;
    const genderKey = (gender && gender !== 'N/A' && paletteConfig?.[posKey]?.[gender]) ? gender : 'Default';
    const paletteId = paletteConfig?.[posKey]?.[genderKey] ?? 'default';

    if (paletteId === 'default') { return defaultStyle; }

    const selectedPalette = PREDEFINED_PALETTES.find(p => p.id === paletteId);
    if (!selectedPalette) { return defaultStyle; }

    const colorPair = selectedPalette[effectiveTheme];
    if (colorPair && colorPair.background !== 'transparent' && colorPair.text !== 'inherit') {
        return {
            backgroundColor: colorPair.background,
            color: colorPair.text,
        };
    }
    return defaultStyle;
}
// -----------------------------


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
  // --- Get current theme ---
  const { theme } = useTheme();
  // -------------------------

  // --- Calculate styles using useMemo, passing text language ---
  const cardStyles = useMemo(() => {
      const defaultStyles = { questionStyle: {}, answerStyle: {}, cardRequiresDarkBg: false };
      if (!card || !settings) {
          return defaultStyles;
      }

      // --- Get language codes from the card's associated deck data ---
      // Assumes card includes decks relation: cards(..., decks(primary_language, secondary_language))
      // Use lowercase language codes ('en', 'fr', etc.) for comparison
      // TODO: Ensure card.decks is correctly typed and fetched
      // @ts-ignore - Assuming card.decks exists for now
      const questionLangCode = card.decks?.primary_language?.toLowerCase();
      // @ts-ignore - Assuming card.decks exists for now
      const answerLangCode = card.decks?.secondary_language?.toLowerCase();
      // -------------------------------------------------------------

      // Use correct snake_case field names from DbCard type
      const qStyle = getWordStyles(card.question_part_of_speech, card.question_gender, questionLangCode, settings, theme);
      const aStyle = getWordStyles(card.answer_part_of_speech, card.answer_gender, answerLangCode, settings, theme);

      // Dark mode background logic (needs slight adjustment)
      // Apply dark BG if dark theme AND (basic or advanced is enabled)
      // This prevents flickering if one side is native but the other isn't.
      const isAnyColoringEnabled = settings.enableBasicColorCoding || settings.enableAdvancedColorCoding;
      // Only require dark bg if styles actually applied and a relevant setting is enabled
      const cardRequiresDarkBg = theme === 'dark' && isAnyColoringEnabled && (Object.keys(qStyle).length > 0 || Object.keys(aStyle).length > 0);


      return {
          questionStyle: qStyle,
          answerStyle: aStyle,
          cardRequiresDarkBg: cardRequiresDarkBg
      };
  }, [card, settings, theme]); // Add theme dependency
  // ----------------------------------------------------

  // handleSpeak function (Original logic kept)
  const handleSpeak = async (text: string | null | undefined, defaultLang: string) => {
    if (!settings?.ttsEnabled || !text || isSpeaking) return;
    setIsSpeaking(true);
    try { await speak(text, defaultLang); }
    catch (error) { appLogger.error("TTS Error:", error); }
    finally { setIsSpeaking(false); }
  };

  // Language determination (Original logic kept)
  const questionLang = settings?.appLanguage ? (settings.languageDialects?.[settings.appLanguage as keyof typeof settings.languageDialects] || 'en-US') : 'en-US';
  const answerLang = questionLang;

  // useEffect for keypress (Original logic kept)
  useEffect(() => {
    if (!card) return; // Early return inside the effect is fine
    
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
  }, [isFlipped, isTransitioning, onAnswer, onFlip, card, questionLang, answerLang, isSpeaking, handleSpeak, settings?.ttsEnabled]); 

  // Move the early return after all hooks have been called
  if (!card) { 
    return ( 
      <Card className="w-full max-w-2xl h-80 flex items-center justify-center">
        <p className="text-muted-foreground">Loading card...</p>
      </Card> 
    ); 
  }

  const fontClass = getFontClass(settings?.cardFont);

  // --- Conditionally apply dark mode background to card ---
  const cardDarkBgStyle: React.CSSProperties = cardStyles.cardRequiresDarkBg ? { backgroundColor: DARK_MODE_CARD_BG } : {};
  // -------------------------------------------------------

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
          {/* Front Side */}
          <div className="flip-card-front absolute w-full h-full">
            {/* Apply card background style */}
            <Card className={cn("w-full h-full flex flex-col flashcard-border", fontClass)} style={cardDarkBgStyle}>
              <CardHeader className="text-xs text-muted-foreground bg-muted/50 border-b py-2 px-4">
                 <div className="flex justify-between items-center"> <span>{progressText || '\u00A0'}</span> </div>
              </CardHeader>
              <CardContent className="p-6 text-center relative overflow-auto flex-grow flex items-center justify-center">
                 {/* Apply text style and classes to existing <p> */}
                <p className="text-xl md:text-2xl text-foreground inline-block px-2 py-1 rounded transition-colors duration-200" style={cardStyles.questionStyle}> {card.question} </p>
                {/* Original TTS Button */}
                {settings?.ttsEnabled && card.question && ( <Button variant="ghost" size="icon" className="absolute bottom-2 right-2" onClick={(e) => { e.stopPropagation(); handleSpeak(card.question, questionLang); }} disabled={isSpeaking} aria-label="Speak question"> <Volume2 className={cn("h-4 w-4", isSpeaking && "animate-pulse")} /> </Button> )}
              </CardContent>
              <CardFooter className="justify-center text-sm text-muted-foreground bg-muted/50 border-t py-3 min-h-[52px]"> Click card to reveal answer </CardFooter>
            </Card>
          </div>

          {/* Back Side */}
          <div className="flip-card-back absolute w-full h-full">
             {/* Apply card background style */}
            <Card className={cn("w-full h-full flex flex-col flashcard-border", fontClass)} style={cardDarkBgStyle}>
               <CardHeader className="text-xs text-muted-foreground bg-muted/50 border-b py-2 px-4">
                 <div className="flex justify-between items-center"> <span>{progressText || '\u00A0'}</span> </div>
               </CardHeader>
              <CardContent className="p-6 text-center relative overflow-auto flex-grow flex items-center justify-center">
                 {/* Apply text style and classes to existing <p> */}
                 <p className="text-xl md:text-2xl text-foreground inline-block px-2 py-1 rounded transition-colors duration-200" style={cardStyles.answerStyle}> {card.answer} </p>
                 {/* Original TTS Button */}
                 {settings?.ttsEnabled && card.answer && ( <Button variant="ghost" size="icon" className="absolute bottom-2 right-2" onClick={(e) => { e.stopPropagation(); handleSpeak(card.answer, answerLang); }} disabled={isSpeaking} aria-label="Speak answer"> <Volume2 className={cn("h-4 w-4", isSpeaking && "animate-pulse")} /> </Button> )}
              </CardContent>
              {/* --- Footer with ORIGINAL rating buttons --- */}
              <CardFooter className="bg-muted/50 border-t flex flex-row items-center justify-around gap-1 p-2 sm:justify-start sm:gap-2 sm:p-3">
                <TooltipProvider>
                  {/* Tooltip 1: Again - EXACT ORIGINAL BUTTON CODE */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="flex-1 justify-center text-xs border-red-500 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 active:scale-95 transition-all duration-150 sm:w-auto sm:justify-start sm:text-sm" onClick={(e) => { e.stopPropagation(); onAnswer(1); }} disabled={isTransitioning || isSpeaking} aria-label="Again - Complete reset (Press 1)">
                        <ThumbsDown className="h-4 w-4 sm:mr-1" />
                        <ThumbsDown className="h-4 w-4 -ml-2 sm:hidden" />
                        <span className="hidden sm:inline">Again</span>
                        <span className="hidden sm:inline ml-1 opacity-50">(1)</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p className="font-medium">Again (1)</p><p className="text-sm text-muted-foreground">Complete reset. Use when you completely forgot or got it wrong.</p></TooltipContent>
                  </Tooltip>
                  {/* Tooltip 2: Hard - **CHANGED ICON** */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="flex-1 justify-center text-xs border-amber-500 text-amber-700 hover:bg-amber-500/10 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 active:scale-95 transition-all duration-150 sm:w-auto sm:justify-start sm:text-sm" onClick={(e) => { e.stopPropagation(); onAnswer(2); }} disabled={isTransitioning || isSpeaking} aria-label="Hard - Remember with significant effort (Press 2)">
                        <ThumbsUp className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Hard</span>
                        <span className="hidden sm:inline ml-1 opacity-50">(2)</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p className="font-medium">Hard (2)</p><p className="text-sm text-muted-foreground">Remembered with significant effort. Review interval will increase slightly.</p></TooltipContent>
                  </Tooltip>
                  {/* Tooltip 3: Fair - **CHANGED LABEL & TOOLTIP** */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="flex-1 justify-center text-xs border-green-500 text-green-700 hover:bg-green-500/10 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 active:scale-95 transition-all duration-150 sm:w-auto sm:justify-start sm:text-sm" onClick={(e) => { e.stopPropagation(); onAnswer(3); }} disabled={isTransitioning || isSpeaking} aria-label="Fair - Remember with some effort (Press 3)">
                        <ThumbsUp className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Fair</span>
                        <span className="hidden sm:inline ml-1 opacity-50">(3)</span>
                      </Button>
                    </TooltipTrigger>
                     <TooltipContent side="bottom"><p className="font-medium">Fair (3)</p><p className="text-sm text-muted-foreground">Remembered with some effort. Normal interval increase.</p></TooltipContent>
                  </Tooltip>
                  {/* Tooltip 4: Easy - EXACT ORIGINAL BUTTON CODE */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" className="flex-1 justify-center text-xs border-blue-500 text-blue-700 hover:bg-blue-500/10 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 active:scale-95 transition-all duration-150 sm:w-auto sm:justify-start sm:text-sm" onClick={(e) => { e.stopPropagation(); onAnswer(4); }} disabled={isTransitioning || isSpeaking} aria-label="Easy - Remember effortlessly (Press 4)">
                        <ThumbsUp className="h-4 w-4 sm:mr-1" />
                        <ThumbsUp className="h-4 w-4 -ml-2 sm:hidden" />
                        <span className="hidden sm:inline">Easy</span>
                        <span className="hidden sm:inline ml-1 opacity-50">(4)</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p className="font-medium">Easy (4)</p><p className="text-sm text-muted-foreground">Remembered effortlessly. Larger interval increase.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardFooter>
              {/* ------------------------------------------------------- */}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}