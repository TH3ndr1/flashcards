"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Deck } from "@/types/deck"
import { useSupabase } from "@/hooks/use-supabase"
import { useAuth } from "@/hooks/use-auth"
import { useSettings } from "@/hooks/use-settings"

// Create a key for localStorage fallback
const STORAGE_KEY = "studyCards-decks"

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const { supabase } = useSupabase()
  const { user } = useAuth()
  const { settings } = useSettings()
  const mounted = useRef(false)

  // Load decks from Supabase or localStorage
  useEffect(() => {
    const loadDecks = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        // Try to get decks from localStorage first during initial load
        let localDecks: Deck[] = []
        try {
          const savedDecks = localStorage.getItem(STORAGE_KEY)
          if (savedDecks) {
            const parsedDecks = JSON.parse(savedDecks)
            if (Array.isArray(parsedDecks)) {
              localDecks = parsedDecks
              setDecks(parsedDecks)
            }
          }
        } catch (error) {
          console.error("Error accessing localStorage:", error)
        }

        // Then fetch from Supabase
        const { data, error } = await supabase
          .from("decks")
          .select(`
            id,
            name,
            language,
            progress,
            created_at,
            updated_at,
            cards(*)
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error fetching decks:", error)
          // If we have local decks, keep using them
          if (localDecks.length > 0) {
            return
          }
          throw error
        }

        if (data) {
          // Transform data from snake_case to camelCase
          const transformedDecks: Deck[] = data.map((deck) => ({
            id: deck.id,
            name: deck.name,
            language: deck.language,
            progress: deck.progress,
            cards: (deck.cards || []).map((card: any) => ({
              id: card.id,
              question: card.question,
              answer: card.answer,
              correctCount: card.correct_count,
              incorrectCount: card.incorrect_count,
              lastStudied: card.last_studied,
            })),
            createdAt: deck.created_at,
            updatedAt: deck.updated_at,
          }))

          setDecks(transformedDecks)

          // Update localStorage with latest data
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(transformedDecks))
          } catch (error) {
            console.error("Error saving to localStorage:", error)
          }
        }
      } catch (error) {
        console.error("Error loading decks:", error)
      } finally {
        setLoading(false)
      }
    }

    // Only load decks if we haven't loaded them before
    if (!mounted.current) {
      loadDecks()
      mounted.current = true
    }

    return () => {
      mounted.current = false
    }
  }, [supabase, user])

  // Save decks to localStorage as a fallback
  useEffect(() => {
    if (!loading && decks.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(decks))
      } catch (error) {
        console.error("Error saving to localStorage:", error)
      }
    }
  }, [decks, loading])

  // Get a specific deck by ID
  const getDeck = useCallback(
    async (id: string) => {
      if (!id || !user) {
        console.error("Invalid deck ID or user not authenticated:", { id, user: !!user })
        return null
      }

      // First try to find the deck in the current state
      const stringId = String(id).trim()
      const foundDeck = decks.find((deck) => String(deck.id).trim() === stringId)

      if (foundDeck) {
        console.log("Found deck in state:", foundDeck)
        return foundDeck
      }

      // If not found in state, try to fetch it from Supabase
      try {
        console.log("Fetching deck from Supabase:", stringId)
        const { data, error } = await supabase
          .from("decks")
          .select(`
            id,
            name,
            language,
            progress,
            created_at,
            updated_at,
            cards(*)
          `)
          .eq("id", stringId)
          .eq("user_id", user.id)
          .single()

        if (error) {
          console.error("Error fetching deck from Supabase:", error)
          return null
        }

        if (!data) {
          console.log("No deck found in Supabase")
          return null
        }

        // Transform the data
        const fetchedDeck: Deck = {
          id: data.id,
          name: data.name,
          language: data.language,
          cards: (data.cards || []).map((card: any) => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            correctCount: card.correct_count,
            incorrectCount: card.incorrect_count,
            lastStudied: card.last_studied,
          })),
          progress: data.progress,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }

        // Add to state if not already there
        setDecks(prevDecks => {
          if (!prevDecks.some(d => d.id === fetchedDeck.id)) {
            return [...prevDecks, fetchedDeck]
          }
          return prevDecks
        })

        console.log("Found deck in Supabase:", fetchedDeck)
        return fetchedDeck
      } catch (error) {
        console.error("Error in getDeck:", error)
        return null
      }
    },
    [decks, supabase, user],
  )

  // Create a new deck
  const createDeck = useCallback(
    async (name: string, language: string) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      // Use app language from settings as default if not specified
      const deckLanguage = language || settings?.appLanguage || "english"

      try {
        // Generate a UUID for the new deck
        const newDeckId = crypto.randomUUID()

        // Create the deck in Supabase first
        const { data, error } = await supabase
          .from("decks")
          .insert([
            {
              id: newDeckId,
              name,
              language: deckLanguage,
              user_id: user.id,
              progress: { correct: 0, total: 0 },
            },
          ])
          .select(`
            id,
            name,
            language,
            progress,
            created_at,
            updated_at,
            cards(*)
          `)
          .single()

        if (error) {
          console.error("Supabase error creating deck:", error)
          throw new Error(`Failed to create deck: ${error.message}`)
        }

        if (!data) {
          throw new Error("No data returned from Supabase after creating deck")
        }

        // Transform the data to match our Deck type
        const newDeck: Deck = {
          id: data.id,
          name: data.name,
          language: data.language,
          cards: (data.cards || []).map((card: any) => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            correctCount: card.correct_count,
            incorrectCount: card.incorrect_count,
            lastStudied: card.last_studied,
          })),
          progress: data.progress,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }

        // Add the new deck to state
        setDecks((prevDecks) => [newDeck, ...prevDecks])

        // Wait for state to update
        await new Promise((resolve) => setTimeout(resolve, 100))

        return newDeck.id
      } catch (error) {
        console.error("Error in createDeck:", error instanceof Error ? error.message : error)
        throw error instanceof Error ? error : new Error("Failed to create deck")
      }
    },
    [supabase, user, settings],
  )

  // Update an existing deck
  const updateDeck = useCallback(
    async (updatedDeck: Deck) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      try {
        // Update the deck in Supabase
        const { error: deckError } = await supabase
          .from("decks")
          .update({
            name: updatedDeck.name,
            language: updatedDeck.language,
            progress: updatedDeck.progress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", updatedDeck.id)
          .eq("user_id", user.id)

        if (deckError) {
          console.error("Error updating deck:", deckError)
          // Continue with local updates even if Supabase fails
        }

        // Handle cards in Supabase
        try {
          // Get existing cards
          const { data: existingCards, error: cardsError } = await supabase
            .from("cards")
            .select("id")
            .eq("deck_id", updatedDeck.id)

          if (!cardsError && existingCards) {
            // Identify cards to create, update, or delete
            const existingCardIds = existingCards.map((c) => c.id)
            const updatedCardIds = updatedDeck.cards.map((c) => c.id)

            // Cards to create (not in existingCardIds)
            const cardsToCreate = updatedDeck.cards.filter((card) => !existingCardIds.includes(card.id))

            // Cards to update (in both arrays)
            const cardsToUpdate = updatedDeck.cards.filter((card) => existingCardIds.includes(card.id))

            // Cards to delete (in existingCardIds but not in updatedCardIds)
            const cardsToDelete = existingCardIds.filter((id) => !updatedCardIds.includes(id))

            // Create new cards
            if (cardsToCreate.length > 0) {
              await supabase.from("cards").insert(
                cardsToCreate.map((card) => ({
                  id: card.id,
                  deck_id: updatedDeck.id,
                  question: card.question,
                  answer: card.answer,
                  correct_count: card.correctCount,
                  incorrect_count: card.incorrectCount,
                  last_studied: card.lastStudied,
                })),
              )
            }

            // Update existing cards
            for (const card of cardsToUpdate) {
              await supabase
                .from("cards")
                .update({
                  question: card.question,
                  answer: card.answer,
                  correct_count: card.correctCount,
                  incorrect_count: card.incorrectCount,
                  last_studied: card.lastStudied,
                })
                .eq("id", card.id)
                .eq("deck_id", updatedDeck.id)
            }

            // Delete removed cards
            if (cardsToDelete.length > 0) {
              await supabase.from("cards").delete().in("id", cardsToDelete).eq("deck_id", updatedDeck.id)
            }
          }
        } catch (error) {
          console.error("Error handling cards in Supabase:", error)
          // Continue with local updates even if Supabase fails
        }

        // Update local state
        setDecks((prevDecks) => prevDecks.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck)))

        // Update localStorage as fallback
        try {
          const savedDecks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
          const updatedDecks = savedDecks.map((deck: Deck) => (deck.id === updatedDeck.id ? updatedDeck : deck))
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks))
        } catch (error) {
          console.error("Error updating localStorage:", error)
        }

        return true
      } catch (error) {
        console.error("Error in updateDeck:", error)
        throw error
      }
    },
    [supabase, user],
  )

  // Delete a deck
  const deleteDeck = useCallback(
    async (id: string) => {
      if (!user || !id) {
        throw new Error("User not authenticated or invalid deck ID")
      }

      try {
        // Delete the deck from Supabase
        const { error } = await supabase.from("decks").delete().eq("id", id).eq("user_id", user.id)

        if (error) {
          console.error("Error deleting deck from Supabase:", error)
          // Continue with local deletion even if Supabase fails
        }

        // Update local state
        setDecks((prevDecks) => prevDecks.filter((deck) => deck.id !== id))

        // Update localStorage as fallback
        try {
          const savedDecks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
          const updatedDecks = savedDecks.filter((deck: Deck) => deck.id !== id)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks))
        } catch (error) {
          console.error("Error updating localStorage:", error)
        }

        return true
      } catch (error) {
        console.error("Error in deleteDeck:", error)
        throw error
      }
    },
    [supabase, user],
  )

  return {
    decks,
    loading,
    getDeck,
    createDeck,
    updateDeck,
    deleteDeck,
  }
}

