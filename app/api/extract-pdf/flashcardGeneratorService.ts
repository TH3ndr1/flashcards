// app/api/extract-pdf/flashcardGeneratorService.ts
/**
 * Service responsible for generating flashcards from text using Google Vertex AI (Gemini).
 * Handles structured output configuration and parsing.
 */
import {
    VertexAI,
    HarmCategory,
    HarmBlockThreshold,
    Schema,
    SchemaType,
    GenerationConfig,
    SafetySetting
} from '@google-cloud/vertexai';
import { vertexAI } from './gcpClients';
import { VERTEX_MODEL_NAME, MAX_TEXT_CHARS_FOR_GEMINI } from './config'; // Ensure VERTEX_MODEL_NAME is correctly imported/exported
import {
    ApiFlashcard,
    GeminiFlashcardInput,
    GeminiStructuredOutput,
    GenerationApiError
} from './types';

// Define the JSON Schema for Gemini's Structured Output
const flashcardSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      mode: { type: SchemaType.STRING, enum: ['translation', 'knowledge'], description: "The mode determined for the document: 'translation' for vocabulary lists (e.g., word pairs like 'word1 - word2'), 'knowledge' for regular prose or factual text." },
      detectedQuestionLanguage: { type: SchemaType.STRING, description: "The primary language detected for questions or source words (e.g., 'English', 'French'). Must be populated based on analysis." },
      detectedAnswerLanguage: { type: SchemaType.STRING, description: "The secondary/target language detected for answers or translations (e.g., 'Dutch', 'Spanish'). Should be the same as detectedQuestionLanguage for 'knowledge' mode. Must be populated based on analysis." },
      flashcards: {
        type: SchemaType.ARRAY, description: "An array of generated flashcard objects.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            question: { type: SchemaType.STRING, description: "The question or source word/phrase for the flashcard." },
            answer: { type: SchemaType.STRING, description: "The answer or target word/phrase/translation for the flashcard. Should be concise for knowledge mode (under 100 words)." }
          },
          required: ['question', 'answer']
        }
      }
    },
    required: ['mode', 'detectedQuestionLanguage', 'detectedAnswerLanguage', 'flashcards']
};


// Define safety settings and generation config
const safetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const generationConfig: GenerationConfig = {
    responseMimeType: 'application/json',
    responseSchema: flashcardSchema,
};

// Intermediate type for the object created inside .map()
interface MappedFlashcardCore {
    question: string;
    answer: string;
    questionLanguage: string;
    answerLanguage: string;
    isBilingual: boolean;
}

/**
 * Generates flashcards from the provided text using Gemini with structured output.
 * @param text The extracted text content.
 * @param filename The original filename (for context in logging/errors).
 * @returns A promise resolving to an array of core flashcard data (ApiFlashcard without source/fileType).
 * @throws {GenerationApiError} If generation fails due to API errors, safety blocks, or schema issues.
 */
export async function generateFlashcards(
    text: string,
    filename: string
): Promise<Omit<ApiFlashcard, 'source' | 'fileType'>[]> {
    if (!vertexAI) {
        throw new GenerationApiError("Vertex AI client is not initialized. Check configuration.");
    }
    if (!text || text.trim().length < 10) {
        console.warn(`[Generator Service] Input text for ${filename} is too short or empty. Skipping generation.`);
        return [];
    }

    console.log(`[Generator Service] Attempting structured generation for: ${filename}`);

    try {
        const model = vertexAI.getGenerativeModel({
            model: VERTEX_MODEL_NAME, // Make sure this is correct, e.g., 'gemini-1.5-flash-001' or the corrected one
            safetySettings: safetySettings,
            generationConfig: generationConfig,
        });

        const truncatedText = text.length > MAX_TEXT_CHARS_FOR_GEMINI
            ? text.slice(0, MAX_TEXT_CHARS_FOR_GEMINI) + `\n\n...(text truncated at ${MAX_TEXT_CHARS_FOR_GEMINI} characters for brevity)`
            : text;

        // --- FIX: Insert the actual prompt text here ---
        const prompt = `
**Goal:** Analyze the provided text and generate flashcards, preparing the output as structured JSON according to the specified format (which will be provided separately via API schema).

**Instructions:**

1.  **Analyze Content:** Read the text provided below under "Document Text".
2.  **Determine Mode & Languages:**
    *   Identify if the text is primarily a 'translation' list (pairs of words/phrases in different languages) or 'knowledge' text (prose, factual information in a single primary language). Assign 'translation' or 'knowledge' to the \`mode\` field in the JSON output.
    *   Detect the primary language used for the questions or source words. Assign this language name (e.g., 'English', 'German') to the \`detectedQuestionLanguage\` field in the JSON output. Ensure it's a plausible language from the text.
    *   Detect the secondary/target language used for answers or translations. Assign this language name (e.g., 'Spanish', 'French') to the \`detectedAnswerLanguage\` field in the JSON output. Ensure it's plausible.
        *   If \`mode\` is 'translation', \`detectedAnswerLanguage\` should typically be different from \`detectedQuestionLanguage\`.
        *   If \`mode\` is 'knowledge', \`detectedAnswerLanguage\` must be the *same* as \`detectedQuestionLanguage\`.
3.  **Generate Flashcards:** Create an array of flashcard objects for the \`flashcards\` field in the JSON output, based on the determined mode:
    *   **If Mode is 'translation':**
        *   Create one flashcard object for each distinct word/phrase pair found in the text.
        *   Use the source language word/phrase for the \`question\` field.
        *   Use the target language word/phrase for the \`answer\` field. Be precise.
    *   **If Mode is 'knowledge':**
        *   Generate multiple high-quality flashcards (aim for at least 2-3 per main topic or distinct paragraph, but adjust based on text length/density).
        *   Create a \`question\` that tests understanding or recall of a key concept from the text. Avoid trivial or overly broad questions.
        *   Provide a concise (ideally under 100 words) and accurate \`answer\` derived directly from the text.
        *   Both \`question\` and \`answer\` must be in the \`detectedQuestionLanguage\`.
4.  **Format Output:** Structure your *entire response* as a single JSON object containing the \`mode\`, \`detectedQuestionLanguage\`, \`detectedAnswerLanguage\`, and \`flashcards\` fields, with each flashcard having \`question\` and \`answer\` fields. Adhere strictly to the provided schema structure.

**Example \`flashcards\` array content for 'translation' mode:**
\`[ { "question": "Maison", "answer": "House" }, { "question": "Chat", "answer": "Cat" } ]\`

**Example \`flashcards\` array content for 'knowledge' mode:**
\`[ { "question": "What is the powerhouse of the cell?", "answer": "The mitochondrion is often called the powerhouse of the cell because it generates most of the cell's supply of adenosine triphosphate (ATP)." }, { "question": "What molecule does ATP stand for?", "answer": "ATP stands for adenosine triphosphate." } ]\`

**Important Constraints:**
*   Your final output must be *only* the JSON object conforming to the schema. No extra text or markdown.
*   Accurately determine the \`mode\` and languages based *only* on the provided text and populate the corresponding fields in the JSON output. Use standard language names (e.g., "English", "Spanish").
*   For 'knowledge' mode, ensure questions are meaningful and answers are concise and factually based on the text.
*   Ensure language consistency as described in step 2.
*   If the text is unsuitable for flashcards (e.g., gibberish, code, extremely short), return an empty \`flashcards\` array and set mode/languages appropriately (e.g., mode 'knowledge', language 'Unknown').

**Document Text:**

"""
${truncatedText}
"""
`;
        // --- End of FIX ---


        console.log(`[Generator Service] Sending prompt for ${filename} to ${VERTEX_MODEL_NAME}. Prompt length: ${prompt.length}`); // Log actual length now

        const requestPayload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };

        const result = await model.generateContent(requestPayload);
        const response = result.response;

        // --- Process and Validate Structured Response ---
        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
             const finishReason = response?.candidates?.[0]?.finishReason;
             // ... (rest of error checking for response structure)
             throw new GenerationApiError(`Invalid or empty response structure from AI model for ${filename}.`);
         }

         const responsePart = response.candidates[0].content.parts[0];
         let structuredData: any;

         // Keep the logic that checks for the "text" property first, as that was observed
         if (typeof responsePart === 'object' && responsePart !== null && 'text' in responsePart && typeof responsePart.text === 'string') {
             console.log(`[Generator Service] Found 'text' property in response part for ${filename}. Attempting to parse.`);
             try {
                 structuredData = JSON.parse(responsePart.text);
             } catch (parseError: any) {
                 console.error(`[Generator Service] Error parsing JSON string from 'text' field for ${filename}:`, parseError.message);
                 console.error("[Generator Service] Received text content:", responsePart.text);
                 throw new GenerationApiError(`Failed to parse JSON response from 'text' field for ${filename}: ${parseError.message}`);
             }
         } else if (typeof responsePart === 'object' && responsePart !== null) {
             console.warn(`[Generator Service] Response part for ${filename} is an object but lacks the expected 'text' property. Assuming direct JSON object. Verify API behavior.`);
             structuredData = responsePart;
         } else {
             console.error(`[Generator Service] Unexpected response part format for ${filename}. Expected object, got: ${typeof responsePart}. Content:`, String(responsePart));
             throw new GenerationApiError(`Unexpected response format from AI model for ${filename}.`);
         }


         // --- Validate the structured data against schema expectations ---
         if (!structuredData || typeof structuredData !== 'object' ||
             !structuredData.mode || typeof structuredData.mode !== 'string' || !['translation', 'knowledge'].includes(structuredData.mode) ||
             !structuredData.detectedQuestionLanguage || typeof structuredData.detectedQuestionLanguage !== 'string' ||
             !structuredData.detectedAnswerLanguage || typeof structuredData.detectedAnswerLanguage !== 'string' ||
             !Array.isArray(structuredData.flashcards))
         {
             console.error(`[Generator Service] Parsed JSON for ${filename} does NOT match required schema fields/types. Received:`, JSON.stringify(structuredData, null, 2));
             throw new GenerationApiError(`AI response JSON structure mismatch for ${filename}. Received: ${JSON.stringify(structuredData)}`);
         }

         // Type assertion after validation passes
         const validatedData = structuredData as GeminiStructuredOutput;
         const { mode, detectedQuestionLanguage, detectedAnswerLanguage, flashcards: parsedFlashcards } = validatedData;

         console.log(`[Generator Service] Parsed structured response for ${filename}. Mode: ${mode}, QLang: ${detectedQuestionLanguage}, ALang: ${detectedAnswerLanguage}, Cards Found: ${parsedFlashcards.length}`);

         // --- Map to intermediate structure (or null) ---
         const mappedCards: (MappedFlashcardCore | null)[] = parsedFlashcards
             .map((card: GeminiFlashcardInput) => {
                 const question = card.question?.trim();
                 const answer = card.answer?.trim();

                 if (!question || !answer) {
                     console.warn(`[Generator Service] Skipping card with empty question or answer for ${filename}: Q='${question}', A='${answer}'`);
                     return null;
                 }

                 return {
                     question: question,
                     answer: answer,
                     questionLanguage: detectedQuestionLanguage,
                     answerLanguage: detectedAnswerLanguage,
                     isBilingual: mode === 'translation' && detectedQuestionLanguage !== detectedAnswerLanguage,
                 };
             });

        // Filter out nulls and assign
        const coreFlashcards: Omit<ApiFlashcard, 'source' | 'fileType'>[] = mappedCards
             .filter((card): card is MappedFlashcardCore => card !== null);

        console.log(`[Generator Service] Returning ${coreFlashcards.length} valid core flashcards for ${filename}.`);
        return coreFlashcards;

    } catch (error: any) {
        if (error instanceof GenerationApiError) {
            throw error;
        }
        console.error(`[Generator Service] Unexpected error during flashcard generation for ${filename}:`, error.message);
        if (error.stack) console.error(error.stack);
        throw new GenerationApiError(`Unexpected error generating flashcards for ${filename}: ${error.message}`);
    }
}