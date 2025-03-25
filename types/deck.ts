export interface FlashCard {
  id: string
  question: string
  answer: string
  correctCount: number
  incorrectCount: number
  lastStudied: string | null
}

export interface Deck {
  id: string
  name: string
  language: string // Kept for backward compatibility
  isBilingual: boolean
  questionLanguage: string
  answerLanguage: string
  cards: FlashCard[]
  progress: {
    correct: number
    total: number
  }
}

