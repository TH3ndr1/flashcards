"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { ArrowLeft, Check, X, RotateCcw, Info } from "lucide-react"
import Link from "next/link"
import { useDecks } from "@/hooks/use-decks"
import type { Deck, FlashCard } from "@/types/deck"
import { useTTS } from "@/hooks/use-tts"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useSettings } from "@/hooks/use-settings"
import { useToast } from "@/hooks/use-toast"

const MASTERY_THRESHOLD = 3
const TTS_DELAY = 100 // delay in ms to ensure TTS language is set
const RETRY_DELAY = 500 // delay between deck load retries
const MAX_RETRIES = 5

export default function StudyDeckPage() {
  const { deckId } = useParams<{ deckId: string }>()
  const router = useRouter()
  const { getDeck, updateDeck } = useDecks()
  const { settings } = useSettings()
  const { toast } = useToast()
  const { speak, setLanguage } = useTTS()

  const [deck, setDeck] = useState<Deck | null>(null)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [studyCards, setStudyCards] = useState<FlashCard[]>([])
  const [masteredCount, setMasteredCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [languageSet, setLanguageSet] = useState(false)

  // useRef for retry count so that re-renders do not reset it
  const retryCountRef = useRef(0)

  // Set language when deck loads; use a delay to ensure proper TTS initialization
  useEffect(() => {
    if (!deck) return
    setLanguageSet(false)
    setLanguage(deck.language)
    const timeoutId = setTimeout(() => setLanguageSet(true), TTS_DELAY)
    return () => clearTimeout(timeoutId)
  }, [deck, setLanguage])

  // Speak question after language is set, card is loaded, and card is not flipped
  useEffect(() => {
    if (!languageSet || !deck || !studyCards.length || isFlipped || loading)
      return

    const currentCard = studyCards[currentCardIndex]
    if (currentCard?.question) {
      const timeoutId = setTimeout(() => {
        // Double-check state to avoid race conditions
        if (
          currentCard === studyCards[currentCardIndex] &&
          !isFlipped &&
          languageSet
        ) {
          console.log("Speaking question in", deck.language, ":", currentCard.question)
          speak(currentCard.question)
        }
      }, TTS_DELAY)
      return () => clearTimeout(timeoutId)
    }
  }, [currentCardIndex, languageSet, studyCards, deck, isFlipped, loading, speak])

  // Reset language flag when deck changes
  useEffect(() => {
    if (deck?.id) {
      setLanguageSet(false)
    }
  }, [deck?.id])

  // Load deck and set up study cards with weighted randomization.
  useEffect(() => {
    let mounted = true

    const loadDeck = async () => {
      if (!deckId) {
        setError("No deck ID provided")
        setLoading(false)
        return
      }

      console.log("Loading deck with ID:", deckId)
      try {
        const loadedDeck = await getDeck(deckId)
        if (!mounted) return

        if (!loadedDeck) {
          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current++
            console.log(`Retrying (${retryCountRef.current}/${MAX_RETRIES})...`)
            setTimeout(loadDeck, RETRY_DELAY)
            return
          }
          setError(`Deck not found: ${deckId}`)
          setLoading(false)
          return
        }

        if (!Array.isArray(loadedDeck.cards)) {
          console.error("Invalid deck data: cards is not an array", loadedDeck)
          setError("Invalid deck data: cards is not an array")
          setLoading(false)
          return
        }

        setDeck(loadedDeck)

        // Count mastered cards
        const mastered = loadedDeck.cards.filter(
          (card) => card && card.correctCount >= MASTERY_THRESHOLD
        ).length
        setMasteredCount(mastered)

        // Prepare cards for study (exclude mastered cards)
        const availableCards = loadedDeck.cards.filter(
          (card) => card && card.correctCount < MASTERY_THRESHOLD
        )
        if (availableCards.length > 0) {
          // Weight cards so that those with more errors have a higher chance
          const weightedCards = availableCards.map((card) => {
            const correctRatio =
              (card.correctCount || 0) /
              ((card.correctCount || 0) + (card.incorrectCount || 0) + 1)
            return {
              card,
              weight: 1 - correctRatio,
            }
          })
          // Sort by weight (descending) with randomization for similar weights
          weightedCards.sort((a, b) => {
            const weightDiff = b.weight - a.weight
            if (Math.abs(weightDiff) < 0.2) {
              return Math.random() - 0.5
            }
            return weightDiff
          })
          setStudyCards(weightedCards.map((wc) => wc.card))
        } else {
          setStudyCards([])
        }

        setLoading(false)
      } catch (error) {
        console.error("Error loading deck:", error)
        if (mounted) {
          setError(`Error loading deck: ${
            error instanceof Error ? error.message : String(error)
          }`)
          setLoading(false)
        }
      }
    }

    loadDeck()
    return () => {
      mounted = false
    }
  }, [deckId, getDeck])

  // Memoized handler for flipping the card.
  const handleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev)
    if (!isFlipped && studyCards.length > 0 && languageSet) {
      const currentCard = studyCards[currentCardIndex]
      if (currentCard?.answer) {
        setTimeout(() => {
          if (currentCard === studyCards[currentCardIndex] && languageSet) {
            console.log("Speaking answer in", deck?.language, ":", currentCard.answer)
            speak(currentCard.answer)
          }
        }, TTS_DELAY)
      }
    }
  }, [isFlipped, studyCards, currentCardIndex, languageSet, speak, deck])

  // Memoized handler for answering a card.
  const handleAnswer = useCallback(
    async (correct: boolean) => {
      if (!deck || !studyCards.length) return
  
      const updatedCards = [...deck.cards]
      const currentCard = studyCards[currentCardIndex]
      if (!currentCard) return
  
      const cardIndex = updatedCards.findIndex((c) => c.id === currentCard.id)
      if (cardIndex !== -1) {
        const newCorrectCount = correct
          ? (updatedCards[cardIndex].correctCount || 0) + 1
          : updatedCards[cardIndex].correctCount || 0
  
        updatedCards[cardIndex] = {
          ...updatedCards[cardIndex],
          correctCount: newCorrectCount,
          incorrectCount: !correct
            ? (updatedCards[cardIndex].incorrectCount || 0) + 1
            : updatedCards[cardIndex].incorrectCount || 0,
          lastStudied: new Date().toISOString(),
        }
  
        const previouslyNotMastered =
          (updatedCards[cardIndex].correctCount || 0) < MASTERY_THRESHOLD
        if (newCorrectCount >= MASTERY_THRESHOLD && previouslyNotMastered) {
          setMasteredCount((prev) => prev + 1)
        }
      }
  
      // Update deck progress
      const correctCards = updatedCards.filter(
        (card) => card && card.correctCount >= MASTERY_THRESHOLD
      ).length
  
      const updatedDeck = {
        ...deck,
        cards: updatedCards,
        progress: {
          ...deck.progress,
          correct: correctCards,
        },
      }
  
      setDeck(updatedDeck)
  
      // Measure the duration of the asynchronous update
      const asyncStartTime = Date.now()
      try {
        await updateDeck(updatedDeck)
        const asyncEndTime = Date.now()
        console.log(
          `handleAnswer: updateDeck took ${(asyncEndTime - asyncStartTime) / 1000} seconds`
        )
      } catch (error) {
        console.error("Error updating deck:", error)
        toast({
          title: "Error saving progress",
          description: "There was a problem saving your progress.",
          variant: "destructive",
        })
      }
  
      // Update study cards based on mastery
      if (
        cardIndex !== -1 &&
        updatedCards[cardIndex].correctCount >= MASTERY_THRESHOLD
      ) {
        const updatedStudyCards = [...studyCards]
        updatedStudyCards.splice(currentCardIndex, 1)
        setStudyCards(updatedStudyCards)
        if (updatedStudyCards.length === 0) {
          setIsFlipped(false)
          return
        }
        if (currentCardIndex >= updatedStudyCards.length) {
          setCurrentCardIndex(0)
        }
      } else {
        setCurrentCardIndex((prev) =>
          prev < studyCards.length - 1 ? prev + 1 : 0
        )
      }
  
      setIsFlipped(false)
    },
    [deck, studyCards, currentCardIndex, updateDeck, toast]
  )



  // Memoized handler for resetting progress.
  const handleResetProgress = useCallback(async () => {
    if (!deck) return
    // Consider replacing confirm() with a custom modal for improved UX.
    if (confirm("Are you sure you want to reset your progress for this deck?")) {
      const updatedCards = deck.cards.map((card) => ({
        ...card,
        correctCount: 0,
        incorrectCount: 0,
        lastStudied: null,
      }))
      const updatedDeck = {
        ...deck,
        cards: updatedCards,
        progress: {
          ...deck.progress,
          correct: 0,
        },
      }
      try {
        await updateDeck(updatedDeck)
        setDeck(updatedDeck)
        setCurrentCardIndex(0)
        setIsFlipped(false)
        setMasteredCount(0)
        // All cards are now available for study.
        setStudyCards(updatedCards)
        toast({
          title: "Progress reset",
          description: "Your progress has been reset successfully.",
        })
      } catch (error) {
        console.error("Error resetting progress:", error)
        toast({
          title: "Error resetting progress",
          description: "There was a problem resetting your progress.",
          variant: "destructive",
        })
      }
    }
  }, [deck, updateDeck, toast])

  // Conditional rendering for loading, error, or empty deck states.
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error && !deck) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-xl font-semibold text-red-500 mb-4">
            Error Loading Deck
          </h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push("/")}>Return to Home</Button>
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-xl font-semibold mb-4">Deck Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The deck you're looking for doesn't exist or couldn't be loaded.
          </p>
          <Button onClick={() => router.push("/")}>Return to Home</Button>
        </div>
      </div>
    )
  }

  if (deck.cards.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{deck.name}</h1>
        </div>
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center p-6 py-10">
            <p className="text-muted-foreground text-center mb-4">
              This deck doesn't have any cards yet
            </p>
            <Link href={`/edit/${deckId}`} passHref>
              <Button>Add Cards to Start Studying</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (studyCards.length === 0) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Link href="/" className="mr-4">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{deck.name}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetProgress}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Progress
          </Button>
        </div>
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium">100%</span>
          </div>
          <Progress value={100} className="h-2" />
        </div>
        <Card className="max-w-md mx-auto">
          <CardContent className="flex flex-col items-center justify-center p-6 py-10">
            <h2 className="text-xl font-semibold mb-2">Congratulations! 🎉</h2>
            <p className="text-muted-foreground text-center mb-6">
              You've mastered all the cards in this deck. You can reset your progress
              to study again or return to the home screen.
            </p>
            <div className="flex space-x-4">
              <Button variant="outline" onClick={handleResetProgress}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Progress
              </Button>
              <Link href="/" passHref>
                <Button>Return Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  const currentCard = studyCards[currentCardIndex]
  const progress = deck.cards.length > 0 ? (masteredCount / deck.cards.length) * 100 : 0

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{deck.name}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Cards are mastered after {MASTERY_THRESHOLD} correct answers
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" size="sm" onClick={handleResetProgress}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Progress
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">
            Progress: {masteredCount} of {deck.cards.length} cards mastered
          </span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      <div className="max-w-2xl mx-auto">
        <div
          className={`flip-card ${isFlipped ? "flipped" : ""} w-full h-80 cursor-pointer`}
          onClick={handleFlip}
        >
          <div className="flip-card-inner relative w-full h-full">
            <div className="flip-card-front absolute w-full h-full">
              <Card className="w-full h-full flex flex-col">
                <CardHeader className="text-center text-sm text-muted-foreground">
                  Card {currentCardIndex + 1} of {studyCards.length} •{" "}
                  {studyCards.length} remaining to master
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center p-6">
                  <p className="text-xl text-center">{currentCard.question}</p>
                </CardContent>
                <CardFooter className="justify-center text-sm text-muted-foreground">
                  Click to reveal answer
                </CardFooter>
              </Card>
            </div>
            <div className="flip-card-back absolute w-full h-full">
              <Card className="w-full h-full flex flex-col">
                <CardHeader className="text-center text-sm text-muted-foreground">
                  Answer
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center p-6">
                  <p className="text-xl text-center">{currentCard.answer}</p>
                </CardContent>
                <CardFooter className="justify-center space-x-4">
                  <Button
                    variant="outline"
                    className="border-red-500 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAnswer(false)
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Incorrect
                  </Button>
                  <Button
                    variant="outline"
                    className="border-green-500 hover:bg-green-500/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAnswer(true)
                    }}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Correct
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}