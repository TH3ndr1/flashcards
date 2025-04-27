// app/api/extract-pdf/textExtractorService.ts
/**
 * Service responsible for extracting text from PDF and Image files
 * using appropriate GCP services or libraries.
 */
import { PDFDocument } from 'pdf-lib';
import { docAIClient, visionClient } from './gcpClients';
// --- FIX: Import PAGE_LIMIT ---
import { PAGE_LIMIT, DOCAI_PROCESSOR_ID, GCP_PROJECT_ID, DOCAI_LOCATION } from './config';
import { SupportedFileType, getMimeTypeFromFilename } from './fileUtils';
import { ExtractionResult, PageLimitExceededError, ExtractionApiError } from './types';

/**
 * Performs a pre-check on a PDF buffer to count pages.
 * Throws PageLimitExceededError if the limit is surpassed.
 * @param fileBuffer The ArrayBuffer of the PDF file.
 * @param filename The name of the file (for error reporting).
 * @returns The page count if within the limit.
 */
async function checkPdfPageCount(fileBuffer: ArrayBuffer, filename: string): Promise<number> {
    console.log(`[Text Extractor] Performing pdf-lib page count check for: ${filename}`);
    try {
        const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        const pageCount = pdfDoc.getPageCount();

        if (pageCount > PAGE_LIMIT) {
            console.warn(`[Text Extractor] PDF "${filename}" has ${pageCount} pages, exceeding the ${PAGE_LIMIT}-page limit.`);
            // --- FIX: Pass PAGE_LIMIT to the error constructor ---
            throw new PageLimitExceededError(
                `Exceeds ${PAGE_LIMIT}-page limit (${pageCount} pages)`,
                filename,
                pageCount,
                PAGE_LIMIT // Pass the limit
            );
        }

        console.log(`[Text Extractor] pdf-lib check complete for ${filename}: ${pageCount} pages (within limit).`);
        return pageCount;
    } catch (error: any) {
        if (error instanceof PageLimitExceededError) {
            throw error; // Re-throw specific error
        }
        console.error(`[Text Extractor] pdf-lib processing error for ${filename}:`, error.message);
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
    console.log(`[Text Extractor] Starting Vision AI extraction for IMAGE: ${filename}...`);
    try {
        const [result] = await visionClient.documentTextDetection({
            image: { content: buffer.toString('base64') }
        });
        const extractedText = result.fullTextAnnotation?.text || '';
        if (!extractedText && result.error?.message) {
             console.warn(`[Text Extractor] Vision AI returned error for IMAGE ${filename}: ${result.error.message}`);
             throw new ExtractionApiError(`Vision AI error: ${result.error.message}`);
        }
         if (!extractedText) {
            console.warn(`[Text Extractor] Vision AI returned no text detections for IMAGE ${filename}`);
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

        console.log(`[Text Extractor] Vision AI detected language codes for ${filename}:`, Array.from(detectedLanguageCodes));
        const characterCount = extractedText.length;
        const pageCount = result.fullTextAnnotation?.pages?.length || 1;
        console.log(`[Text Extractor] Vision AI extraction complete for IMAGE ${filename}, extracted ${characterCount} characters from ${pageCount} page(s).`);

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
        console.error(`[Text Extractor] Vision AI extraction error for IMAGE ${filename}:`, error.message);
        throw new ExtractionApiError(`Vision AI failed for ${filename}: ${error.message}`);
    }
}


// extractTextFromPdfDocAI (No changes needed here)
async function extractTextFromPdfDocAI(fileBuffer: ArrayBuffer, filename: string, initialPageCount: number): Promise<ExtractionResult> {
    if (!docAIClient) {
        throw new ExtractionApiError("Document AI client is not initialized. Check configuration.");
    }
     if (!GCP_PROJECT_ID || !DOCAI_LOCATION || !DOCAI_PROCESSOR_ID) {
         throw new ExtractionApiError("Document AI configuration (Project ID, Location, Processor ID) is incomplete.");
     }

    console.log(`[Text Extractor] Starting Document AI extraction for PDF: ${filename}`);
    const processorName = `projects/${GCP_PROJECT_ID}/locations/${DOCAI_LOCATION}/processors/${DOCAI_PROCESSOR_ID}`;
    const buffer = Buffer.from(fileBuffer);

    const request = {
        name: processorName,
        rawDocument: {
            content: buffer.toString('base64'),
            mimeType: 'application/pdf',
        },
    };

    try {
        console.log(`[Text Extractor] Sending Document AI request to processor: ${processorName}`);
        const [result] = await docAIClient.processDocument(request);
        console.log('[Text Extractor] Document AI request completed successfully');

        const { document } = result;

        if (!document || !document.text) {
            console.warn(`[Text Extractor] Document AI returned no text for PDF ${filename}. Response status: ${result.document?.error?.message || 'N/A'}`);
             return {
                 text: "",
                 info: { pages: initialPageCount, metadata: { source: 'Document AI', characters: 0, note: 'No text detected.' } }
             };
        }

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

        console.log(`[Text Extractor] Document AI detected language codes for ${filename}:`, Array.from(detectedLanguageCodes));
        const extractedText = document.text;
        const characterCount = extractedText.length;
        const pageCount = document.pages?.length || initialPageCount;
        console.log(`[Text Extractor] Document AI extraction complete for PDF ${filename}, extracted ${characterCount} characters from ${pageCount} pages.`);

        return {
            text: extractedText,
            info: {
                pages: pageCount,
                metadata: {
                    source: 'Document AI',
                    characters: characterCount,
                    detectedLanguages: Array.from(detectedLanguageCodes)
                }
            }
        };
    } catch (error: any) {
        console.error(`[Text Extractor] Document AI extraction error for PDF ${filename}:`, JSON.stringify(error, null, 2));
         if (error.message.includes('Deadline Exceeded') || error.code === 4) {
             throw new ExtractionApiError(`Document AI request timed out for ${filename}.`);
         }
         if (error.message.includes('INVALID_ARGUMENT')) {
             throw new ExtractionApiError(`Document AI: Invalid argument. Ensure ${filename} is a valid PDF.`);
         }
         if (error.message.includes('PERMISSION_DENIED') || error.details?.includes('permission')) {
             throw new ExtractionApiError(`Document AI: Permission denied. Check service account roles.`);
         }
         if (error.message.includes('NOT_FOUND')) {
             throw new ExtractionApiError(`Document AI: Processor not found. Verify Processor ID/Location.`);
         }
        throw new ExtractionApiError(`Document AI failed for ${filename}: ${error.message}`);
    }
}


// extractText (main service function - no changes needed here)
export async function extractText(
    fileBuffer: ArrayBuffer,
    filename: string,
    fileType: SupportedFileType
): Promise<ExtractionResult> {
    if (fileType === 'pdf') {
        const pageCount = await checkPdfPageCount(fileBuffer, filename);
        return await extractTextFromPdfDocAI(fileBuffer, filename, pageCount);
    } else if (fileType === 'image') {
        return await extractTextFromImageVisionAI(fileBuffer, filename);
    } else {
        console.error(`[Text Extractor] Called with unsupported file type for filename: ${filename}`);
        throw new ExtractionApiError(`Unsupported file type provided to extraction service for ${filename}.`);
    }
}