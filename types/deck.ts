export interface FlashCard {
  id: string;
  deck_id: string;
  question: string;
  answer: string;
  deckQuestionLanguage?: string | null;
  deckAnswerLanguage?: string | null;
  questionLanguage?: string | null;
  answerLanguage?: string | null;
  correctCount: number;
  incorrectCount: number;
  attemptCount: number;
  last_reviewed_at: Date | string | null;
  next_review_due: Date | string | null;
  srs_level: number;
  easiness_factor: number | null;
  interval_days: number | null;
  stability: number | null;
  difficulty: number | null;
  last_review_grade: number | null;
}

export interface Deck {
  id: string;
  name: string;
  language: string;
  isBilingual: boolean;
  questionLanguage: string;
  answerLanguage: string;
  cards: FlashCard[];
  progress: {
    correct: number;
    total: number;
  };
}

