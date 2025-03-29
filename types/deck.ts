export interface FlashCard {
  id: string
  question: string
  answer: string
  correctCount: number
  incorrectCount: number
  lastStudied: Date | null
  attemptCount: number // Total number of attempts
  difficultyScore: number // Calculated difficulty score
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
    studyingDifficult?: boolean // Optional flag to indicate if we're studying difficult cards
  }
}

