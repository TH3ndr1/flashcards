"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useDecks } from "@/hooks/use-decks"
import { useRouter } from "next/navigation"
import { useSettings } from "@/hooks/use-settings"
import { useToast } from "@/hooks/use-toast"

interface CreateDeckDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateDeckDialog({ open, onOpenChange }: CreateDeckDialogProps) {
  const [name, setName] = useState("")
  const [isBilingual, setIsBilingual] = useState(false)
  const [questionLanguage, setQuestionLanguage] = useState("")
  const [answerLanguage, setAnswerLanguage] = useState("")
  const [loading, setLoading] = useState(false)
  const { createDeck } = useDecks()
  const { settings } = useSettings()
  const { toast } = useToast()
  const router = useRouter()

  // Set default languages from settings
  useEffect(() => {
    if (settings?.appLanguage) {
      setQuestionLanguage(settings.appLanguage)
      setAnswerLanguage(settings.appLanguage)
    }
  }, [settings])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for your deck",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const newDeck = await createDeck({
        name,
        isBilingual,
        questionLanguage,
        answerLanguage,
      })

      if (!newDeck) {
        throw new Error("Failed to create deck")
      }

      toast({
        title: "Deck created",
        description: "Your new deck has been created successfully.",
      })

      onOpenChange(false)
      router.push(`/edit/${newDeck.id}`)
    } catch (error) {
      console.error("Error creating deck:", error)
      toast({
        title: "Error creating deck",
        description: error instanceof Error ? error.message : "There was a problem creating your deck. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Deck</DialogTitle>
            <DialogDescription>Create a new deck of flashcards to study with.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Biology 101"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bilingual" className="text-right">
                Bilingual Mode
              </Label>
              <div className="flex items-center space-x-2 col-span-3">
                <Switch
                  id="bilingual"
                  checked={isBilingual}
                  onCheckedChange={setIsBilingual}
                />
                <Label htmlFor="bilingual">Enable separate languages for questions and answers</Label>
              </div>
            </div>
            {isBilingual ? (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="questionLanguage" className="text-right">
                    Question Language
                  </Label>
                  <Select value={questionLanguage} onValueChange={setQuestionLanguage}>
                    <SelectTrigger id="questionLanguage" className="col-span-3">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="answerLanguage" className="text-right">
                    Answer Language
                  </Label>
                  <Select value={answerLanguage} onValueChange={setAnswerLanguage}>
                    <SelectTrigger id="answerLanguage" className="col-span-3">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="nl">Dutch</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="language" className="text-right">
                  Language
                </Label>
                <Select 
                  value={questionLanguage} 
                  onValueChange={(value) => {
                    setQuestionLanguage(value)
                    setAnswerLanguage(value)
                  }}
                >
                  <SelectTrigger id="language" className="col-span-3">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="nl">Dutch</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Deck"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

