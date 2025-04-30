// app/api/extract-pdf/types.ts
/**
 * TypeScript interfaces specific to the data flow within the extract-pdf API feature.
 */

import { SupportedFileType } from './fileUtils';

// SkippedFile interface (no change)
export interface SkippedFile {
  filename: string;
  pages?: number;
  reason: string;
  code?: string;
}

// ExtractionResult interface (no change)
export interface ExtractionResult {
  text: string;
  info: {
    pages: number;
    metadata: {
      source: string;
      characters: number;
      detectedLanguages?: string[];
      note?: string;
    }
  }
}

// --- UPDATED: GeminiFlashcardInput to include classification ---
// This reflects the structure EXPECTED FROM Gemini now
export interface GeminiFlashcardInput {
    question: string;
    answer: string;
    questionPartOfSpeech: string;
    questionGender: string;
    answerPartOfSpeech: string;
    answerGender: string;
}

// --- UPDATED: ApiFlashcard interface to include classification ---
// This reflects the structure RETURNED BY the /api/extract-pdf route
export interface ApiFlashcard {
  question: string;
  answer: string;
  questionLanguage?: string; // Language detected for the whole batch
  answerLanguage?: string;   // Language detected for the whole batch
  isBilingual?: boolean;     // Mode determined for the whole batch
  // --- NEW Classification Fields ---
  questionPartOfSpeech: string; // Classification specific to this card
  questionGender: string;       // Classification specific to this card
  answerPartOfSpeech: string;   // Classification specific to this card
  answerGender: string;         // Classification specific to this card
  // --- End of NEW Fields ---
  source?: string;           // Added by route.ts (filename)
  fileType?: SupportedFileType; // Added by route.ts
}

// --- UPDATED: GeminiStructuredOutput to expect richer flashcards ---
// This reflects the overall JSON structure EXPECTED FROM Gemini now
export interface GeminiStructuredOutput {
    mode: 'translation' | 'knowledge';
    detectedQuestionLanguage: string;
    detectedAnswerLanguage: string;
    flashcards: GeminiFlashcardInput[]; // Should now contain the classification fields
}

// PageLimitExceededError class (no change needed based on previous code)
export class PageLimitExceededError extends Error {
    public filename: string;
    public pageCount: number;
    public limit: number;

    constructor(message: string, filename: string, pageCount: number, limit: number) {
        super(message);
        this.name = 'PageLimitExceededError';
        this.filename = filename;
        this.pageCount = pageCount;
        this.limit = limit;
    }
}

// ExtractionApiError class (no change)
export class ExtractionApiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExtractionApiError';
    }
}

// GenerationApiError class (no change)
export class GenerationApiError extends Error {
    public reason?: string;
    constructor(message: string, reason?: string) {
        super(message);
        this.name = 'GenerationApiError';
        this.reason = reason;
    }
}