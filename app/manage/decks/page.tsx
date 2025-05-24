import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, PlusCircle } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDecks } from '@/lib/actions/deckActions';
import { DeckProgressBar } from '@/components/deck/DeckProgressBar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from 'date-fns';

// Type for deck data including SRS counts, similar to EnhancedDeck in DeckListClient
interface ManageDeckItem {
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
  relearning_count: number;
  deck_tags_json?: any; // Added to hold tags, type can be refined
  // learn_eligible_count and review_eligible_count might not be directly needed for manage view
}

export default async function ManageDecksPage() {
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (!session || authError) {
    redirect('/login');
  }

  // The getDecks action is expected to return data compatible with ManageDeckItem[]
  // It calls get_decks_with_complete_srs_counts RPC.
  const { data: decksData, error: fetchError } = await getDecks();
  
  // Explicitly cast or map if the return type of getDecks is not exactly ManageDeckItem[]
  // For now, assuming it's compatible or that getDecks has been updated.
  const decks: ManageDeckItem[] = decksData || [];


  const legendStages = [ 
    { name: 'New', startColor: '#EC4899', endColor: '#EF4444' },
    { name: 'Learning', startColor: '#DA55C6', endColor: '#9353DD' },
    { name: 'Relearning', startColor: '#F59E0B', endColor: '#F97316' },
    { name: 'Young', startColor: '#6055DA', endColor: '#5386DD' },
    { name: 'Mature', startColor: '#55A9DA', endColor: '#53DDDD' },
  ];

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center">
          <Button asChild variant="ghost" size="icon" className="mr-2">
            {/* Consider linking to a main /manage dashboard if it exists */}
            <Link href="/"> 
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Manage Your Decks</h1>
        </div>
        <Button asChild>
          <Link href="/decks/create-choice">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Deck
          </Link>
        </Button>
      </div>

      {fetchError && (
        <div className="text-center text-red-500 dark:text-red-400 p-4 border border-red-500 dark:border-red-400 rounded-md bg-red-50 dark:bg-red-900/30">
          <p>Could not load your decks. Please try again later.</p>
          <p className="text-xs mt-1">{typeof fetchError === 'string' ? fetchError : (fetchError as Error)?.message || 'An unexpected error occurred.'}</p>
        </div>
      )}

      {!fetchError && decks.length === 0 && (
        <div className="text-center text-muted-foreground mt-10">
          <p>You haven't created any decks yet.</p>
          <Button asChild className="mt-4">
            <Link href="/decks/create-choice">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Your First Deck
            </Link>
          </Button>
        </div>
      )}

      {!fetchError && decks.length > 0 && (
        <>
          <div className="space-y-4">
            {decks.map((deck) => {
              const totalCardsForDisplay = (deck.new_count ?? 0) +
                                   (deck.learning_count ?? 0) +
                                   (deck.relearning_count ?? 0) +
                                   (deck.young_count ?? 0) +
                                   (deck.mature_count ?? 0);

              let languageDisplay = deck.primary_language || 'N/A';
              if (deck.is_bilingual && deck.secondary_language) {
                  languageDisplay = `${deck.primary_language ?? '?'}/${deck.secondary_language ?? '?'}`;
              }
              
              let tagsToDisplay: Array<{ id: string; name: string; }> = [];
              if (deck.deck_tags_json && Array.isArray(deck.deck_tags_json)) {
                tagsToDisplay = deck.deck_tags_json.filter(tag => tag && typeof tag.name === 'string');
              }

              return (
                <Link key={deck.id} href={`/edit/${deck.id}`} className="block bg-card border rounded-lg p-4 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 transition-shadow duration-200 group">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-grow md:w-3/5">
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:flex-wrap gap-x-2 gap-y-1">
                        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                          <h3 className="text-lg font-semibold truncate mr-1 group-hover:text-primary transition-colors" title={deck.name}>{deck.name}</h3>
                          {deck.primary_language && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-blue-700 dark:text-blue-100">
                              {deck.primary_language}
                            </span>
                          )}
                          {deck.is_bilingual && deck.secondary_language && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-indigo-700 dark:text-indigo-100">
                              {deck.secondary_language}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1">
                          <Badge variant="secondary" className="whitespace-nowrap self-start sm:self-auto">
                            {totalCardsForDisplay} card{totalCardsForDisplay !== 1 ? 's' : ''}
                          </Badge>
                          <div className="flex flex-wrap gap-1.5 items-baseline">
                            {tagsToDisplay.map(tag => (
                              <span key={tag.id || tag.name} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap dark:bg-slate-700 dark:text-slate-100">
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-2/5 mt-3 md:mt-0">
                      {totalCardsForDisplay > 0 ? (
                        <>
                          <DeckProgressBar
                            newCount={deck.new_count ?? 0}
                            learningCount={deck.learning_count ?? 0}
                            relearningCount={deck.relearning_count ?? 0}
                            youngCount={deck.young_count ?? 0}
                            matureCount={deck.mature_count ?? 0}
                          />
                          <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 justify-center md:justify-start">
                            {(deck.new_count ?? 0) > 0 && (
                              <span className="flex items-center">
                                <span className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: legendStages.find(s => s.name === 'New')?.endColor }}></span>
                                New: {deck.new_count}
                              </span>
                            )}
                            {(deck.learning_count ?? 0) > 0 && (
                              <span className="flex items-center">
                                <span className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: legendStages.find(s => s.name === 'Learning')?.endColor }}></span>
                                Learning: {deck.learning_count}
                              </span>
                            )}
                            {(deck.relearning_count ?? 0) > 0 && (
                              <span className="flex items-center">
                                <span className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: legendStages.find(s => s.name === 'Relearning')?.endColor }}></span>
                                Relearning: {deck.relearning_count}
                              </span>
                            )}
                            {(deck.young_count ?? 0) > 0 && (
                              <span className="flex items-center">
                                <span className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: legendStages.find(s => s.name === 'Young')?.endColor }}></span>
                                Young: {deck.young_count}
                              </span>
                            )}
                            {(deck.mature_count ?? 0) > 0 && (
                              <span className="flex items-center">
                                <span className="h-2 w-2 rounded-full mr-1.5" style={{ backgroundColor: legendStages.find(s => s.name === 'Mature')?.endColor }}></span>
                                Mature: {deck.mature_count}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-2 md:py-0">Deck is empty</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          
          {decks.some(d => (d.new_count + d.learning_count + d.relearning_count + d.young_count + d.mature_count) > 0) && (
            <div className="mt-8 flex justify-center sm:justify-end">
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 p-2 border rounded-md bg-background shadow-sm">
                {legendStages.map(stage => (
                  <span key={stage.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundImage: `linear-gradient(to right, ${stage.startColor}, ${stage.endColor})` }}
                    ></span>
                    {stage.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 