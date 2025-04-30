/**
 * API Route Handler for processing the second step of AI generation:
 * - Classifying grammar for translation flashcards.
 * - Regenerating flashcards forcing knowledge mode.
 */
import { NextRequest, NextResponse } from 'next/server';
import { validateConfiguration, GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, GCP_PRIVATE_KEY } from '../extract-pdf/config'; // Reuse config validation
import {
    classifyTranslationFlashcards,
    regenerateAsKnowledgeFlashcards,
    InitialGenerationResult // Needed for the return type of knowledge regen
} from '../extract-pdf/flashcardGeneratorService';
import { GenerationApiError } from '../extract-pdf/types';

// --- Request Body Types --- 
interface ClassifyPayload {
    action: 'classify';
    filename: string;
    basicFlashcards: { question: string; answer: string }[];
}

interface ForceKnowledgePayload {
    action: 'force_knowledge';
    filename: string;
    originalText: string; // Client needs to send the original text back
}

type RequestPayload = ClassifyPayload | ForceKnowledgePayload;

// --- Runtime Configuration (same as extract-pdf) ---
export const config = {
  runtime: 'nodejs',
  regions: ['iad1'], // Adjust if needed
  maxDuration: 90, // Adjust if needed, knowledge regen might take time
};

// --- API Handler --- 

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    console.log(`[API Route Step2 POST] Request received at ${new Date(startTime).toISOString()}`);

    // --- Runtime Credential/Config Check --- 
    if (!GCP_PROJECT_ID || !GCP_SERVICE_ACCOUNT_EMAIL || !GCP_PRIVATE_KEY) {
        console.error('[API Route Step2 POST] CRITICAL: Missing required GCP credentials. Aborting.');
        return NextResponse.json({ success: false, message: 'Server configuration error: Missing necessary credentials.', code: 'MISSING_CREDENTIALS' }, { status: 500 });
    }
    if (!validateConfiguration()) {
        console.error('[API Route Step2 POST] CRITICAL: Core configuration validation failed. Aborting.');
        return NextResponse.json({ success: false, message: 'Server configuration error: Invalid or missing configuration.', code: 'INVALID_CONFIG' }, { status: 500 });
    }

    try {
        // --- Parse and Validate Payload --- 
        let payload: RequestPayload;
        try {
            payload = await request.json();
        } catch (e) {
            return NextResponse.json({ success: false, message: 'Invalid JSON payload.', code: 'INVALID_JSON' }, { status: 400 });
        }

        if (!payload.action || !payload.filename) {
            return NextResponse.json({ success: false, message: 'Missing required fields: action, filename.', code: 'INVALID_PAYLOAD' }, { status: 400 });
        }

        console.log(`[API Route Step2 POST] Processing action: ${payload.action} for file: ${payload.filename}`);

        // --- Execute Action --- 
        if (payload.action === 'classify') {
            if (!Array.isArray(payload.basicFlashcards)) {
                return NextResponse.json({ success: false, message: 'Missing or invalid basicFlashcards for classify action.', code: 'INVALID_PAYLOAD' }, { status: 400 });
            }
            
            console.log(`[API Route Step2 POST] Calling classifyTranslationFlashcards for ${payload.basicFlashcards.length} cards.`);
            const classifications = await classifyTranslationFlashcards(payload.basicFlashcards, payload.filename);
            const duration = Date.now() - startTime;
            console.log(`[API Route Step2 POST] Classification finished for ${payload.filename}. Duration: ${duration}ms. Results: ${classifications.length}`);
            
            return NextResponse.json({
                success: true,
                action: 'classify',
                data: classifications, // Array of classification objects
                processingTimeMs: duration
            });

        } else if (payload.action === 'force_knowledge') {
            if (typeof payload.originalText !== 'string') {
                return NextResponse.json({ success: false, message: 'Missing or invalid originalText for force_knowledge action.', code: 'INVALID_PAYLOAD' }, { status: 400 });
            }

            console.log(`[API Route Step2 POST] Calling regenerateAsKnowledgeFlashcards.`);
            const knowledgeResult = await regenerateAsKnowledgeFlashcards(payload.originalText, payload.filename);
            const duration = Date.now() - startTime;
            console.log(`[API Route Step2 POST] Knowledge regeneration finished for ${payload.filename}. Duration: ${duration}ms. Cards: ${knowledgeResult.basicFlashcards.length}`);

            // Return structure should match client expectation for merging
            return NextResponse.json({
                success: true,
                action: 'force_knowledge',
                data: { // Send back structure similar to InitialGenerationResult but without mode
                    detectedQuestionLanguage: knowledgeResult.detectedQuestionLanguage,
                    detectedAnswerLanguage: knowledgeResult.detectedAnswerLanguage,
                    basicFlashcards: knowledgeResult.basicFlashcards
                },
                processingTimeMs: duration
            });

        } else {
            return NextResponse.json({ success: false, message: `Invalid action specified: ${payload.action}. Must be 'classify' or 'force_knowledge'.`, code: 'INVALID_ACTION' }, { status: 400 });
        }

    } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        console.error(`[API Route Step2 POST] UNHANDLED ERROR after ${duration}ms:`, error);
        
        let message = 'An unexpected server error occurred during Step 2 processing.';
        let code = 'INTERNAL_SERVER_ERROR';
        if (error instanceof GenerationApiError) {
            message = `AI Generation Error (Step 2): ${error.message}`;
            code = 'GENERATION_ERROR';
        } else if (error.message) {
            message = `Unhandled server error (Step 2): ${error.message}`;
        }

        return NextResponse.json({
            success: false, 
            message: message, 
            code: code, 
            processingTimeMs: duration
        }, { status: 500 });
    }
} 