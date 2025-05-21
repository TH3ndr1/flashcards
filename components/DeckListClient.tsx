// components/DeckListClient.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Edit, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStudySessionStore } from '@/store/studySessionStore';
import type { StudySessionInput, SessionType } from '@/types/study'; // Import types from types/study.ts
// import Link from 'next/link'; // Not used
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DeckProgressBar } from "@/components/deck/DeckProgressBar";
import { useSettings } from "@/providers/settings-provider";
import { Separator } from "@/components/ui/separator";
import { toast } from 'sonner';

// Type for enhanced deck data that includes learn/review counts
interface EnhancedDeck {
  id: string;
  name: string;
  primary_language: string | null;
  secondary_language: string | null;
  is_bilingual: boolean;
  updated_at: string | null;
  new_count: number;
  learning_count: number;
  young_count: number;
  mature_count: number;
  learn_eligible_count: number;
  review_eligible_count: number;
}

interface DeckListClientProps {
  initialData?: EnhancedDeck[];
}

export function DeckListClient({ initialData = [] }: DeckListClientProps) {
  const { settings, loading: settingsLoading } = useSettings();
  const router = useRouter();
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);
  const clearStudyParameters = useStudySessionStore((state) => state.clearStudyParameters);

  const decks = initialData;
  const isLoading = settingsLoading; // Assuming initialData means data loading is handled by parent

  const legendStages = [
    { name: 'New', startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning', startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Relearning', startColor: '#F59E0B', endColor: '#F97316' },
    { name: 'Young', startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature', startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  const handlePracticeDeck = (deckId: string, learnCount: number, reviewCount: number) => {
    if (learnCount === 0 && reviewCount === 0) {
        toast.info("No cards available to practice in this deck right now.");
        return;
    }
    const studyInput: StudySessionInput = { deckId: deckId };
    const sessionTypeForStore: SessionType = 'unified';

    console.log(`[DeckListClient] Starting '${sessionTypeForStore}' session for deck ${deckId}`);
    clearStudyParameters();
    setStudyParameters(studyInput, sessionTypeForStore);
    router.push('/study/session');
  };

  const handleCreateDeckClick = () => {
    router.push('/decks/new');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-12 w-12 rounded-full border-2 border-primary animate-spin border-b-transparent" />
      </div>
    );
  }

  const showDeckProgress = settings?.showDeckProgress ?? true;

  return (
    <TooltipProvider>
      <div className="space-y-6 py-4 px-4 md:p-6">
        <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
          <h2 className="text-2xl font-semibold">Your Decks</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleCreateDeckClick}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Deck
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground mt-10">
              <p>You haven't created any decks yet.</p>
              <Button onClick={handleCreateDeckClick} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Your First Deck
              </Button>
            </div>
          ) : (
            decks.map((deck) => {
              const totalCardsForDisplay = (deck.new_count ?? 0) +
                                 (deck.learning_count ?? 0) +
                                 (deck.young_count ?? 0) +
                                 (deck.mature_count ?? 0);

              let languageDisplay = deck.primary_language || 'N/A';
              if (deck.is_bilingual && deck.secondary_language) {
                  languageDisplay = `${deck.primary_language ?? '?'}/${deck.secondary_language ?? '?'}`;
              }

              const learnEligible = deck.learn_eligible_count ?? 0;
              const reviewEligible = deck.review_eligible_count ?? 0;
              const totalPracticeable = learnEligible + reviewEligible;

              return (
                <Card key={deck.id} className="hover:shadow-md transition-shadow flex flex-col bg-gradient-to-b from-slate-100/40 dark:from-slate-800/40 to-transparent dark:border-slate-700">
                  <CardHeader className="pt-4 pb-2 space-y-1 px-4">
                    <div className="flex justify-between items-center">
                      <CardTitle className="truncate text-lg" title={deck.name}>{deck.name}</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.push(`/edit/${deck.id}`)}
                            className="h-7 w-7 flex-shrink-0 text-muted-foreground"
                            aria-label={`Edit deck ${deck.name}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Edit Deck</p></TooltipContent>
                      </Tooltip>
                    </div>
                    <CardDescription className="text-sm">
                      {totalCardsForDisplay} card{totalCardsForDisplay !== 1 ? 's' : ''} • {languageDisplay}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-center pt-4 px-4 pb-4">
                    <Button
                        onClick={() => handlePracticeDeck(deck.id, learnEligible, reviewEligible)}
                        disabled={totalPracticeable === 0}
                        size="sm"
                        className="w-full bg-primary hover:bg-primary/90"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        Practice {totalPracticeable > 0 ? `(${totalPracticeable})` : ''}
                    </Button>
                  </CardFooter>
                  {showDeckProgress && totalCardsForDisplay > 0 && (
                    <>
                      <Separator />
                      <CardContent className="px-4 pt-4 pb-4 bg-slate-50 dark:bg-slate-700/50 rounded-b-lg">
                        <DeckProgressBar
                          newCount={deck.new_count ?? 0}
                          learningCount={deck.learning_count ?? 0}
                          youngCount={deck.young_count ?? 0}
                          matureCount={deck.mature_count ?? 0}
                        />
                      </CardContent>
                    </>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {showDeckProgress && decks.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 p-2 border rounded-md bg-background shadow-sm">
              {legendStages.map(stage => (
                <span key={stage.name} className="flex items-center gap-1">
                  <span
                    className="h-2 w-3 rounded"
                    style={{ backgroundImage: `linear-gradient(to right, ${stage.startColor}, ${stage.endColor})` }}
                  ></span>
                  {stage.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}