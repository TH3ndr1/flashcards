// app/api/extract-pdf/textExtractorService.ts
/**
 * Service responsible for extracting text from PDF and Image files
 * using appropriate GCP services or libraries.
 */
import { PDFDocument } from 'pdf-lib';
import { docAIClient, visionClient } from './gcpClients';
// --- FIX: Import PAGE_LIMIT and add DOCAI_OCR_PAGE_LIMIT ---
import { PAGE_LIMIT, DOCAI_OCR_PAGE_LIMIT, DOCAI_PROCESSOR_ID, GCP_PROJECT_ID, DOCAI_LOCATION } from './config'; // Assume DOCAI_OCR_PAGE_LIMIT=15 is added
import { SupportedFileType, getMimeTypeFromFilename } from './fileUtils';
import { ExtractionResult, PageLimitExceededError, ExtractionApiError } from './types';
import { appLogger, statusLogger } from '@/lib/logger';

/**
 * Performs a pre-check on a PDF buffer to count pages.
 * Throws PageLimitExceededError if the absolute limit is surpassed.
 * @param fileBuffer The ArrayBuffer of the PDF file.
 * @param filename The name of the file (for error reporting).
 * @returns The page count if within the limit.
 */
async function checkPdfPageCount(fileBuffer: ArrayBuffer, filename: string): Promise<number> {
    appLogger.info(`[Text Extractor] Performing pdf-lib page count check for: ${filename}`);
    try {
        const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();

        // --- Throw only if > absolute PAGE_LIMIT (e.g., 30) ---
        if (pageCount > PAGE_LIMIT) {
            appLogger.warn(`[Text Extractor] PDF "${filename}" has ${pageCount} pages, exceeding the absolute ${PAGE_LIMIT}-page limit.`);
            throw new PageLimitExceededError(
                `Exceeds absolute ${PAGE_LIMIT}-page limit (${pageCount} pages)`, // Updated message
                filename,
                pageCount,
                PAGE_LIMIT
            );
        }

        appLogger.info(`[Text Extractor] pdf-lib check complete for ${filename}: ${pageCount} pages (within absolute limit).`);
        return pageCount;
    } catch (error: any) {
        if (error instanceof PageLimitExceededError) {
            throw error; // Re-throw specific error
        }
        appLogger.error(`[Text Extractor] pdf-lib processing error for ${filename}:`, error.message);
        if (error.message.includes('Invalid PDF structure') || error.message.includes('not a PDF')) {
            throw new ExtractionApiError(`Invalid or corrupted PDF file (${filename}).`);
        }
        throw new ExtractionApiError(`Failed to process PDF metadata with pdf-lib: ${error.message}`);
    }
}

// extractTextFromImageVisionAI (No changes needed here)
async function extractTextFromImageVisionAI(fileBuffer: ArrayBuffer, filename: string): Promise<ExtractionResult> {
    if (!visionClient) {
        throw new ExtractionApiError("Vision AI client is not initialized. Check configuration.");
    }
    const buffer = Buffer.from(fileBuffer);
    appLogger.info(`[Text Extractor] Starting Vision AI extraction for IMAGE: ${filename}...`);
    try {
        const [result] = await visionClient.documentTextDetection({
            image: { content: buffer.toString('base64') }
        });
        const extractedText = result.fullTextAnnotation?.text || '';
        if (!extractedText && result.error?.message) {
             appLogger.warn(`[Text Extractor] Vision AI returned error for IMAGE ${filename}: ${result.error.message}`);
             throw new ExtractionApiError(`Vision AI error: ${result.error.message}`);
        }
         if (!extractedText) {
            appLogger.warn(`[Text Extractor] Vision AI returned no text detections for IMAGE ${filename}`);
            return {
                 text: "",
                 info: { pages: 0, metadata: { source: 'Vision AI', characters: 0, note: 'No text detected.' } }
             };
        }

        const detectedLanguageCodes = new Set<string>();
        if (result.fullTextAnnotation?.pages) {
            for (const page of result.fullTextAnnotation.pages) {
                if (page.property?.detectedLanguages) {
                    for (const lang of page.property.detectedLanguages) {
                        if (lang.languageCode) detectedLanguageCodes.add(lang.languageCode);
                    }
                }
            }
        }
        if (detectedLanguageCodes.size === 0 && result.textAnnotations && result.textAnnotations.length > 0) {
            for (const annotation of result.textAnnotations) {
                if (annotation.locale) detectedLanguageCodes.add(annotation.locale);
            }
        }

        appLogger.info(`[Text Extractor] Vision AI detected language codes for ${filename}:`, Array.from(detectedLanguageCodes));
        const characterCount = extractedText.length;
        const pageCount = result.fullTextAnnotation?.pages?.length || 1;
        appLogger.info(`[Text Extractor] Vision AI extraction complete for IMAGE ${filename}, extracted ${characterCount} characters from ${pageCount} page(s).`);

        return {
            text: extractedText,
            info: {
                pages: pageCount,
                metadata: {
                    source: 'Vision AI',
                    characters: characterCount,
                    detectedLanguages: Array.from(detectedLanguageCodes)
                }
            }
        };
    } catch (error: any) {
        appLogger.error(`[Text Extractor] Vision AI extraction error for IMAGE ${filename}:`, error.message);
        throw new ExtractionApiError(`Vision AI failed for ${filename}: ${error.message}`);
    }
}


// extractTextFromPdfDocAI (MODIFIED to handle imageless mode)
async function extractTextFromPdfDocAI(fileBuffer: ArrayBuffer, filename: string, initialPageCount: number): Promise<ExtractionResult> {
    if (!docAIClient) {
        throw new ExtractionApiError("Document AI client is not initialized. Check configuration.");
    }
     if (!GCP_PROJECT_ID || !DOCAI_LOCATION || !DOCAI_PROCESSOR_ID) {
         throw new ExtractionApiError("Document AI configuration (Project ID, Location, Processor ID) is incomplete.");
     }
     // --- Use the imported constant --- 
     if (typeof DOCAI_OCR_PAGE_LIMIT === 'undefined') { // Check if it was actually imported
        appLogger.warn('[Text Extractor] DOCAI_OCR_PAGE_LIMIT not defined in config, defaulting to 15.');
     }
     const ocrLimit = DOCAI_OCR_PAGE_LIMIT ?? 15; // Use imported constant or default
     // --------------------------------------

    appLogger.info(`[Text Extractor] Starting Document AI extraction for PDF: ${filename} (${initialPageCount} pages)`);
    const processorName = `projects/${GCP_PROJECT_ID}/locations/${DOCAI_LOCATION}/processors/${DOCAI_PROCESSOR_ID}`;
    const buffer = Buffer.from(fileBuffer);

    // --- Determine Process Options based on page count --- 
    let processOptions = {};
    let mode = 'Standard OCR';
    if (initialPageCount > ocrLimit && initialPageCount <= PAGE_LIMIT) {
        mode = 'Imageless (Native PDF Parsing)';
        processOptions = {
             ocrConfig: { enableNativePdfParsing: true }
        };
        appLogger.info(`[Text Extractor] Using Imageless mode for ${filename} (${initialPageCount} pages > ${ocrLimit})`);
    } else {
        appLogger.info(`[Text Extractor] Using Standard OCR mode for ${filename} (${initialPageCount} pages <= ${ocrLimit})`);
        // No specific options needed for standard, or explicitly set:
        // processOptions = { ocrConfig: { enableNativePdfParsing: false } }; 
    }
    // ----------------------------------------------------

    const request = {
        name: processorName,
        rawDocument: {
            content: buffer.toString('base64'),
            mimeType: 'application/pdf',
        },
        processOptions: processOptions, // Add the determined options
    };

    try {
        appLogger.info(`[Text Extractor] Sending Document AI request (${mode} mode) to processor: ${processorName}`);
        const [result] = await docAIClient.processDocument(request);
        appLogger.info(`[Text Extractor] Document AI request completed successfully (${mode} mode)`);

        const { document } = result;

        if (!document || !document.text) {
            // Handle cases where no text is returned (remains the same)
            appLogger.warn(`[Text Extractor] Document AI returned no text for PDF ${filename} (${mode} mode). Response status: ${result.document?.error?.message || 'N/A'}`);
             return {
                 text: "",
                 info: { pages: initialPageCount, metadata: { source: `Document AI (${mode})`, characters: 0, note: 'No text detected.' } }
             };
        }

        // Language detection (remains the same)
        const detectedLanguageCodes = new Set<string>();
        if (document.pages && document.pages.length > 0) {
            for (const page of document.pages) {
                if (page.detectedLanguages && page.detectedLanguages.length > 0) {
                    for (const lang of page.detectedLanguages) {
                        if (lang.languageCode) detectedLanguageCodes.add(lang.languageCode);
                    }
                }
            }
        }

        appLogger.info(`[Text Extractor] Document AI detected language codes for ${filename}:`, Array.from(detectedLanguageCodes));
        const extractedText = document.text;
        const characterCount = extractedText.length;
        const pageCount = document.pages?.length || initialPageCount;
        appLogger.info(`[Text Extractor] Document AI extraction complete for PDF ${filename} (${mode} mode), extracted ${characterCount} characters from ${pageCount} pages.`);

        return {
            text: extractedText,
            info: {
                pages: pageCount,
                metadata: {
                    source: `Document AI (${mode})`, // Include mode in metadata
                    characters: characterCount,
                    detectedLanguages: Array.from(detectedLanguageCodes)
                }
            }
        };
    } catch (error: any) {
        // Error handling (remains largely the same)
        appLogger.error(`[Text Extractor] Document AI extraction error (${mode} mode) for PDF ${filename}:`, JSON.stringify(error, null, 2));

         // --- ADD Specific Check for Google API Page Limit Error ---
         // Google API uses code 3 (INVALID_ARGUMENT) for various issues,
         // but specifically includes PAGE_LIMIT_EXCEEDED details for this case.
         if (error.code === 3 && (error.details?.includes('limit: 15 got 16') || error.details?.includes('page limit'))) {
             // Attempt to extract the actual page count from the error details if possible
             const match = error.details?.match(/got (\d+)/);
             const reportedPageCount = match ? parseInt(match[1], 10) : initialPageCount;
             appLogger.warn(`[Text Extractor] Detected Document AI page limit error for ${filename}. Reported pages: ${reportedPageCount}, Limit: 15 (for standard OCR)`);
             // Throw OUR custom error type, using the configured OCR limit
             throw new PageLimitExceededError(
                 `Exceeds Document AI OCR page limit (${ocrLimit} pages)`,
                 filename,
                 reportedPageCount,
                 ocrLimit
             );
         }
         // ------------------------------------------------------

         if (error.message.includes('Deadline Exceeded') || error.code === 4) {
             throw new ExtractionApiError(`Document AI request timed out for ${filename} (${mode} mode).`);
         }
         // --- INVALID_ARGUMENT might now indicate a non-digital PDF in imageless mode ---
         if (error.code === 3) { // Keep this generic check AFTER the specific page limit check
            let detail = `Document AI: Invalid argument. Ensure ${filename} is a valid PDF.`;
            if (mode === 'Imageless (Native PDF Parsing)') {
                detail += ` Or, the PDF might not be suitable for imageless mode (e.g., scanned).`;
            }
             throw new ExtractionApiError(detail);
         }
         // ------------------------------------------------------------------------------
         if (error.message.includes('PERMISSION_DENIED') || error.details?.includes('permission')) {
             throw new ExtractionApiError(`Document AI: Permission denied. Check service account roles.`);
         }
         if (error.message.includes('NOT_FOUND')) {
             throw new ExtractionApiError(`Document AI: Processor not found. Verify Processor ID/Location.`);
         }
        throw new ExtractionApiError(`Document AI failed for ${filename} (${mode} mode): ${error.message}`);
    }
}


// extractText (main service function - no changes needed here)
export async function extractText(
    fileBuffer: ArrayBuffer,
    filename: string,
    fileType: SupportedFileType
): Promise<ExtractionResult> {
    if (fileType === 'pdf') {
        const pageCount = await checkPdfPageCount(fileBuffer, filename); // Now only throws if > PAGE_LIMIT
        // Pass pageCount to DocAI function to determine mode
        return await extractTextFromPdfDocAI(fileBuffer, filename, pageCount);
    } else if (fileType === 'image') {
        return await extractTextFromImageVisionAI(fileBuffer, filename);
    } else {
        appLogger.error(`[Text Extractor] Called with unsupported file type for filename: ${filename}`);
        throw new ExtractionApiError(`Unsupported file type provided to extraction service for ${filename}.`);
    }
}