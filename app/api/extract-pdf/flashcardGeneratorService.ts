// app/api/extract-pdf/flashcardGeneratorService.ts
/**
 * Service responsible for generating flashcards from text using Google Vertex AI (Gemini).
 * Handles structured output configuration and parsing, now in a multi-step process:
 * 1. generateInitialFlashcards: Detects mode/languages, generates basic Q/A.
 * 2. classifyTranslationFlashcards: Classifies grammar for translation flashcards.
 * 3. regenerateAsKnowledgeFlashcards: Re-generates flashcards forcing knowledge mode.
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
    ApiFlashcard, // Assuming ApiFlashcard type needs update elsewhere
    GenerationApiError
} from './types'; // Ensure types.ts is updated if necessary

// --- Internal Types (remain largely the same, but used differently) ---

// --- Basic Flashcard Structure (Output of Phase 1 & Knowledge Regen) ---
interface GeminiFlashcardInputBasic {
    question: string;
    answer: string;
}

// --- Phase 1 Output --- (Basic Generation + Mode/Lang)
export interface InitialGenerationResult {
    mode: 'translation' | 'knowledge';
    detectedQuestionLanguage: string;
    detectedAnswerLanguage: string;
    basicFlashcards: GeminiFlashcardInputBasic[];
}

// --- Phase 2 Input/Output (Classification) ---
export interface GeminiFlashcardClassification {
    questionPartOfSpeech: string;
    questionGender: string;
    answerPartOfSpeech: string;
    answerGender: string;
}
// Phase 2 function will return GeminiFlashcardClassification[]
interface GeminiStructuredOutputPhase2 {
    classifiedFlashcards: GeminiFlashcardClassification[];
}

// --- Vertex AI Schema Definitions (remain the same) ---

// Schema for Phase 1 and Knowledge Regeneration (Basic Q/A + Mode/Lang)
const flashcardSchemaBasic: Schema = {
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
          },
          required: ['question', 'answer']
        }
      }
    },
    required: ['mode', 'detectedQuestionLanguage', 'detectedAnswerLanguage', 'flashcards']
};

// Schema for Phase 2 (Classification Only)
const flashcardSchemaClassification: Schema = {
    type: SchemaType.OBJECT,
    description: "Output schema for grammatical classification of flashcards.",
    properties: {
        classifiedFlashcards: {
            type: SchemaType.ARRAY,
            description: "An array of classification objects, corresponding exactly to the input flashcard array.",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    questionPartOfSpeech: { type: SchemaType.STRING, description: "Part of Speech for the question word (e.g., 'Noun', 'Verb', 'N/A')." },
                    questionGender: { type: SchemaType.STRING, description: "Grammatical gender for the question word (e.g., 'Male', 'Female', 'N/A')." },
                    answerPartOfSpeech: { type: SchemaType.STRING, description: "Part of Speech for the answer word (e.g., 'Noun', 'Verb', 'N/A')." },
                    answerGender: { type: SchemaType.STRING, description: "Grammatical gender for the answer word (e.g., 'Male', 'Female', 'N/A')." }
                },
                required: ['questionPartOfSpeech', 'questionGender', 'answerPartOfSpeech', 'answerGender']
            }
        }
    },
    required: ['classifiedFlashcards']
};


// --- Configs (remain the same) ---
const safetySettings: SafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Generation Configs for different steps
const generationConfigBasic: GenerationConfig = {
    responseMimeType: 'application/json',
    responseSchema: flashcardSchemaBasic, // Use Basic schema
};

const generationConfigClassification: GenerationConfig = {
    responseMimeType: 'application/json',
    responseSchema: flashcardSchemaClassification, // Use Classification schema
};

// --- Mapped Output Type for FINAL result sent to client hook (includes classification) ---
// This type represents the final combined flashcard structure.
export interface MappedFlashcardCore {
    question: string;
    answer: string;
    questionLanguage: string;
    answerLanguage: string;
    isBilingual: boolean;
    questionPartOfSpeech: string;
    questionGender: string;
    answerPartOfSpeech: string;
    answerGender: string;
    // --- Add source and fileType for consistency with ApiFlashcard? Needed downstream? ---
    // source?: string; 
    // fileType?: string;
}

// --- Helper Functions (parseJsonResponse, callVertexAI - modified slightly) ---
function parseJsonResponse(jsonString: string, filename: string, stepName: string): any {
    try {
        return JSON.parse(jsonString);
    } catch (parseError: any) {
        console.error(`[Generator Service] Error parsing JSON string in ${stepName} for ${filename}:`, parseError.message);
        console.error(`[Generator Service] Received text content (${stepName}):`, jsonString);
        throw new GenerationApiError(`Failed to parse ${stepName} JSON response for ${filename}: ${parseError.message}`);
    }
}

// Updated to accept any expected output type based on the config/schema used
async function callVertexAI<T>(
    prompt: string,
    generationConfig: GenerationConfig,
    filename: string,
    stepName: string // e.g., 'Phase 1', 'Classification', 'Knowledge Regen'
): Promise<T> { 
    if (!vertexAI) {
        throw new GenerationApiError("Vertex AI client is not initialized.");
    }

    console.log(`[Generator Service] ${stepName}: Sending prompt for ${filename} to ${VERTEX_MODEL_NAME}. Prompt length: ${prompt.length}`);

    const model = vertexAI.getGenerativeModel({
        model: VERTEX_MODEL_NAME,
        safetySettings: safetySettings,
        generationConfig: generationConfig,
    });

    const requestPayload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    const result = await model.generateContent(requestPayload);
    const response = result.response;

    if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
        const finishReason = response?.candidates?.[0]?.finishReason;
        const safetyRatings = response?.candidates?.[0]?.safetyRatings;
        console.error(`[Generator Service] ${stepName}: Invalid response structure or safety block for ${filename}. Reason: ${finishReason}`, safetyRatings);
        throw new GenerationApiError(`${stepName}: Invalid or empty response structure from AI for ${filename}. Finish Reason: ${finishReason}`);
    }

    const responsePart = response.candidates[0].content.parts[0];

    if (typeof responsePart === 'object' && responsePart !== null && 'text' in responsePart && typeof responsePart.text === 'string') {
        console.log(`[Generator Service] ${stepName}: Found 'text' property for ${filename}. Parsing.`);
        return parseJsonResponse(responsePart.text, filename, stepName);
    } else {
         console.warn(`[Generator Service] ${stepName}: Response part for ${filename} might be a direct JSON object (lacks 'text' property). Assuming direct object.`);
         if (typeof responsePart === 'object' && responsePart !== null) {
             return responsePart as T; // Assume it matches the expected structure T
         } else {
             console.error(`[Generator Service] ${stepName}: Unexpected response part format for ${filename}. Expected object, got: ${typeof responsePart}. Content:`, String(responsePart));
             throw new GenerationApiError(`${stepName}: Unexpected response format from AI for ${filename}.`);
         }
     }
}


/**
 * STEP 1: Generates initial flashcards, detects mode and languages from text.
 * Does NOT perform grammatical classification.
 * @param text The extracted text content.
 * @param filename The original filename (for context in logging/errors).
 * @returns A promise resolving to the initial generation result.
 */
export async function generateInitialFlashcards(
    text: string,
    filename: string
): Promise<InitialGenerationResult> { // Return specific type for Step 1
    if (!vertexAI) {
        throw new GenerationApiError("Vertex AI client is not initialized. Check configuration.");
    }
    if (!text || text.trim().length < 10) {
        console.warn(`[Generator Service - Step 1] Input text for ${filename} is too short or empty. Skipping generation.`);
        // Return a default structure indicating failure or empty state
        return { mode: 'knowledge', detectedQuestionLanguage: 'N/A', detectedAnswerLanguage: 'N/A', basicFlashcards: [] };
    }

    console.log(`[Generator Service - Step 1] Starting initial generation for: ${filename}`);

    const truncatedText = text.length > MAX_TEXT_CHARS_FOR_GEMINI
        ? text.slice(0, MAX_TEXT_CHARS_FOR_GEMINI) + `\n\n...(text truncated at ${MAX_TEXT_CHARS_FOR_GEMINI} characters for brevity)`
        : text;

    // --- Use Phase 1 Prompt (unchanged logic, just generating basic Q/A) ---
    const promptPhase1 = `
**Goal:** Analyze the provided text, determine the mode ('translation' or 'knowledge'), detect languages, generate basic question/answer flashcards, and prepare the output as structured JSON.

**Instructions:**

1.  **Analyze Content:** Read the text provided below under "Document Text". You are a teacher who is creating flashcards for his students.
2.  **Determine Mode & Languages:**
    *   Identify if the text is primarily a 'translation' list (pairs of words/phrases in different languages) or 'knowledge' text (prose, factual information in a single primary language). Assign 'translation' or 'knowledge' to the \`mode\` field.
    *   Detect the primary language used for the questions or source words. Assign this language name (e.g., 'English', 'German') to the \`detectedQuestionLanguage\` field.
    *   Detect the secondary/target language used for answers or translations. Assign this language name (e.g., 'Spanish', 'French') to the \`detectedAnswerLanguage\` field.
        *   If \`mode\` is 'translation', \`detectedAnswerLanguage\` should typically be different from \`detectedQuestionLanguage\`.
        *   If \`mode\` is 'knowledge', \`detectedAnswerLanguage\` must be the *same* as \`detectedQuestionLanguage\`.
3.  **Generate Basic Flashcards:** Create an array of flashcard objects for the \`flashcards\` field based on the determined mode:
    *   **If Mode is 'translation':**
        *   Create one flashcard object for each distinct word/phrase pair found in the text.
        *   Use the source language word/phrase for the \`question\` field.
        *   Use the target language word/phrase for the \`answer\` field.
    *   **If Mode is 'knowledge':**
        *   Generate multiple high-quality flashcards
        *   Aim for at least 2-3 per main topic or distinct paragraph.
        *   Create as many fashcards as needed in order for the reader to test whether he truly understands the text.
        *   Create a \`question\` that tests understanding or recall of a key concept from the text. Avoid trivial questions.
        *   Provide a concise (ideally under 100 words) and accurate \`answer\` derived directly from the text.
        *   Both \`question\` and \`answer\` must be in the \`detectedQuestionLanguage\`.
4.  **Format Output:** Structure your *entire response* as a single JSON object containing the \`mode\`, \`detectedQuestionLanguage\`, \`detectedAnswerLanguage\`, and \`flashcards\` fields. Each object within the \`flashcards\` array must contain only \`question\` and \`answer\` fields. Adhere strictly to this structure.

**Example \`flashcards\` array content for 'translation' mode:**
\`[ { "question": "la table", "answer": "the table" }, { "question": "le livre", "answer": "the book" }, { "question": "aller", "answer": "to go" } ]\`

**Example \`flashcards\` array content for 'knowledge' mode:**
\`[ { "question": "What is the primary function of the mitochondria?", "answer": "The primary function of mitochondria is to generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy." } ]\`

**Important Constraints:**
*   Your final output must be *only* the JSON object. Do not include any introductory text, explanations, or markdown formatting around the JSON.
*   Accurately determine the \`mode\` and languages based *only* on the provided text.
*   Ensure language consistency as described in step 2.
*   Strictly adhere to the output format. The \`flashcards\` array must only contain objects with \`question\` and \`answer\`.

**Document Text:**

"""
${truncatedText}
"""
`;

    // Type alias for clarity
    type Step1OutputType = { mode: 'translation' | 'knowledge', detectedQuestionLanguage: string, detectedAnswerLanguage: string, flashcards: GeminiFlashcardInputBasic[] };

    try {
        const step1Result = await callVertexAI<Step1OutputType>(promptPhase1, generationConfigBasic, filename, 'Step 1 - Initial Generation');

        // --- Validate Step 1 Response --- 
        if (!step1Result || typeof step1Result !== 'object' ||
            !step1Result.mode || typeof step1Result.mode !== 'string' || !['translation', 'knowledge'].includes(step1Result.mode) ||
            !step1Result.detectedQuestionLanguage || typeof step1Result.detectedQuestionLanguage !== 'string' ||
            !step1Result.detectedAnswerLanguage || typeof step1Result.detectedAnswerLanguage !== 'string' ||
            !Array.isArray(step1Result.flashcards))
        {
            console.error(`[Generator Service - Step 1] JSON for ${filename} does NOT match required base schema fields/types. Received:`, JSON.stringify(step1Result, null, 2));
            throw new GenerationApiError(`Step 1 AI response JSON base structure mismatch for ${filename}. Received: ${JSON.stringify(step1Result)}`);
        }

        for (const card of step1Result.flashcards) {
             if (typeof card !== 'object' || card === null ||
                 typeof card.question !== 'string' ||
                 typeof card.answer !== 'string')
             {
                 console.error(`[Generator Service - Step 1] Invalid flashcard structure within the array for ${filename}. Received card:`, JSON.stringify(card, null, 2));
                 throw new GenerationApiError(`Step 1 AI response flashcard structure mismatch for ${filename}.`);
             }
         }

        console.log(`[Generator Service - Step 1] successful for ${filename}. Mode: ${step1Result.mode}, QLang: ${step1Result.detectedQuestionLanguage}, ALang: ${step1Result.detectedAnswerLanguage}, Cards: ${step1Result.flashcards.length}`);

        // Return the structured result
        return {
            mode: step1Result.mode,
            detectedQuestionLanguage: step1Result.detectedQuestionLanguage,
            detectedAnswerLanguage: step1Result.detectedAnswerLanguage,
            basicFlashcards: step1Result.flashcards
        };

    } catch (error: any) {
        console.error(`[Generator Service - Step 1] Error during initial generation for ${filename}:`, error.message);
        if (error.stack) console.error(error.stack);
        if (error instanceof GenerationApiError) throw error;
        throw new GenerationApiError(`Unexpected error during Step 1 generation for ${filename}: ${error.message}`);
    }
}

/**
 * STEP 2 (Optional): Classifies grammatical properties for translation flashcards.
 * @param basicFlashcards Array of Q/A pairs from Step 1.
 * @param filename Original filename for logging.
 * @returns A promise resolving to an array of classification objects.
 */
export async function classifyTranslationFlashcards(
    basicFlashcards: GeminiFlashcardInputBasic[],
    filename: string
): Promise<GeminiFlashcardClassification[]> { 
    if (basicFlashcards.length === 0) {
        console.log(`[Generator Service - Step 2 Classify] No flashcards provided for classification for ${filename}.`);
        return [];
    }

    console.log(`[Generator Service - Step 2 Classify] Starting classification for ${basicFlashcards.length} cards from ${filename}.`);

    // Prepare input for Phase 2 prompt (same as before)
    const inputJsonForPhase2 = JSON.stringify(basicFlashcards, null, 2);
    // Use Phase 2 Prompt (same as before)
    const promptPhase2 = `
**Goal:** Perform grammatical classification (Part of Speech and Gender) for the provided list of translation flashcards.

**Input:** You are given a JSON array of flashcard objects, each containing a "question" (source word/phrase) and an "answer" (target word/phrase).

**Instructions:**

1.  **Analyze Each Flashcard:** For *each* object in the input array below:
    *   **a. Classify Question Word:** Identify the primary vocabulary word in the \`question\` field. Determine its Part of Speech (PoS) and Gender (if applicable).
    *   **b. Classify Answer Word:** Identify the primary vocabulary word in the \`answer\` field. Determine its Part of Speech (PoS) and Gender (if applicable).
2.  **Use Allowed Values:**
    *   **Part of Speech:** Use *only* one of: 'Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition', 'Interjection', 'Other', 'N/A'.
    *   **Gender:** Use *only* one of: 'Male', 'Female', 'Neuter', 'N/A'. Use 'N/A' if gender is linguistically irrelevant for the word/language (e.g., English nouns, verbs, adjectives) or cannot be reliably determined.
3.  **Format Output:** Structure your *entire response* as a single JSON object containing exactly one key: \`classifiedFlashcards\`. The value of this key must be an array of classification objects.
    *   This output array must have the *exact same number of elements* as the input flashcard array.
    *   Each object in the \`classifiedFlashcards\` array must correspond positionally to the object in the input array.
    *   Each classification object must contain the fields: \`questionPartOfSpeech\`, \`questionGender\`, \`answerPartOfSpeech\`, and \`answerGender\`, using the allowed values from step 2.

**Example Input Flashcards JSON:**
\`[ { "question": "la table", "answer": "the table" }, { "question": "bon", "answer": "good" }, { "question": "aller", "answer": "to go" } ]\`

**Example Corresponding Output JSON:**
\`{ "classifiedFlashcards": [ { "questionPartOfSpeech": "Noun", "questionGender": "Female", "answerPartOfSpeech": "Noun", "answerGender": "N/A" }, { "questionPartOfSpeech": "Adjective", "questionGender": "Male", "answerPartOfSpeech": "Adjective", "answerGender": "N/A" }, { "questionPartOfSpeech": "Verb", "questionGender": "N/A", "answerPartOfSpeech": "Verb", "answerGender": "N/A" } ] }\`

**Important Constraints:**
*   Your final output must be *only* the JSON object containing the \`classifiedFlashcards\` array. Do not include any introductory text, explanations, or markdown formatting.
*   The output array length *must* match the input array length.
*   Strictly adhere to the classification value lists provided.

**Input Flashcards JSON:**

"""json
${inputJsonForPhase2}
"""
`;

    try {
        // Type alias for clarity
        type Step2OutputType = { classifiedFlashcards: GeminiFlashcardClassification[] };
        const step2Result = await callVertexAI<Step2OutputType>(promptPhase2, generationConfigClassification, filename, 'Step 2 - Classification');

        // --- Log Raw Result --- 
        console.log(`[Generator Service - Step 2 Classify] Raw Result for ${filename}:`, JSON.stringify(step2Result, null, 2));

        // --- Validate Classification Response --- 
        if (!step2Result || typeof step2Result !== 'object' || !Array.isArray(step2Result.classifiedFlashcards)) {
            console.error(`[Generator Service - Step 2 Classify] JSON for ${filename} does NOT match required schema. Expected { classifiedFlashcards: [...] }. Received:`, JSON.stringify(step2Result, null, 2));
            throw new GenerationApiError(`Step 2 Classification AI response JSON structure mismatch for ${filename}.`);
        }

        // Log warning on count mismatch, but still return the data we got
        if (step2Result.classifiedFlashcards.length !== basicFlashcards.length) {
            console.warn(`[Generator Service - Step 2 Classify] Classification count mismatch for ${filename}. Expected ${basicFlashcards.length}, Received ${step2Result.classifiedFlashcards.length}. Proceeding with available data.`);
        }

        // Validate individual classification objects (optional but good practice)
        for (const classification of step2Result.classifiedFlashcards) {
             if (typeof classification !== 'object' || classification === null ||
                 typeof classification.questionPartOfSpeech !== 'string' ||
                 typeof classification.questionGender !== 'string' ||
                 typeof classification.answerPartOfSpeech !== 'string' ||
                 typeof classification.answerGender !== 'string')
             {
                 console.error(`[Generator Service - Step 2 Classify] Invalid classification structure for ${filename}. Received:`, JSON.stringify(classification, null, 2));
                 // Decide whether to throw or just skip/default this specific item
                 throw new GenerationApiError(`Step 2 Classification AI response contains invalid classification object structure for ${filename}.`);
             }
         }

        console.log(`[Generator Service - Step 2 Classify] successful for ${filename}. Classified ${step2Result.classifiedFlashcards.length} cards.`);
        return step2Result.classifiedFlashcards;

    } catch (error: any) {
        console.error(`[Generator Service - Step 2 Classify] Error during classification for ${filename}. Returning empty array. Error:`, error.message);
        if (error.stack) console.error(error.stack);
        // Return empty array on error, let downstream handle merging defaults
        return [];
    }
}

/**
 * STEP 2 (Alternative): Regenerates flashcards forcing knowledge mode.
 * @param text The original extracted text content.
 * @param filename The original filename (for context in logging/errors).
 * @returns A promise resolving to basic Q/A flashcards and detected languages.
 */
export async function regenerateAsKnowledgeFlashcards(
    text: string,
    filename: string
): Promise<{ detectedQuestionLanguage: string; detectedAnswerLanguage: string; basicFlashcards: GeminiFlashcardInputBasic[] }> { // Return similar structure to step 1, but mode is fixed
    if (!vertexAI) {
        throw new GenerationApiError("Vertex AI client is not initialized. Check configuration.");
    }
    if (!text || text.trim().length < 10) {
        console.warn(`[Generator Service - Step 2 Knowledge Regen] Input text for ${filename} is too short or empty. Skipping generation.`);
        return { detectedQuestionLanguage: 'N/A', detectedAnswerLanguage: 'N/A', basicFlashcards: [] };
    }

    console.log(`[Generator Service - Step 2 Knowledge Regen] Starting knowledge regeneration for: ${filename}`);

    const truncatedText = text.length > MAX_TEXT_CHARS_FOR_GEMINI
        ? text.slice(0, MAX_TEXT_CHARS_FOR_GEMINI) + `\n\n...(text truncated at ${MAX_TEXT_CHARS_FOR_GEMINI} characters for brevity)`
        : text;

    // --- Adapt the Phase 1 prompt for KNOWLEDGE mode generation ONLY ---
    // Define the prompt variable
    const promptKnowledge = `\n**Goal:** Analyze the provided text, determine its primary language, generate high-quality knowledge-based question/answer flashcards, and prepare the output as structured JSON in 'knowledge' mode.\n\n**Instructions:**\n\n1.  **Analyze Content:** Read the text provided below under \"Document Text\". You are a teacher creating flashcards for students based *only* on this text.\n2.  **Determine Language:**\n    *   Potentially the document contains multiple languages. Detect the  primary language used in the text content. Assign this language name (e.g., 'English', 'German') to *both* the \`detectedQuestionLanguage\` and \`detectedAnswerLanguage\` fields.\n3.  **Generate Knowledge Flashcards:** Create an array of flashcard objects for the \`flashcards\` field based on the text content:\n    *   Generate multiple high-quality flashcards.\n    *   Aim for at least 3-5 per main topic or distinct paragraph, or more if it is needed to capture the knowledge of a student for this paragraph.\n    *   Create as many flashcards as needed for a reader to test their understanding of the text.\n    *   Create a \`question\` that tests understanding or recall of a key concept, fact, or relationship explicitly described in the Document Text. Avoid trivial questions or questions about the generation process/metadata.\n    *   Provide a concise (ideally under 100 words) and accurate \`answer\` derived **directly and only from the Document Text**.\n    *   Both \`question\` and \`answer\` must be in the \`detectedQuestionLanguage\`.\n4.  **Set Mode:** The \`mode\` field in your output MUST be set to \"knowledge\".\n5.  **Format Output:** Structure your *entire response* as a single JSON object containing the \`mode\` (fixed as \"knowledge\"), \`detectedQuestionLanguage\`, \`detectedAnswerLanguage\` (same as question language), and \`flashcards\` fields. Each object within the \`flashcards\` array must contain only \`question\` and \`answer\` fields. Adhere strictly to this structure.\n\n**Example Output JSON (Knowledge Mode):**\n\`{ \"mode\": \"knowledge\", \"detectedQuestionLanguage\": \"English\", \"detectedAnswerLanguage\": \"English\", \"flashcards\": [ { \"question\": \"What is the primary function of the mitochondria?\", \"answer\": \"The primary function of mitochondria is to generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.\" }, { \"question\": \"Where does the Krebs cycle occur?\", \"answer\": \"The Krebs cycle occurs in the mitochondrial matrix.\" } ] }\`\n\n**Important Constraints:**\n*   Your final output must be *only* the JSON object. Do not include any introductory text, explanations, or markdown formatting around the JSON.\n*   The \`mode\` MUST be \"knowledge\".\n*   \`detectedAnswerLanguage\` MUST be identical to \`detectedQuestionLanguage\`.\n*   Flashcards must test understanding of the **provided Document Text content ONLY**.\n\n**Document Text:**\n\n\"\"\"\n${truncatedText}\n\"\"\"\n`;

    // Type alias for clarity (same structure as Step 1 output)
    // Define the type alias
    type KnowledgeRegenOutputType = { mode: 'knowledge', detectedQuestionLanguage: string, detectedAnswerLanguage: string, flashcards: GeminiFlashcardInputBasic[] };

    try {
        // --- Reduce logging verbosity for Step 2 prompt ---\
        // console.log(`[Generator Service - Step 2 Knowledge Regen] Full prompt for ${filename}:`);\
        // console.log("--- PROMPT START ---");\
        // console.log(promptKnowledge); // <-- Don't log the full prompt
        console.log(`[Generator Service - Step 2 Knowledge Regen] Preparing prompt for ${filename}. Text length being included: ${truncatedText.length}`);
        // ----------------------------------------------------\n\n        // Pass the correct prompt variable to callVertexAI\n        const knowledgeResult = await callVertexAI<KnowledgeRegenOutputType>(promptKnowledge, generationConfigBasic, filename, 'Step 2 - Knowledge Regen');\n\n        // --- Validate Knowledge Regen Response ---
        console.log("--- PROMPT END ---");
        console.log(`[Generator Service - Step 2 Knowledge Regen] Preparing prompt for ${filename}. Text length being included: ${truncatedText.length}`);
        // ----------------------------------------------------\n\n        // Pass the correct prompt variable to callVertexAI\n        const knowledgeResult = await callVertexAI<KnowledgeRegenOutputType>(promptKnowledge, generationConfigBasic, filename, 'Step 2 - Knowledge Regen');\n\n        // --- Validate Knowledge Regen Response ---

        // Add log to inspect the full prompt being sent (Corrected Syntax)
        console.log(`[Generator Service - Step 2 Knowledge Regen] Full prompt for ${filename}:`);
        console.log("--- PROMPT START ---");
        console.log(promptKnowledge);
        console.log("--- PROMPT END ---");
        // Pass the correct prompt variable to callVertexAI
        const knowledgeResult = await callVertexAI<KnowledgeRegenOutputType>(promptKnowledge, generationConfigBasic, filename, 'Step 2 - Knowledge Regen');

        // --- Validate Knowledge Regen Response ---
        if (!knowledgeResult || typeof knowledgeResult !== 'object' ||
            knowledgeResult.mode !== 'knowledge' || // Mode MUST be knowledge
            !knowledgeResult.detectedQuestionLanguage || typeof knowledgeResult.detectedQuestionLanguage !== 'string' ||
            !knowledgeResult.detectedAnswerLanguage || typeof knowledgeResult.detectedAnswerLanguage !== 'string' ||
            knowledgeResult.detectedQuestionLanguage !== knowledgeResult.detectedAnswerLanguage || // Languages MUST match
            !Array.isArray(knowledgeResult.flashcards))
        {
            console.error(`[Generator Service - Step 2 Knowledge Regen] JSON for ${filename} does NOT match required knowledge schema. Received:`, JSON.stringify(knowledgeResult, null, 2));
            throw new GenerationApiError(`Step 2 Knowledge Regen AI response JSON structure/content mismatch for ${filename}. Received: ${JSON.stringify(knowledgeResult)}`);
        }

        // Validate individual flashcards (same as step 1)
        for (const card of knowledgeResult.flashcards) {
             if (typeof card !== 'object' || card === null ||
                 typeof card.question !== 'string' ||
                 typeof card.answer !== 'string')
             {
                 console.error(`[Generator Service - Step 2 Knowledge Regen] Invalid flashcard structure for ${filename}. Received card:`, JSON.stringify(card, null, 2));
                 throw new GenerationApiError(`Step 2 Knowledge Regen AI response flashcard structure mismatch for ${filename}.`);
             }
         }

        console.log(`[Generator Service - Step 2 Knowledge Regen] successful for ${filename}. QLang: ${knowledgeResult.detectedQuestionLanguage}, Cards: ${knowledgeResult.flashcards.length}`);

        // Return the relevant parts
        return {
            detectedQuestionLanguage: knowledgeResult.detectedQuestionLanguage,
            detectedAnswerLanguage: knowledgeResult.detectedAnswerLanguage, // Will be same as QLang
            basicFlashcards: knowledgeResult.flashcards
        };

    } catch (error: any) {
        console.error(`[Generator Service - Step 2 Knowledge Regen] Error during knowledge regeneration for ${filename}:`, error.message);
        if (error.stack) console.error(error.stack);
        if (error instanceof GenerationApiError) throw error;
        throw new GenerationApiError(`Unexpected error during Step 2 Knowledge Regen for ${filename}: ${error.message}`);
    }
}

// Removed the old monolithic generateFlashcards function