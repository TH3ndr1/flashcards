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
import type { StoryParagraph, StoryMode, ReadingTimeMin, StoryFormat } from '@/types/story';

// --- Input/Output Types ---

export interface StoryGenerationInput {
  cards: { question: string; answer: string }[];
  mode: StoryMode;
  primaryLanguage: string;   // e.g. 'English', 'French'
  secondaryLanguage: string; // e.g. 'Dutch' — same as primary for knowledge mode
  age: number;
  readingTimeMin: ReadingTimeMin;
  storyFormat: StoryFormat;
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
      description: 'Array of content paragraphs.',
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

// --- Internal helpers ---

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

// Knowledge mode prompts

function buildKnowledgeNarrativePrompt(cards: { question: string; answer: string }[], language: string, age: number, wordCount: number): string {
  const cardList = cards.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`).join('\n');
  return `You are a creative educator. Write an engaging story for a ${age}-year-old student that naturally incorporates all the key concepts from the flashcards below.

**Requirements:**
- Write in ${language}
- Target length: approximately ${wordCount} words
- Choose a narrative format (adventure, case study, dialogue, etc.) appropriate for a ${age}-year-old
- Every concept must appear naturally woven into the story — not as a list
- Help the reader understand how concepts connect to each other
- Make it memorable and enjoyable

**Output:** JSON with "paragraphs" array. Each element: "primary" = paragraph text, "secondary" = ""

**Flashcards:**
${cardList}

Output only the JSON.`;
}

function buildKnowledgeSummaryPrompt(cards: { question: string; answer: string }[], language: string, age: number, wordCount: number): string {
  const cardList = cards.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`).join('\n');
  return `You are an expert educator creating a structured audio overview for a ${age}-year-old student. Write a clear, engaging concept summary — like a podcast episode — that covers all the key concepts from the flashcards below. This is NOT a story; it is a direct, well-structured explanation of what each concept means, why it matters, and how concepts connect.

**Requirements:**
- Write in ${language}
- Target length: approximately ${wordCount} words
- Structured but engaging — suitable for listening/reading as a pre-exam review
- Cover every concept; explain it in plain language with examples where useful
- Group related concepts naturally; build understanding progressively
- Appropriate vocabulary and depth for a ${age}-year-old

**Output:** JSON with "paragraphs" array. Each element: "primary" = paragraph text, "secondary" = ""

**Flashcards:**
${cardList}

Output only the JSON.`;
}

function buildKnowledgeDialoguePrompt(cards: { question: string; answer: string }[], language: string, age: number, wordCount: number): string {
  const cardList = cards.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`).join('\n');
  return `You are a creative educator. Write a Socratic dialogue between a knowledgeable Teacher and a curious Student for a ${age}-year-old. The conversation naturally explores and teaches all the concepts from the flashcards below. The dialogue should feel genuine — the student asks real questions, the teacher explains clearly with examples.

**Requirements:**
- Write in ${language}
- Target length: approximately ${wordCount} words
- Every concept must be covered through the conversation
- Keep it engaging, age-appropriate (${age} years old), and educational
- Format each paragraph as a few lines of dialogue (e.g. "Teacher: ... Student: ...")

**Output:** JSON with "paragraphs" array. Each element: "primary" = a block of dialogue, "secondary" = ""

**Flashcards:**
${cardList}

Output only the JSON.`;
}

function buildKnowledgeAnalogyPrompt(cards: { question: string; answer: string }[], language: string, age: number, wordCount: number): string {
  const cardList = cards.map((c, i) => `${i + 1}. Q: ${c.question}\n   A: ${c.answer}`).join('\n');
  return `You are a creative educator. For each concept from the flashcards below, write a vivid, memorable real-world analogy or scenario that makes the concept instantly understandable for a ${age}-year-old. Good analogies stick — choose comparisons that are familiar to the age group and truly illuminate the concept.

**Requirements:**
- Write in ${language}
- Target length: approximately ${wordCount} words total
- Cover every concept with its own analogy paragraph
- Each paragraph: introduce the concept, then explain it via analogy/scenario
- Make analogies concrete and relatable for a ${age}-year-old

**Output:** JSON with "paragraphs" array. Each element: "primary" = analogy paragraph for one concept, "secondary" = ""

**Flashcards:**
${cardList}

Output only the JSON.`;
}

// Translation mode prompts (L2 primary + L1 secondary)

function buildTranslationNarrativePrompt(cards: { question: string; answer: string }[], primaryLanguage: string, secondaryLanguage: string, age: number, wordCount: number): string {
  const vocabList = cards.map((c, i) => `${i + 1}. ${c.question} = ${c.answer}`).join('\n');
  return `You are a creative language educator. Write an immersive story in ${secondaryLanguage} for a ${age}-year-old, using the vocabulary below. For each paragraph, provide a faithful ${primaryLanguage} translation.

**Requirements:**
- Story written in ${secondaryLanguage}; translation in ${primaryLanguage}
- Target length: approximately ${wordCount} words in the story
- Every vocabulary word must appear naturally in the story
- Narrative format appropriate for a ${age}-year-old
- Translation must be accurate and natural

**Output:** JSON "paragraphs" array. Each element: "primary" = ${secondaryLanguage} paragraph, "secondary" = ${primaryLanguage} translation

**Vocabulary (${primaryLanguage} = ${secondaryLanguage}):**
${vocabList}

Output only the JSON.`;
}

function buildTranslationSummaryPrompt(cards: { question: string; answer: string }[], primaryLanguage: string, secondaryLanguage: string, age: number, wordCount: number): string {
  const vocabList = cards.map((c, i) => `${i + 1}. ${c.question} = ${c.answer}`).join('\n');
  return `You are a language educator. Write a structured overview in ${secondaryLanguage} that uses all the vocabulary words below and explains them in context, suitable for a ${age}-year-old learner. For each paragraph, provide a faithful ${primaryLanguage} translation.

**Requirements:**
- Written in ${secondaryLanguage}; each paragraph followed by its ${primaryLanguage} translation
- Target length: approximately ${wordCount} words
- Every vocabulary word must appear in context with clear meaning
- Organized, clear, and educational — like an audio vocabulary guide
- Appropriate for a ${age}-year-old

**Output:** JSON "paragraphs" array. Each element: "primary" = ${secondaryLanguage} paragraph, "secondary" = ${primaryLanguage} translation

**Vocabulary:**
${vocabList}

Output only the JSON.`;
}

function buildTranslationDialoguePrompt(cards: { question: string; answer: string }[], primaryLanguage: string, secondaryLanguage: string, age: number, wordCount: number): string {
  const vocabList = cards.map((c, i) => `${i + 1}. ${c.question} = ${c.answer}`).join('\n');
  return `You are a language educator. Write an engaging dialogue in ${secondaryLanguage} between two characters for a ${age}-year-old learner. The dialogue uses all vocabulary words below naturally. For each paragraph (a block of dialogue), provide a faithful ${primaryLanguage} translation.

**Requirements:**
- Dialogue written in ${secondaryLanguage}; translation in ${primaryLanguage}
- Target length: approximately ${wordCount} words
- Every vocabulary word must appear naturally in the conversation
- Engaging and age-appropriate (${age} years old)
- Format each paragraph as a few lines of dialogue

**Output:** JSON "paragraphs" array. Each element: "primary" = dialogue block in ${secondaryLanguage}, "secondary" = ${primaryLanguage} translation

**Vocabulary:**
${vocabList}

Output only the JSON.`;
}

function buildTranslationAnalogyPrompt(cards: { question: string; answer: string }[], primaryLanguage: string, secondaryLanguage: string, age: number, wordCount: number): string {
  const vocabList = cards.map((c, i) => `${i + 1}. ${c.question} = ${c.answer}`).join('\n');
  return `You are a language educator. For each vocabulary item below, write a short ${secondaryLanguage} paragraph that uses the word naturally and explains its meaning through a vivid, relatable analogy for a ${age}-year-old. Follow each paragraph with a faithful ${primaryLanguage} translation.

**Requirements:**
- Written in ${secondaryLanguage}; translation in ${primaryLanguage}
- Cover every vocabulary word
- Each paragraph: use the word in a memorable analogy/scenario
- Appropriate for a ${age}-year-old

**Output:** JSON "paragraphs" array. Each element: "primary" = ${secondaryLanguage} analogy paragraph, "secondary" = ${primaryLanguage} translation

**Vocabulary:**
${vocabList}

Output only the JSON.`;
}

// --- Prompt dispatcher ---

function buildPrompt(input: StoryGenerationInput, cards: { question: string; answer: string }[], wordCount: number): string {
  const { mode, primaryLanguage, secondaryLanguage, age, storyFormat } = input;

  if (mode === 'translation') {
    switch (storyFormat) {
      case 'summary':   return buildTranslationSummaryPrompt(cards, primaryLanguage, secondaryLanguage, age, wordCount);
      case 'dialogue':  return buildTranslationDialoguePrompt(cards, primaryLanguage, secondaryLanguage, age, wordCount);
      case 'analogy':   return buildTranslationAnalogyPrompt(cards, primaryLanguage, secondaryLanguage, age, wordCount);
      default:          return buildTranslationNarrativePrompt(cards, primaryLanguage, secondaryLanguage, age, wordCount);
    }
  } else {
    switch (storyFormat) {
      case 'summary':   return buildKnowledgeSummaryPrompt(cards, primaryLanguage, age, wordCount);
      case 'dialogue':  return buildKnowledgeDialoguePrompt(cards, primaryLanguage, age, wordCount);
      case 'analogy':   return buildKnowledgeAnalogyPrompt(cards, primaryLanguage, age, wordCount);
      default:          return buildKnowledgeNarrativePrompt(cards, primaryLanguage, age, wordCount);
    }
  }
}

// --- Main exported function ---

const CARD_CAP = 70;
const WORDS_PER_MINUTE = 200;

const WORD_COUNT_MAP: Record<ReadingTimeMin, number> = {
  minimal: 300,
  5: 1000,
  10: 2000,
  20: 4000,
};

/**
 * Generates content from flashcard decks using Vertex AI.
 * Supports 4 formats (narrative, summary, dialogue, analogy) ×
 * 2 deck modes (knowledge, translation) × 4 reading time options.
 */
export async function generateStory(input: StoryGenerationInput): Promise<StoryOutput> {
  const { cards, readingTimeMin, storyFormat, mode, age } = input;

  const cappedCards = cards.slice(0, CARD_CAP);
  const wordCount = WORD_COUNT_MAP[readingTimeMin];

  appLogger.info(
    `[Story Generator] Generating story: mode=${mode}, format=${storyFormat}, age=${age}, readingTime=${readingTimeMin}, cards=${cappedCards.length}`
  );

  const prompt = buildPrompt(input, cappedCards, wordCount);

  try {
    const result = await callVertexAI(prompt, 'Story Generation');

    if (!result || !Array.isArray(result.paragraphs) || result.paragraphs.length === 0) {
      throw new GenerationApiError('AI returned empty or invalid paragraphs array.');
    }

    for (const para of result.paragraphs) {
      if (typeof para.primary !== 'string' || typeof para.secondary !== 'string') {
        throw new GenerationApiError('AI returned invalid paragraph structure.');
      }
    }

    appLogger.info(`[Story Generator] Success. Format=${storyFormat}, Paragraphs=${result.paragraphs.length}`);
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    appLogger.error(`[Story Generator] Error during generation:`, msg);
    if (error instanceof GenerationApiError) throw error;
    throw new GenerationApiError(`Unexpected error during story generation: ${msg}`);
  }
}
