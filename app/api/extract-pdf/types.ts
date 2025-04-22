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

// GeminiFlashcardInput interface (no change)
export interface GeminiFlashcardInput {
    question: string;
    answer: string;
}

// ApiFlashcard interface (no change)
export interface ApiFlashcard {
  question: string;
  answer: string;
  questionLanguage?: string;
  answerLanguage?: string;
  isBilingual?: boolean;
  source?: string;
  fileType?: SupportedFileType;
}

// GeminiStructuredOutput interface (no change)
export interface GeminiStructuredOutput {
    mode: 'translation' | 'knowledge';
    detectedQuestionLanguage: string;
    detectedAnswerLanguage: string;
    flashcards: GeminiFlashcardInput[];
}

// --- FIX: Add limit property to PageLimitExceededError ---
export class PageLimitExceededError extends Error {
    public filename: string;
    public pageCount: number;
    public limit: number; // Add the limit property

    constructor(message: string, filename: string, pageCount: number, limit: number) { // Add limit to constructor
        super(message);
        this.name = 'PageLimitExceededError';
        this.filename = filename;
        this.pageCount = pageCount;
        this.limit = limit; // Assign the limit
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