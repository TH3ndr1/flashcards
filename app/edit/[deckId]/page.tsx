"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { CardEditor } from "@/components/card-editor"
import { TableEditor } from "@/components/table-editor"
import { useDecks } from "@/hooks/use-decks"
import type { Deck } from "@/types/deck"
import { useToast } from "@/hooks/use-toast"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

export default function EditDeckPage() {
  const params = useParams<{ deckId: string }>()
  const deckId = params?.deckId
  const router = useRouter()
  const { getDeck, updateDeck, deleteDeck } = useDecks()
  const { toast } = useToast()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [activeTab, setActiveTab] = useState("cards")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const loadDeck = async () => {
      try {
        if (!deckId) {
          console.error("No deck ID provided")
          setError("No deck ID provided")
          router.push("/")
          return
        }

        console.log("Loading deck with ID:", deckId)
        setLoading(true)
        setError(null)

        const loadedDeck = await getDeck(deckId)

        if (!loadedDeck) {
          console.error("Deck not found:", deckId)
          setError("Deck not found")
          return
        }

        setDeck(loadedDeck)
        setError(null)
      } catch (error) {
        console.error("Error loading deck:", error)
        setError(`Error loading deck: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setLoading(false)
      }
    }

    loadDeck()
  }, [deckId, getDeck, router])

  const handleNameChange = (newName: string) => {
    if (!deck) return
    setDeck({
      ...deck,
      name: newName
    })
  }

  const handleSave = async () => {
    if (!deck) return

    try {
      setSaving(true)
      await updateDeck(deck)

      toast({
        title: "Changes saved",
        description: "Your deck has been updated successfully.",
      })

      // Navigate back to home page after saving
      router.push("/")
    } catch (error) {
      console.error("Error saving deck:", error)
      toast({
        title: "Error saving changes",
        description: "There was a problem saving your changes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deck) return

    if (confirm("Are you sure you want to delete this deck? This action cannot be undone.")) {
      try {
        await deleteDeck(deck.id)

        toast({
          title: "Deck deleted",
          description: "Your deck has been deleted successfully.",
        })

        router.push("/")
      } catch (error) {
        console.error("Error deleting deck:", error)
        toast({
          title: "Error deleting deck",
          description: "There was a problem deleting your deck. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  const handleAddCard = () => {
    if (deck) {
      const newCard = {
        id: crypto.randomUUID(),
        question: "",
        answer: "",
        correctCount: 0,
        incorrectCount: 0,
        lastStudied: null,
      }

      setDeck({
        ...deck,
        cards: [...deck.cards, newCard],
      })
    }
  }

  const handleUpdateCard = (cardId: string, question: string, answer: string) => {
    if (deck) {
      setDeck({
        ...deck,
        cards: deck.cards.map((card) => (card.id === cardId ? { ...card, question, answer } : card)),
      })
    }
  }

  const handleDeleteCard = (cardId: string) => {
    if (deck) {
      setDeck({
        ...deck,
        cards: deck.cards.filter((card) => card.id !== cardId),
      })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center">
          <h2 className="text-xl font-semibold text-red-500 mb-4">Error Loading Deck</h2>
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
          <p className="text-muted-foreground mb-6">The deck you're looking for doesn't exist or couldn't be loaded.</p>
          <Button onClick={() => router.push("/")}>Return to Home</Button>
        </div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/" className="mr-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Input
            value={deck.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="text-2xl font-bold h-auto py-1 px-2 w-[300px]"
            placeholder="Deck name"
          />
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Deck
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-medium">Bilingual Mode</h3>
            <p className="text-sm text-muted-foreground">
              Enable to use different languages for questions and answers
            </p>
          </div>
          <Switch
            checked={deck.isBilingual}
            onCheckedChange={(checked) =>
              setDeck((prev) => prev ? {
                ...prev,
                isBilingual: checked,
                // When switching to monolingual, use question language for both
                language: checked ? prev.questionLanguage : prev.questionLanguage,
                questionLanguage: prev.questionLanguage,
                answerLanguage: checked ? prev.answerLanguage : prev.questionLanguage,
              } : null)
            }
          />
        </div>

        {deck.isBilingual ? (
          <div className="grid gap-4 p-4 border rounded-lg">
            <div>
              <Label htmlFor="questionLanguage">Question Language</Label>
              <Select
                value={deck.questionLanguage}
                onValueChange={(value) =>
                  setDeck((prev) => prev ? {
                    ...prev,
                    questionLanguage: value,
                    language: value, // Update legacy language field
                  } : null)
                }
              >
                <SelectTrigger id="questionLanguage">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="nl">Dutch</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="it">Italian</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="answerLanguage">Answer Language</Label>
              <Select
                value={deck.answerLanguage}
                onValueChange={(value) =>
                  setDeck((prev) => prev ? {
                    ...prev,
                    answerLanguage: value,
                  } : null)
                }
              >
                <SelectTrigger id="answerLanguage">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="nl">Dutch</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="it">Italian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="p-4 border rounded-lg">
            <Label htmlFor="language">Language</Label>
            <Select
              value={deck.questionLanguage}
              onValueChange={(value) =>
                setDeck((prev) => prev ? {
                  ...prev,
                  language: value,
                  questionLanguage: value,
                  answerLanguage: value,
                } : null)
              }
            >
              <SelectTrigger id="language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="nl">Dutch</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cards">Card View</TabsTrigger>
          <TabsTrigger value="table">Table View</TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="mt-6">
          <div className="flex justify-end mb-4">
            <Button onClick={handleAddCard}>
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          </div>
          {deck.cards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-6 h-40">
                <p className="text-muted-foreground text-center mb-4">No cards in this deck yet</p>
                <Button onClick={handleAddCard}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {deck.cards.map((card) => (
                <CardEditor
                  key={card.id}
                  card={card}
                  onUpdate={(question, answer) => handleUpdateCard(card.id, question, answer)}
                  onDelete={() => handleDeleteCard(card.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="table" className="mt-6">
          <TableEditor
            cards={deck.cards}
            onUpdate={handleUpdateCard}
            onDelete={handleDeleteCard}
            onAdd={handleAddCard}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}

