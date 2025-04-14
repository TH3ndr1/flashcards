"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Play, List, Pencil, GraduationCap } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { useDecks } from "@/hooks/use-decks"
import { useRouter } from "next/navigation"
import { useSettings } from "@/providers/settings-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { useStudySessionStore, StudyInput } from "@/store/studySessionStore"
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function DeckList() {
  const { decks, loading } = useDecks()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const router = useRouter()
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters)
  const clearStudyParameters = useStudySessionStore((state) => state.clearStudyParameters)
  const { settings } = useSettings()

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden)
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      setIsVisible(!document.hidden)
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [])

  const handleEditDeck = (deckId: string) => {
    router.push(`/edit/${deckId}`)
  }

  const handleStudy = (deckId: string, mode: 'learn' | 'review') => {
    console.log(`[DeckList] Starting session for Deck ID: ${deckId}, Mode: ${mode}`);
    const actionInput: StudyInput = { criteria: { deckId: deckId } };
    
    clearStudyParameters();
    
    setStudyParameters(actionInput, mode);
    router.push('/study/session');
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div 
          className={`h-12 w-12 rounded-full border-2 border-primary ${isVisible ? 'animate-spin border-b-transparent' : ''}`}
          style={{ 
            animation: isVisible ? 'spin 1s linear infinite' : 'none',
            borderBottomColor: 'transparent' 
          }}
        />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-2xl font-semibold">Your Decks</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => setIsCreateOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Deck
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={`skel-${i}`}><CardHeader><div className="h-5 w-3/4 bg-muted rounded animate-pulse"/></CardHeader><CardContent><div className="h-4 w-full bg-muted rounded animate-pulse"/></CardContent><CardFooter className="flex justify-between"><div className="h-8 w-16 bg-muted rounded animate-pulse"/><div className="h-8 w-16 bg-muted rounded animate-pulse"/></CardFooter></Card>
            ))
          ) : decks.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground mt-10">
              <p>You haven't created any decks yet.</p>
              <Button onClick={() => setIsCreateOpen(true)} className="mt-4">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Your First Deck
              </Button>
            </div>
          ) : (
            decks.map((deck) => {
              const totalCards = deck.card_count ?? 0;
              let languageDisplay = deck.primary_language || 'Lang not set';
              if (deck.is_bilingual && deck.secondary_language) {
                  languageDisplay = `${deck.primary_language ?? '?'} / ${deck.secondary_language ?? '?'}`;
              }

              return (
                <Card key={deck.id} className="hover:shadow-md transition-shadow flex flex-col">
                  <CardHeader className="pt-4 pb-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <CardTitle className="truncate mr-2" title={deck.name}>{deck.name}</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleEditDeck(deck.id)}
                            className="h-7 w-7 flex-shrink-0"
                            aria-label="Edit Deck"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Deck</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <CardDescription>
                      {totalCards} card{totalCards !== 1 ? 's' : ''} • {languageDisplay}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex justify-center mt-auto pt-4">
                    <div className="flex gap-3">
                      <Button 
                        onClick={() => handleStudy(deck.id, 'learn')} 
                        aria-label={`Learn ${deck.name}`}
                        className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm bg-gradient-to-br from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white"
                      >
                        <GraduationCap className="h-4 w-4 mr-1" /> Learn
                      </Button>
                      <Button 
                        onClick={() => handleStudy(deck.id, 'review')} 
                        aria-label={`Review ${deck.name}`}
                        className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm bg-gradient-to-br from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 text-white"
                      >
                        <Play className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              )
            })
          )}
        </div>

        <CreateDeckDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      </div>
    </TooltipProvider>
  )
}

