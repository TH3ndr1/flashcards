// app/api/stories/storyGeneratorService.ts
/**
 * Service responsible for generating stories from flashcard decks using Google Vertex AI (Gemini).
 * Mirrors the pattern from app/api/extract-pdf/flashcardGeneratorService.ts.
 */
import {
  HarmCategory,
  HarmBlockThreshold,
  Schema,
  SchemaType,
  GenerationConfig,
  SafetySetting,
} from '@google-cloud/vertexai';
import { vertexAI } from '../extract-pdf/gcpClients';
import { VERTEX_MODEL_NAME } from '../extract-pdf/config';
import { GenerationApiError } from '../extract-pdf/types';
import { appLogger } from '@/lib/logger';
import type { StoryParagraph, StoryMode, ReadingTimeMin } from '@/types/story';

// --- Input/Output Types ---

export interface StoryGenerationInput {
  cards: { question: string; answer: string }[];
  mode: StoryMode;
  primaryLanguage: string;   // e.g. 'English', 'French'
  secondaryLanguage: string; // e.g. 'Dutch' — same as primary for knowledge mode
  age: number;
  readingTimeMin: ReadingTimeMin;
}

interface StoryOutput {
  paragraphs: StoryParagraph[];
}

// --- Vertex AI Schema ---

const storySchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    paragraphs: {
      type: SchemaType.ARRAY,
      description: 'Array of story paragraphs.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          primary: {
            type: SchemaType.STRING,
            description: 'The main paragraph text.',
          },
          secondary: {
            type: SchemaType.STRING,
            description: 'Translation or empty string.',
          },
        },
        required: ['primary', 'secondary'],
      },
    },
  },
  required: ['paragraphs'],
};

// --- Safety & Generation Config ---

const safetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const generationConfig: GenerationConfig = {
  responseMimeType: 'application/json',
  responseSchema: storySchema,
};

// --- Internal helpers (mirrors flashcardGeneratorService pattern) ---

function parseJsonResponse(jsonString: string, stepName: string): StoryOutput {
  try {
    return JSON.parse(jsonString) as StoryOutput;
  } catch (parseError: unknown) {
    const msg = parseError instanceof Error ? parseError.message : String(parseError);
    appLogger.error(`[Story Generator] Error parsing JSON in ${stepName}:`, msg);
    throw new GenerationApiError(`Failed to parse ${stepName} JSON response: ${msg}`);
  }
}

async function callVertexAI(prompt: string, stepName: string): Promise<StoryOutput> {
  if (!vertexAI) {
    throw new GenerationApiError('Vertex AI client is not initialized.');
  }

  appLogger.info(`[Story Generator] ${stepName}: Sending prompt. Length: ${prompt.length}`);

  const model = vertexAI.getGenerativeModel({
    model: VERTEX_MODEL_NAME,
    safetySettings,
    generationConfig,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const response = result.response;
  const candidate = response?.candidates?.[0];

  if (!candidate?.content?.parts?.[0]) {
    const finishReason = candidate?.finishReason;
    throw new GenerationApiError(
      `${stepName}: Empty or blocked response from AI. Finish reason: ${finishReason}`
    );
  }

  const part = candidate.content.parts[0];
  if (typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
    return parseJsonResponse(part.text, stepName);
  }
  if (typeof part === 'object' && part !== null) {
    return part as unknown as StoryOutput;
  }
  throw new GenerationApiError(`${stepName}: Unexpected response part format.`);
}

// --- Prompt builders ---

function buildKnowledgePrompt(
  cards: { question: string; answer: string }[],
  language: string,
  age: number,
  wordCount: number
): string {
  const cardList = cards.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`).join('\n');

  return `You are a creative educator. Your task is to write an engaging story for a ${age}-year-old student that naturally incorporates all the key concepts from the flashcards below.

**Requirements:**
- Write in ${language}
- Target length: approximately ${wordCount} words
- Choose a narrative format (adventure, dialogue, case study, analogy, etc.) that is appropriate and engaging for a ${age}-year-old
- Every concept from the flashcards must appear naturally woven into the story — not as a list, but embedded in the narrative
- The story should help the reader understand how the concepts connect to each other
- Make it memorable and enjoyable to read

**Output format:**
Return a JSON object with a "paragraphs" array. Each element must have:
- "primary": the paragraph text (the story)
- "secondary": an empty string "" (no translation needed for knowledge mode)

**Flashcard concepts to incorporate:**
${cardList}

Write the story now. Output only the JSON.`;
}

function buildTranslationPrompt(
  cards: { question: string; answer: string }[],
  primaryLanguage: string,
  secondaryLanguage: string,
  age: number,
  wordCount: number
): string {
  const vocabList = cards.map((c, i) => `${i + 1}. ${c.question} = ${c.answer}`).join('\n');

  return `You are a creative language educator. Your task is to write an immersive story in ${secondaryLanguage} for a ${age}-year-old student, using vocabulary from the word list below. For each paragraph, you will also provide a faithful translation in ${primaryLanguage}.

**Requirements:**
- Write the story primarily in ${secondaryLanguage}
- Target length: approximately ${wordCount} words in the primary language
- Every vocabulary word from the list must appear naturally in the story
- Choose a narrative format appropriate and engaging for a ${age}-year-old
- The story should be immersive and help the reader understand vocabulary in context
- The ${primaryLanguage} translation of each paragraph should be accurate and natural

**Output format:**
Return a JSON object with a "paragraphs" array. Each element must have:
- "primary": the paragraph written in ${secondaryLanguage}
- "secondary": the faithful translation of that paragraph in ${primaryLanguage}

**Vocabulary to incorporate (${primaryLanguage} = ${secondaryLanguage}):**
${vocabList}

Write the story now. Output only the JSON.`;
}

// --- Main exported function ---

const CARD_CAP = 70;
const WORDS_PER_MINUTE = 200;

/**
 * Generates a story from flashcard content using Vertex AI.
 */
export async function generateStory(input: StoryGenerationInput): Promise<StoryOutput> {
  const { cards, mode, primaryLanguage, secondaryLanguage, age, readingTimeMin } = input;

  // Cap cards at 70
  const cappedCards = cards.slice(0, CARD_CAP);
  const wordCount = readingTimeMin * WORDS_PER_MINUTE;

  appLogger.info(
    `[Story Generator] Generating story: mode=${mode}, age=${age}, readingTime=${readingTimeMin}min, cards=${cappedCards.length}`
  );

  const prompt =
    mode === 'translation'
      ? buildTranslationPrompt(cappedCards, primaryLanguage, secondaryLanguage, age, wordCount)
      : buildKnowledgePrompt(cappedCards, primaryLanguage, age, wordCount);

  try {
    const result = await callVertexAI(prompt, 'Story Generation');

    // Validate result
    if (!result || !Array.isArray(result.paragraphs) || result.paragraphs.length === 0) {
      throw new GenerationApiError('AI returned empty or invalid paragraphs array.');
    }

    for (const para of result.paragraphs) {
      if (typeof para.primary !== 'string' || typeof para.secondary !== 'string') {
        throw new GenerationApiError('AI returned invalid paragraph structure.');
      }
    }

    appLogger.info(`[Story Generator] Success. Paragraphs: ${result.paragraphs.length}`);
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    appLogger.error(`[Story Generator] Error during generation:`, msg);
    if (error instanceof GenerationApiError) throw error;
    throw new GenerationApiError(`Unexpected error during story generation: ${msg}`);
  }
}
