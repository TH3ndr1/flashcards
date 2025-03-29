"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PlusCircle } from "lucide-react"
import { CreateDeckDialog } from "@/components/create-deck-dialog"
import { useDecks } from "@/hooks/use-decks"
import { useRouter } from "next/navigation"
import { useSettings } from "@/hooks/use-settings"
import {
  calculateMasteredCount,
  DEFAULT_MASTERY_THRESHOLD,
} from "@/lib/study-utils";

export function DeckList() {
  const { decks, loading } = useDecks()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const router = useRouter()
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

  const handleStudyDeck = (deckId: string) => {
    router.push(`/study/${deckId}`)
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Your Decks</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Deck
        </Button>
      </div>

      {decks.length === 0 ? (
        <Card className="border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent
            className="flex flex-col items-center justify-center p-6 h-40"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">Create your first deck to start studying</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => {
            const totalCards = deck.cards.length;
            const threshold = settings?.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
            const masteredCount = calculateMasteredCount(deck.cards, settings);
            const masteryProgressPercent = totalCards > 0 
                ? Math.round((masteredCount / totalCards) * 100) 
                : 0;

            return (
              <Card key={deck.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>{deck.name}</CardTitle>
                  <CardDescription>
                    {totalCards} cards • {deck.language}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                      style={{
                        width: `${masteryProgressPercent}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {masteredCount} of {totalCards} cards mastered
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => handleEditDeck(deck.id)}>
                    Edit
                  </Button>
                  <Button onClick={() => handleStudyDeck(deck.id)}>Study</Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      <CreateDeckDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  )
}

