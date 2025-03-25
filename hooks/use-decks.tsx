"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { Deck } from "@/types/deck"
import { useSupabase } from "@/hooks/use-supabase"
import { useAuth } from "@/hooks/use-auth"
import { useSettings } from "@/hooks/use-settings"

// Create a key for localStorage fallback
const STORAGE_KEY = "studyCards-decks"

interface CreateDeckParams {
  name: string
  isBilingual: boolean
  questionLanguage: string
  answerLanguage: string
}

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

      // Initialize localDecks in the outer scope
      let localDecks: Deck[] = []

      try {
        setLoading(true)

        // Try to get decks from localStorage first during initial load
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

        // Then fetch from Supabase with proper error handling
        console.log("Fetching decks for user:", user.id)
        const { data, error } = await supabase
          .from("decks")
          .select(`
            id,
            name,
            language,
            is_bilingual,
            question_language,
            answer_language,
            progress,
            cards (
              id,
              question,
              answer,
              correct_count,
              incorrect_count,
              last_studied
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Supabase error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          })
          throw new Error(`Error fetching decks: ${JSON.stringify(error)}`)
        }

        if (!data) {
          console.error("No data returned from Supabase")
          throw new Error("No data returned from Supabase")
        }

        // Log the raw data for debugging
        console.log("Raw Supabase response:", data)

        // Transform the data to match our Deck type
        const transformedDecks: Deck[] = data.map((deck) => {
          // Log each deck transformation for debugging
          console.log("Processing deck:", deck)
          
          return {
            id: deck.id,
            name: deck.name,
            language: deck.language || deck.question_language, // Fallback for backward compatibility
            isBilingual: deck.is_bilingual || false,
            questionLanguage: deck.question_language || deck.language, // Fallback for backward compatibility
            answerLanguage: deck.answer_language || deck.language, // Fallback for backward compatibility
            cards: (deck.cards || []).map((card: any) => ({
              id: card.id,
              question: card.question,
              answer: card.answer,
              correctCount: card.correct_count || 0,
              incorrectCount: card.incorrect_count || 0,
              lastStudied: card.last_studied,
            })),
            progress: deck.progress || { correct: 0, total: 0 },
          }
        })

        console.log("Successfully transformed decks:", transformedDecks)
        setDecks(transformedDecks)

        // Update localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(transformedDecks))
        } catch (error) {
          console.error("Error saving to localStorage:", error)
        }
      } catch (error) {
        console.error("Detailed error in loadDecks:", {
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined
        })
        // Keep using local decks if available
        if (localDecks.length > 0) {
          console.log("Using local decks as fallback")
          setDecks(localDecks)
        }
        throw error // Re-throw to ensure error is properly handled by React
      } finally {
        setLoading(false)
      }
    }

    loadDecks()
  }, [user, supabase])

  // Create a new deck
  const createDeck = useCallback(
    async ({ name, isBilingual, questionLanguage, answerLanguage }: CreateDeckParams) => {
      if (!user) throw new Error("User not authenticated")

      try {
        // Create the deck in Supabase
        const { data, error } = await supabase
          .from("decks")
          .insert([{
            name,
            user_id: user.id,
            language: questionLanguage, // For backward compatibility
            is_bilingual: isBilingual,
            question_language: questionLanguage,
            answer_language: answerLanguage,
            progress: { correct: 0, total: 0 },
          }])
          .select(`
            id,
            name,
            language,
            is_bilingual,
            question_language,
            answer_language,
            progress,
            cards (
              id,
              question,
              answer,
              correct_count,
              incorrect_count,
              last_studied
            )
          `)
          .single()

        if (error) {
          console.error("Error creating deck:", error)
          throw error
        }

        if (!data) {
          throw new Error("No data returned from Supabase after creating deck")
        }

        // Transform the data to match our Deck type
        const newDeck: Deck = {
          id: data.id,
          name: data.name,
          language: data.language || data.question_language,
          isBilingual: data.is_bilingual || false,
          questionLanguage: data.question_language || data.language,
          answerLanguage: data.answer_language || data.language,
          cards: [],
          progress: data.progress || { correct: 0, total: 0 },
        }

        // Update local state
        setDecks(prev => [newDeck, ...prev])

        // Update localStorage
        try {
          const currentDecks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
          localStorage.setItem(STORAGE_KEY, JSON.stringify([newDeck, ...currentDecks]))
        } catch (error) {
          console.error("Error updating localStorage:", error)
        }

        return newDeck
      } catch (error) {
        console.error("Error in createDeck:", error)
        throw error
      }
    },
    [user, supabase]
  )

  // Update an existing deck
  const updateDeck = useCallback(
    async (updatedDeck: Deck) => {
      if (!user) {
        throw new Error("User not authenticated")
      }

      try {
        console.log("Starting deck update for:", updatedDeck.id)
        
        // Update the deck record in Supabase
        const { error: deckError } = await supabase
          .from("decks")
          .update({
            name: updatedDeck.name,
            language: updatedDeck.questionLanguage, // Keep for backward compatibility
            is_bilingual: updatedDeck.isBilingual,
            question_language: updatedDeck.questionLanguage,
            answer_language: updatedDeck.answerLanguage,
            progress: updatedDeck.progress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", updatedDeck.id)
          .eq("user_id", user.id)

        if (deckError) {
          console.error("Supabase deck update error details:", {
            message: deckError.message,
            details: deckError.details,
            hint: deckError.hint,
            code: deckError.code
          })
          throw new Error(`Error updating deck: ${JSON.stringify(deckError)}`)
        }

        console.log("Deck updated successfully, now updating cards...")

        // Log the cards being updated
        console.log("Cards to update:", updatedDeck.cards)

        // Update cards
        const { error: cardsError } = await supabase
          .from("cards")
          .upsert(
            updatedDeck.cards.map((card) => ({
              id: card.id,
              deck_id: updatedDeck.id,
              question: card.question,
              answer: card.answer,
              correct_count: card.correctCount,
              incorrect_count: card.incorrectCount,
              last_studied: card.lastStudied,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'id' }
          )

        if (cardsError) {
          console.error("Supabase cards update error details:", {
            message: cardsError.message,
            details: cardsError.details,
            hint: cardsError.hint,
            code: cardsError.code
          })
          throw new Error(`Error updating cards: ${JSON.stringify(cardsError)}`)
        }

        console.log("Cards updated successfully")

        // Update local state
        setDecks((prev) =>
          prev.map((deck) => (deck.id === updatedDeck.id ? updatedDeck : deck))
        )

        // Update localStorage
        try {
          const currentDecks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
          const updatedDecks = currentDecks.map((deck: Deck) =>
            deck.id === updatedDeck.id ? updatedDeck : deck
          )
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDecks))
          console.log("LocalStorage updated successfully")
        } catch (error) {
          console.error("Error updating localStorage:", error)
        }
      } catch (error) {
        console.error("Detailed error in updateDeck:", {
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined
        })
        throw error
      }
    },
    [user, supabase]
  )

  // Get a specific deck by ID
  const getDeck = useCallback(
    async (id: string) => {
      if (!user) return null

      try {
        // Try to get the deck from Supabase first
        console.log("Fetching deck from Supabase:", id)
        const { data, error } = await supabase
          .from("decks")
          .select(`
            id,
            name,
            language,
            is_bilingual,
            question_language,
            answer_language,
            progress,
            cards (
              id,
              question,
              answer,
              correct_count,
              incorrect_count,
              last_studied
            )
          `)
          .eq("id", id)
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

        // Transform the data to match our Deck type
        const fetchedDeck: Deck = {
          id: data.id,
          name: data.name,
          language: data.language || data.question_language,
          isBilingual: data.is_bilingual || false,
          questionLanguage: data.question_language || data.language,
          answerLanguage: data.answer_language || data.language,
          cards: (data.cards || []).map((card: any) => ({
            id: card.id,
            question: card.question,
            answer: card.answer,
            correctCount: card.correct_count || 0,
            incorrectCount: card.incorrect_count || 0,
            lastStudied: card.last_studied,
          })),
          progress: data.progress || { correct: 0, total: 0 },
        }

        // Update local state if needed
        setDecks(prevDecks => {
          const index = prevDecks.findIndex(d => d.id === fetchedDeck.id)
          if (index === -1) {
            return [...prevDecks, fetchedDeck]
          }
          const newDecks = [...prevDecks]
          newDecks[index] = fetchedDeck
          return newDecks
        })

        return fetchedDeck
      } catch (error) {
        console.error("Error in getDeck:", error)
        return null
      }
    },
    [user, supabase]
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

