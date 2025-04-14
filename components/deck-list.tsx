"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle, Play, List } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { useDecks } from "@/hooks/use-decks"
import { useRouter } from "next/navigation"
import { useSettings } from "@/providers/settings-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"
import { useStudySessionStore, StudyInput } from "@/store/studySessionStore"
import Link from 'next/link'

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
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-semibold">Your Decks</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" asChild>
            <Link href="/study/select">
              <Play className="mr-2 h-4 w-4" /> Start Studying
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/study/sets">
              <List className="mr-2 h-4 w-4" /> Smart Playlists
            </Link>
          </Button>
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
                <CardHeader>
                  <CardTitle className="truncate" title={deck.name}>{deck.name}</CardTitle>
                  <CardDescription>
                    {totalCards} card{totalCards !== 1 ? 's' : ''} • {languageDisplay}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between mt-auto pt-4">
                  <Button variant="outline" size="sm" onClick={() => handleEditDeck(deck.id)}>
                    Edit
                  </Button>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="secondary"
                      onClick={() => handleStudy(deck.id, 'learn')} 
                      aria-label={`Learn ${deck.name}`}
                    >
                      <Play className="h-4 w-4 mr-1" /> Learn
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleStudy(deck.id, 'review')} 
                      aria-label={`Review ${deck.name}`}
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
  )
}

