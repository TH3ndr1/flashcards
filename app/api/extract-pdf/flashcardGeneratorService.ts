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
import { VERTEX_MODEL_NAME, MAX_TEXT_CHARS_FOR_GEMINI } from './config';
import {
    ApiFlashcard, // Assuming ApiFlashcard type needs update elsewhere or this service returns a subset
    // Assuming GeminiFlashcardInput and GeminiStructuredOutput defined below or in types.ts are sufficient
    GenerationApiError
} from './types'; // Ensure types.ts is updated if necessary

// --- Updated Internal Types ---
// Input structure expected within the 'flashcards' array from Gemini
interface GeminiFlashcardInput {
    question: string;
    answer: string;
    questionPartOfSpeech: string;
    questionGender: string;
    answerPartOfSpeech: string;
    answerGender: string;
}

// Overall structure expected from Gemini
interface GeminiStructuredOutput {
    mode: 'translation' | 'knowledge';
    detectedQuestionLanguage: string;
    detectedAnswerLanguage: string;
    flashcards: GeminiFlashcardInput[];
}

// --- Updated Vertex AI Schema Definition ---
const flashcardSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
      mode: { type: SchemaType.STRING, enum: ['translation', 'knowledge'], description: "The mode determined: 'translation' for word lists, 'knowledge' for prose." },
      detectedQuestionLanguage: { type: SchemaType.STRING, description: "The primary language detected for questions/source words (e.g., 'English', 'French')." },
      detectedAnswerLanguage: { type: SchemaType.STRING, description: "The secondary/target language detected for answers/translations (e.g., 'Dutch', 'Spanish'). Same as question language for 'knowledge' mode." },
      flashcards: {
        type: SchemaType.ARRAY, description: "An array of generated flashcard objects.",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            question: { type: SchemaType.STRING, description: "The question or source word/phrase." },
            answer: { type: SchemaType.STRING, description: "The answer or target word/phrase/translation." },
            // --- NEW Classification Fields ---
            questionPartOfSpeech: { type: SchemaType.STRING, description: "Part of Speech for the question word (e.g., 'Noun', 'Verb', 'N/A')." },
            questionGender: { type: SchemaType.STRING, description: "Grammatical gender for the question word (e.g., 'Male', 'Female', 'N/A')." },
            answerPartOfSpeech: { type: SchemaType.STRING, description: "Part of Speech for the answer word (e.g., 'Noun', 'Verb', 'N/A')." },
            answerGender: { type: SchemaType.STRING, description: "Grammatical gender for the answer word (e.g., 'Male', 'Female', 'N/A')." }
            // --- End of NEW Fields ---
          },
          // --- Updated required fields ---
          required: [
              'question',
              'answer',
              'questionPartOfSpeech',
              'questionGender',
              'answerPartOfSpeech',
              'answerGender'
          ]
        }
      }
    },
    required: ['mode', 'detectedQuestionLanguage', 'detectedAnswerLanguage', 'flashcards']
};


// Define safety settings and generation config (Unchanged)
const safetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const generationConfig: GenerationConfig = {
    responseMimeType: 'application/json',
    responseSchema: flashcardSchema, // Use updated schema
};

// --- Updated intermediate type for mapping ---
// --- FIX: Added export keyword ---
export interface MappedFlashcardCore {
    question: string;
    answer: string;
    questionLanguage: string;
    answerLanguage: string;
    isBilingual: boolean;
    // --- NEW Classification Fields ---
    questionPartOfSpeech: string;
    questionGender: string;
    answerPartOfSpeech: string;
    answerGender: string;
    // --- End of NEW Fields ---
}

/**
 * Generates flashcards from the provided text using Gemini with structured output.
 * @param text The extracted text content.
 * @param filename The original filename (for context in logging/errors).
 * @returns A promise resolving to an array of core flashcard data including classifications.
 * @throws {GenerationApiError} If generation fails due to API errors, safety blocks, or schema issues.
 */
export async function generateFlashcards(
    text: string,
    filename: string
): Promise<MappedFlashcardCore[]> { // Return type updated
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
            model: VERTEX_MODEL_NAME,
            safetySettings: safetySettings,
            generationConfig: generationConfig,
        });

        const truncatedText = text.length > MAX_TEXT_CHARS_FOR_GEMINI
            ? text.slice(0, MAX_TEXT_CHARS_FOR_GEMINI) + `\n\n...(text truncated at ${MAX_TEXT_CHARS_FOR_GEMINI} characters for brevity)`
            : text;

        // --- Updated Prompt ---
        const prompt = `
**Goal:** Analyze the provided text, generate flashcards (including grammatical classification for translations), and prepare the output as structured JSON according to the specified format.

**Instructions:**

1.  **Analyze Content:** Read the text provided below under "Document Text".
2.  **Determine Mode & Languages:**
    *   Identify if the text is primarily a 'translation' list (pairs of words/phrases in different languages) or 'knowledge' text (prose, factual information in a single primary language). Assign 'translation' or 'knowledge' to the \`mode\` field.
    *   Detect the primary language used for the questions or source words. Assign this language name (e.g., 'English', 'German') to the \`detectedQuestionLanguage\` field.
    *   Detect the secondary/target language used for answers or translations. Assign this language name (e.g., 'Spanish', 'French') to the \`detectedAnswerLanguage\` field.
        *   If \`mode\` is 'translation', \`detectedAnswerLanguage\` should typically be different from \`detectedQuestionLanguage\`.
        *   If \`mode\` is 'knowledge', \`detectedAnswerLanguage\` must be the *same* as \`detectedQuestionLanguage\`.
3.  **Generate Flashcards and Classify:** Create an array of flashcard objects for the \`flashcards\` field based on the determined mode:
    *   **a. Generate Question/Answer:**
        *   **If Mode is 'translation':**
            *   Create one flashcard object for each distinct word/phrase pair found in the text.
            *   Use the source language word/phrase for the \`question\` field.
            *   Use the target language word/phrase for the \`answer\` field.
        *   **If Mode is 'knowledge':**
            *   Generate multiple high-quality flashcards (aim for at least 2-3 per main topic or distinct paragraph).
            *   Create a \`question\` that tests understanding or recall of a key concept from the text. Avoid trivial questions.
            *   Provide a concise (ideally under 100 words) and accurate \`answer\` derived directly from the text.
            *   Both \`question\` and \`answer\` must be in the \`detectedQuestionLanguage\`.
    *   **b. Classify (Conditional):** For *each* flashcard object generated:
        *   **If Mode is 'translation':**
            *   **i. Classify Question Word:** Identify the primary vocabulary word in the \`question\` field. Determine its Part of Speech (PoS) and Gender (if applicable). Assign these to \`questionPartOfSpeech\` and \`questionGender\` fields using the allowed values below.
            *   **ii. Classify Answer Word:** Identify the primary vocabulary word in the \`answer\` field. Determine its Part of Speech (PoS) and Gender (if applicable). Assign these to \`answerPartOfSpeech\` and \`answerGender\` fields using the allowed values below.
        *   **If Mode is 'knowledge':**
            *   Set \`questionPartOfSpeech\`, \`questionGender\`, \`answerPartOfSpeech\`, and \`answerGender\` fields all to 'N/A'.
    *   **c. Allowed Classification Values:**
        *   **Part of Speech:** Use *only* one of: 'Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other'.
        *   **Gender:** Use *only* one of: 'Male', 'Female', 'Neuter', 'N/A'. Use 'N/A' if gender is linguistically irrelevant for the word/language (e.g., English nouns, verbs, adjectives) or cannot be reliably determined.
4.  **Format Output:** Structure your *entire response* as a single JSON object containing the \`mode\`, \`detectedQuestionLanguage\`, \`detectedAnswerLanguage\`, and \`flashcards\` fields. Each object within the \`flashcards\` array must now contain \`question\`, \`answer\`, \`questionPartOfSpeech\`, \`questionGender\`, \`answerPartOfSpeech\`, and \`answerGender\` fields. Adhere strictly to this structure.

**Example \`flashcards\` array content for 'translation' mode:**
\`[ { "question": "la table", "answer": "the table", "questionPartOfSpeech": "Noun", "questionGender": "Female", "answerPartOfSpeech": "Noun", "answerGender": "N/A" }, { "question": "le livre", "answer": "the book", "questionPartOfSpeech": "Noun", "questionGender": "Male", "answerPartOfSpeech": "Noun", "answerGender": "N/A" }, { "question": "bon", "answer": "good", "questionPartOfSpeech": "Adjective", "questionGender": "Male", "answerPartOfSpeech": "Adjective", "answerGender": "N/A" }, { "question": "aller", "answer": "to go", "questionPartOfSpeech": "Verb", "questionGender": "N/A", "answerPartOfSpeech": "Verb", "answerGender": "N/A" } ]\`

**Example \`flashcards\` array content for 'knowledge' mode:**
\`[ { "question": "What is the primary function of the mitochondria?", "answer": "The primary function of mitochondria is to generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.", "questionPartOfSpeech": "N/A", "questionGender": "N/A", "answerPartOfSpeech": "N/A", "answerGender": "N/A" } ]\`

**Important Constraints:**
*   Your final output must be *only* the JSON object. Do not include any introductory text, explanations, or markdown formatting around the JSON.
*   Accurately determine the \`mode\` and languages based *only* on the provided text.
*   Ensure language consistency as described in step 2.
*   Strictly adhere to the classification logic based on the \`mode\`.
*   Ensure \`questionPartOfSpeech\`, \`questionGender\`, \`answerPartOfSpeech\`, and \`answerGender\` fields use *only* the provided values from the lists in step 3.c.

**Document Text:**

"""
${truncatedText}
"""
`;
        // --- End of Updated Prompt ---

        console.log(`[Generator Service] Sending prompt for ${filename} to ${VERTEX_MODEL_NAME}. Prompt length: ${prompt.length}`);

        const requestPayload = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };

        const result = await model.generateContent(requestPayload);
        const response = result.response;

        // --- Process and Validate Structured Response ---
        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
             const finishReason = response?.candidates?.[0]?.finishReason;
             const safetyRatings = response?.candidates?.[0]?.safetyRatings;
             console.error(`[Generator Service] Invalid response structure or safety block for ${filename}. Reason: ${finishReason}`, safetyRatings);
             throw new GenerationApiError(`Invalid or empty response structure from AI model for ${filename}. Finish Reason: ${finishReason}`);
         }

         const responsePart = response.candidates[0].content.parts[0];
         let structuredData: any;

         // Keep the logic that checks for the "text" property first (Unchanged)
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
             structuredData = responsePart; // Assuming direct JSON object
         } else {
             console.error(`[Generator Service] Unexpected response part format for ${filename}. Expected object, got: ${typeof responsePart}. Content:`, String(responsePart));
             throw new GenerationApiError(`Unexpected response format from AI model for ${filename}.`);
         }


         // --- Validate the structured data against schema expectations ---
         // Basic validation - consider using Zod here for robustness if not already done
         if (!structuredData || typeof structuredData !== 'object' ||
             !structuredData.mode || typeof structuredData.mode !== 'string' || !['translation', 'knowledge'].includes(structuredData.mode) ||
             !structuredData.detectedQuestionLanguage || typeof structuredData.detectedQuestionLanguage !== 'string' ||
             !structuredData.detectedAnswerLanguage || typeof structuredData.detectedAnswerLanguage !== 'string' ||
             !Array.isArray(structuredData.flashcards))
         {
             console.error(`[Generator Service] Parsed JSON for ${filename} does NOT match required base schema fields/types. Received:`, JSON.stringify(structuredData, null, 2));
             throw new GenerationApiError(`AI response JSON base structure mismatch for ${filename}. Received: ${JSON.stringify(structuredData)}`);
         }

         // Validate flashcard structure within the array
         for (const card of structuredData.flashcards) {
             if (typeof card !== 'object' || card === null ||
                 typeof card.question !== 'string' ||
                 typeof card.answer !== 'string' ||
                 // --- NEW: Validate existence and type of classification fields ---
                 typeof card.questionPartOfSpeech !== 'string' ||
                 typeof card.questionGender !== 'string' ||
                 typeof card.answerPartOfSpeech !== 'string' ||
                 typeof card.answerGender !== 'string')
             {
                 console.error(`[Generator Service] Invalid flashcard structure within the array for ${filename}. Received card:`, JSON.stringify(card, null, 2));
                 throw new GenerationApiError(`AI response flashcard structure mismatch for ${filename}.`);
             }
         }

         // Type assertion after validation passes
         const validatedData = structuredData as GeminiStructuredOutput;
         const { mode, detectedQuestionLanguage, detectedAnswerLanguage, flashcards: parsedFlashcards } = validatedData;

         console.log(`[Generator Service] Parsed structured response for ${filename}. Mode: ${mode}, QLang: ${detectedQuestionLanguage}, ALang: ${detectedAnswerLanguage}, Cards Found: ${parsedFlashcards.length}`);

         // --- Updated Mapping Logic ---
         const mappedCards: (MappedFlashcardCore | null)[] = parsedFlashcards
             .map((card: GeminiFlashcardInput) => { // Use updated input type
                 const question = card.question?.trim();
                 const answer = card.answer?.trim();

                 // --- NEW: Get classification fields ---
                 const questionPartOfSpeech = card.questionPartOfSpeech?.trim() || 'N/A';
                 const questionGender = card.questionGender?.trim() || 'N/A';
                 const answerPartOfSpeech = card.answerPartOfSpeech?.trim() || 'N/A';
                 const answerGender = card.answerGender?.trim() || 'N/A';
                 // --- End of NEW Fields ---

                 if (!question || !answer) {
                     console.warn(`[Generator Service] Skipping card with empty question or answer for ${filename}: Q='${question}', A='${answer}'`);
                     return null;
                 }

                 // Return object conforming to MappedFlashcardCore
                 return {
                     question: question,
                     answer: answer,
                     questionLanguage: detectedQuestionLanguage,
                     answerLanguage: detectedAnswerLanguage,
                     isBilingual: mode === 'translation' && detectedQuestionLanguage !== detectedAnswerLanguage,
                     // --- NEW: Include classification fields ---
                     questionPartOfSpeech: questionPartOfSpeech,
                     questionGender: questionGender,
                     answerPartOfSpeech: answerPartOfSpeech,
                     answerGender: answerGender,
                     // --- End of NEW Fields ---
                 };
             });

        // Filter out nulls
        const coreFlashcards: MappedFlashcardCore[] = mappedCards
             .filter((card): card is MappedFlashcardCore => card !== null);

        console.log(`[Generator Service] Returning ${coreFlashcards.length} valid core flashcards for ${filename}.`);
        return coreFlashcards; // Return the array of mapped objects

    } catch (error: any) {
        if (error instanceof GenerationApiError) {
            throw error;
        }
        console.error(`[Generator Service] Unexpected error during flashcard generation for ${filename}:`, error.message);
        if (error.stack) console.error(error.stack);
        // Check for specific Vertex AI error details if available
        let details = '';
        if (error.details) details = ` Details: ${JSON.stringify(error.details)}`;
        if (error.response?.candidates?.[0]?.finishReason) details += ` Finish Reason: ${error.response.candidates[0].finishReason}`;

        throw new GenerationApiError(`Unexpected error generating flashcards for ${filename}: ${error.message}${details}`);
    }
}