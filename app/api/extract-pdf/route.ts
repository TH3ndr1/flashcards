// app/api/extract-pdf/route.ts
/**
 * API Route Handler for extracting text from PDF/Image files
 * and generating flashcards using AI.
 * Orchestrates calls to text extraction and flashcard generation services.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getFileFromStorage } from '@/lib/actions/storageActions';
// --- FIX: Import PAGE_LIMIT ---
import { validateConfiguration, GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, GCP_PRIVATE_KEY, PAGE_LIMIT } from './config';
import { getSupportedFileType, SupportedFileType } from './fileUtils';
import { extractText } from './textExtractorService';
import { generateFlashcards } from './flashcardGeneratorService';
import { ApiFlashcard, SkippedFile, PageLimitExceededError, ExtractionApiError, GenerationApiError } from './types';

// --- Runtime Configuration (Vercel specific) ---
export const config = {
  runtime: 'nodejs',
  regions: ['iad1'],
  maxDuration: 90,
  api: {
    bodyParser: {
      sizeLimit: '26mb'
    }
  }
};

// --- API Handlers ---

// GET Handler (No changes needed)
export async function GET(request: NextRequest) {
  if (!validateConfiguration()) {
    return NextResponse.json({
        message: 'API is potentially misconfigured. Check server logs.',
        status: 'error',
        timestamp: new Date().toISOString()
    }, { status: 500 });
  }
  return NextResponse.json({
    message: 'Flashcard generation API is active. Use POST method to process files.',
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

// OPTIONS Handler (No changes needed)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}


// POST Handler
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[API Route POST] Request received at ${new Date(startTime).toISOString()}`);

  // Runtime Credential/Config Check (No changes needed)
  if (!GCP_PROJECT_ID || !GCP_SERVICE_ACCOUNT_EMAIL || !GCP_PRIVATE_KEY) {
      console.error('[API Route POST] CRITICAL: Missing required GCP credentials. Aborting.');
      return NextResponse.json({ 
          success: false, message: 'Server configuration error: Missing necessary credentials.', code: 'MISSING_CREDENTIALS'
      }, { status: 500 });
  }
   if (!validateConfiguration()) {
       console.error('[API Route POST] CRITICAL: Core configuration validation failed. Aborting.');
       return NextResponse.json({
           success: false, message: 'Server configuration error: Invalid or missing configuration.', code: 'INVALID_CONFIG'
      }, { status: 500 });
    }
    
  // Initialization (No changes needed)
    let skippedFiles: SkippedFile[] = [];
  let allFlashcards: ApiFlashcard[] = [];
  let allResultsInfo: { filename: string; type: SupportedFileType; pages: number; characters: number; flashcardsGenerated: number }[] = [];
  let totalPagesProcessed = 0;
  let combinedTextPreview = "";

  try {
    const contentType = request.headers.get('content-type') || '';

    // File Processing Logic (No changes needed in setup)
    interface FileSource {
        filename: string;
        getBuffer: () => Promise<ArrayBuffer>;
        fileTypeHint?: string;
    }
    let fileSources: FileSource[] = [];

    // 1. Determine File Sources (No changes needed here)
    if (contentType.includes('application/json')) {
      const jsonData = await request.json();
      const fileReferences = jsonData.files as { filename: string, filePath: string }[];
      if (!fileReferences || !Array.isArray(fileReferences) || fileReferences.length === 0) {
            return NextResponse.json({ success: false, message: 'Invalid or empty file list provided in JSON request', code: 'INVALID_INPUT' }, { status: 400 });
        }
        console.log(`[API Route POST] Processing ${fileReferences.length} files from storage paths via JSON payload.`);
        fileSources = fileReferences.map(ref => ({
            filename: ref.filename,
            getBuffer: async () => {
                console.log(`[API Route POST] Fetching buffer for ${ref.filename} from storage path ${ref.filePath}`);
                const buffer = await getFileFromStorage(ref.filePath);
                if (!buffer || buffer.byteLength === 0) throw new Error(`File not found or empty in storage at path: ${ref.filePath}`);
                return buffer;
            }
        }));
    } else if (contentType.includes('multipart/form-data')) {
        console.log('[API Route POST] Handling multipart/form-data request.');
        const formData = await request.formData();
        const files = formData.getAll('file') as File[];
        if (!files || files.length === 0) {
            return NextResponse.json({ success: false, message: 'No files provided in form-data', code: 'NO_FILES' }, { status: 400 });
        }
        console.log(`[API Route POST] Received ${files.length} file(s) from FormData.`);
        fileSources = files.map((file, i) => ({
            filename: file.name || `Unnamed File ${i+1}`,
            getBuffer: async () => {
                if (!file.name || file.size === 0 || typeof file.arrayBuffer !== 'function') throw new Error('Invalid file data (missing name, zero size, or methods)');
                return file.arrayBuffer();
            },
            fileTypeHint: file.type
        }));
    } else {
        console.warn(`[API Route POST] Received request with unsupported content type: ${contentType}`);
        return NextResponse.json({ success: false, message: `Unsupported content type: ${contentType}. Please use application/json or multipart/form-data.`, code: 'UNSUPPORTED_CONTENT_TYPE'}, { status: 415 });
    }

    // 2. Process Each File Source Sequentially
    for (const source of fileSources) {
        const fileStartTime = Date.now();
        console.log(`[API Route POST] Processing file: ${source.filename}`);
        let fileBuffer: ArrayBuffer | null = null;
        let fileType: SupportedFileType | null = null;

        try {
            // Steps a, b, c, d, e (No changes needed here)
            fileType = getSupportedFileType(source.filename);
            if (!fileType) throw new Error('Unsupported file type');
            fileBuffer = await source.getBuffer();
            console.log(`[API Route POST] Attempting text extraction for ${source.filename} (Type: ${fileType})`);
            const extractionResult = await extractText(fileBuffer, source.filename, fileType);
            console.log(`[API Route POST] Text extraction successful for ${source.filename}. Characters: ${extractionResult.info.metadata.characters}, Pages: ${extractionResult.info.pages}`);
            totalPagesProcessed += extractionResult.info.pages;
            combinedTextPreview += `--- Content from ${source.filename} ---\n${extractionResult.text.slice(0, 200)}...\n\n`;
            let generatedFlashcards: ApiFlashcard[] = [];
            if (extractionResult.text && extractionResult.text.trim().length > 0) {
                console.log(`[API Route POST] Attempting flashcard generation for ${source.filename}`);
                const coreFlashcards = await generateFlashcards(extractionResult.text, source.filename);
                generatedFlashcards = coreFlashcards.map(card => ({ ...card, source: source.filename, fileType: fileType! }));
                allFlashcards.push(...generatedFlashcards);
                console.log(`[API Route POST] Generated ${generatedFlashcards.length} flashcards for ${source.filename}.`);
            } else {
                 console.log(`[API Route POST] Skipping flashcard generation for ${source.filename} due to empty extracted text.`);
            }
            allResultsInfo.push({
                filename: source.filename,
                type: fileType,
                pages: extractionResult.info.pages,
                characters: extractionResult.info.metadata.characters,
                flashcardsGenerated: generatedFlashcards.length,
            });
            console.log(`[API Route POST] Successfully processed ${source.filename}. Time: ${Date.now() - fileStartTime}ms`);

        } catch (error: any) {
            console.error(`[API Route POST] Error processing file ${source.filename}: ${error.message}`);
            let reason = error.message || 'Unknown processing error';
            let pages: number | undefined = undefined;

            // --- FIX: Correctly handle PageLimitExceededError properties ---
            if (error instanceof PageLimitExceededError) {
                // Use the properties from the error object and the imported constant
                reason = `Exceeds ${error.limit}-page limit (${error.pageCount} pages)`;
                pages = error.pageCount;
            }
            // Keep other error handling as is
            else if (error instanceof ExtractionApiError || error instanceof GenerationApiError) {
                reason = `${error.name}: ${error.message.substring(0, 200)}${error.message.length > 200 ? '...' : ''}`;
                 if (error instanceof GenerationApiError && error.reason) {
                     reason += ` (Reason: ${error.reason})`;
                 }
            } else if (reason.includes('Invalid file data')) {
                 reason = 'Invalid file data provided';
            } else if (reason === 'Unsupported file type') {
                // Keep reason as is
            } else if (reason.includes('storage')) {
                 reason = `Storage access error: ${reason.substring(0,150)}...`;
            } else {
                 reason = `Processing error: ${reason.substring(0,150)}...`;
            }

            skippedFiles.push({ filename: source.filename, pages: pages, reason: reason });
            continue;
        }
    }

    // Final Response Aggregation (No changes needed here)
    const endTime = Date.now();
    const duration = endTime - startTime;
    const processedCount = allResultsInfo.length;
    const skippedCount = skippedFiles.length;
    console.log(`[API Route POST] Processing finished. Duration: ${duration}ms. Processed: ${processedCount}, Skipped: ${skippedCount}, Total Flashcards: ${allFlashcards.length}`);

    if (processedCount === 0) {
        let message = 'No files could be processed successfully.';
        let status = 400;
        let code = 'PROCESSING_FAILED';
        if (skippedCount === 1 && skippedFiles[0].reason.includes('Exceeds 30-page limit')) {
            message = `File "${skippedFiles[0].filename}" exceeds the 30-page limit (${skippedFiles[0].pages} pages). No other files were processed.`;
            code = 'PAGE_LIMIT_EXCEEDED';
        } else if (skippedCount > 0) {
            message = `Processed 0 files successfully. ${skippedCount} file(s) were skipped. See 'skippedFiles' for details.`;
        }
        return NextResponse.json({
            success: false, message, code, skippedFiles, flashcards: [], fileInfo: { pages: 0, files: 0, metadata: { sources: [] } },
        }, { status });
    }

    const finalFileInfo = {
        pages: totalPagesProcessed, files: processedCount, metadata: { sources: allResultsInfo }
    };
        
    return NextResponse.json({
      success: true,
        message: `Successfully processed ${processedCount} file(s) and generated ${allFlashcards.length} flashcards. ${skippedCount} file(s) skipped.`,
        extractedTextPreview: combinedTextPreview.length > 1000 ? combinedTextPreview.slice(0, 1000) + "..." : combinedTextPreview,
        fileInfo: finalFileInfo,
      flashcards: allFlashcards,
        skippedFiles: skippedCount > 0 ? skippedFiles : undefined,
        processingTimeMs: duration
    });

  } catch (error: any) {
    // Global Error Handler (No changes needed)
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[API Route POST] UNHANDLED ERROR after ${duration}ms:`, error);
    let message = 'An unexpected server error occurred.';
    let code = 'INTERNAL_SERVER_ERROR';
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
        message = 'Invalid JSON received in request body.';
        code = 'INVALID_JSON_INPUT';
    } else if (error.message) {
        message = `Unhandled server error: ${error.message}`;
    }
    return NextResponse.json({
        success: false, message: message, code: code, processingTimeMs: duration,
        skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined,
    }, { status: 500 });
  }
} 