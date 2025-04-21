import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
// Import Document AI Client
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { getFileFromStorage } from '@/lib/actions/storageActions';
import { PDFDocument } from 'pdf-lib'; // Import pdf-lib
// Import language-detection library (we'll use the built-in Vision API capability)
import { protos } from '@google-cloud/vision';

// Specify Node.js runtime for Vercel with explicit configuration
export const config = {
  runtime: 'nodejs',
  regions: ['iad1'], // US East (N. Virginia)
  maxDuration: 90, // Increase to 90 seconds for larger files
  api: {
    bodyParser: {
      sizeLimit: '26mb' // Slightly larger than the client-side limit
    }
  }
};

// --- Configuration ---
// Read credentials from environment variables (set by gcpvercel.com integration)
const projectId = process.env.GCP_PROJECT_ID;
const clientEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\n/g, '\n'); // Ensure newlines

const docAILocation = 'eu'; // Document AI processor location
const docAIProcessorId = '2ffef9e90eeb6543'; // Your Document OCR processor ID
const vertexLocation = 'us-central1'; // Vertex AI location
const vertexModelName = 'gemini-2.0-flash-lite-001';
const skipHumanReview = true; // Process automatically

// Log the Document AI configuration for debugging
console.log(`Document AI Configuration:
  - Project ID: ${projectId ? 'Configured' : 'Missing'}
  - Service Account: ${clientEmail ? 'Configured' : 'Missing'}
  - Private Key: ${privateKey ? 'Configured' : 'Missing'}
  - Location: ${docAILocation}
  - Processor ID: ${docAIProcessorId}
  - Regional Endpoint: ${docAILocation}-documentai.googleapis.com
`);

// --- Credential Object --- 
// Check for credentials early, before initializing clients
if (!projectId || !clientEmail || !privateKey) {
  console.error('[API /extract-pdf] Missing required GCP credentials (GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, GCP_PRIVATE_KEY) in environment variables.');
  // Note: Can't return NextResponse here as it's top-level code.
  // The check within POST handler will prevent execution if creds are missing.
}

const credentials = {
  client_email: clientEmail,
  private_key: privateKey,
};

// --- Client Initializations (Using Explicit Credentials) ---
// Initialize clients using the credentials object
// Document AI client with explicit options
const docAIClientOptions = { 
  credentials,
  projectId,
  apiEndpoint: `${docAILocation}-documentai.googleapis.com` // Explicitly set the regional endpoint
}; 
const docAIClient = new DocumentProcessorServiceClient(docAIClientOptions);

const visionClient = new ImageAnnotatorClient({ credentials, projectId });

const vertexAI = new VertexAI({
    project: projectId,
    location: vertexLocation,
    googleAuthOptions: { credentials } // Pass credentials correctly
});

// --- Supported File Types ---
const SUPPORTED_EXTENSIONS = {
  'jpg': 'image' as const,
  'jpeg': 'image' as const,
  'png': 'image' as const,
  'gif': 'image' as const,
  'bmp': 'image' as const,
  'webp': 'image' as const,
  'pdf': 'pdf' as const,
};

function getSupportedFileType(filename: string): 'pdf' | 'image' | null {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXTENSIONS[extension as keyof typeof SUPPORTED_EXTENSIONS] || null;
}

// Helper function to detect languages from text
async function detectLanguages(text: string, metadata?: any): Promise<{
  questionLanguage?: string;
  answerLanguage?: string;
  isBilingual: boolean;
}> {
  if (!text || text.length < 10) {
    return { isBilingual: false, questionLanguage: undefined, answerLanguage: undefined };
  }
  
  try {
    // Language code mapping to full language names
    const languageCodes: Record<string, string> = {
      en: 'English',
      nl: 'Dutch',
      fr: 'French',
      de: 'German',
      es: 'Spanish',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      ar: 'Arabic',
      hi: 'Hindi',
      // Add more languages as needed
    };
    
    // Start with fresh detection for each file
    const detectedLanguages = new Set<string>();
    
    // First, check if we have language metadata from Document AI or Vision AI
    if (metadata?.detectedLanguages && Array.isArray(metadata.detectedLanguages)) {
      for (const langCode of metadata.detectedLanguages) {
        detectedLanguages.add(langCode);
      }
      console.log('Using API-detected languages:', Array.from(detectedLanguages));
    }
    
    // If no languages detected yet, we could use a basic heuristic or fallback
    // For now, default to using English if no languages were detected
    if (detectedLanguages.size === 0) {
      detectedLanguages.add('en');
      console.log('No languages detected, defaulting to English');
    }
    
    // Determine primary and secondary languages
    const languages = Array.from(detectedLanguages);
    const primaryLanguage = languages[0];
    // Only set secondary language if it's different from primary
    const secondaryLanguage = languages.length > 1 && languages[1] !== primaryLanguage ? languages[1] : undefined;
    
    // Map language codes to human-readable names
    const primaryLanguageName = primaryLanguage ? (languageCodes[primaryLanguage] || primaryLanguage) : undefined;
    const secondaryLanguageName = secondaryLanguage ? (languageCodes[secondaryLanguage] || secondaryLanguage) : undefined;
    
    // Explicitly set the values to ensure nothing carries over
    return {
      questionLanguage: primaryLanguageName || undefined,
      answerLanguage: secondaryLanguageName || primaryLanguageName || undefined, // Default to primary if no secondary
      isBilingual: detectedLanguages.size > 1 && secondaryLanguage !== undefined
    };
  } catch (error) {
    console.error('Language detection error:', error);
    return { isBilingual: false, questionLanguage: undefined, answerLanguage: undefined };
  }
}

// Extract text from IMAGE using Google Cloud Vision AI
async function extractTextFromImage(fileBuffer: ArrayBuffer, filename: string) {
  const buffer = Buffer.from(fileBuffer);
  console.log(`Starting Vision AI text extraction for IMAGE: ${filename}...`);
  try {
    // Use the pre-initialized visionClient
    const [result] = await visionClient.documentTextDetection({
      image: { content: buffer.toString('base64') }
    });
    const extractedText = result.fullTextAnnotation?.text || '';
    if (!extractedText) {
      console.warn(`Vision AI returned no text detections for IMAGE ${filename}`);
      throw new Error('Vision AI could not detect any text in the image.');
    }
    
    // Extract language information from Vision API response
    const detectedLanguages = new Set<string>();
    
    // Loop through text annotations to find languages
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      for (const annotation of result.textAnnotations) {
        if (annotation.locale) {
          // Add primary language code (e.g., 'en' from 'en-US')
          const primaryCode = annotation.locale.split('-')[0];
          detectedLanguages.add(primaryCode);
        }
      }
    }
    
    // Log detected languages
    console.log(`Vision AI detected languages for ${filename}:`, Array.from(detectedLanguages));
    
    const characterCount = extractedText.length;
    console.log(`Vision AI extraction complete for IMAGE ${filename}, extracted ${characterCount} characters`);
    return {
      text: extractedText,
      info: {
        pages: result.fullTextAnnotation?.pages?.length || 1, // Get page count if available
        metadata: { 
          source: 'Vision AI', 
          characters: characterCount,
          detectedLanguages: Array.from(detectedLanguages)
        }
      }
    };
  } catch (error: any) {
    console.error(`Vision AI extraction error for IMAGE ${filename}:`, error.message);
    throw new Error(`Failed to extract text from image ${filename}: ${error.message}`);
  }
}

// Extract text from PDF using Google Cloud Document AI
async function extractTextFromPdfWithDocumentAI(fileBuffer: ArrayBuffer, filename: string, mimeType: string) {
  console.log(`Starting Document AI text extraction for PDF: ${filename}`);
  
  try {
    // **** ADDED: Perform page count check BEFORE calling Document AI ****
    const { info: pageInfo } = await extractTextFromPdf(fileBuffer, filename); 
    const initialPageCount = pageInfo.pages;
    console.log(`Pre-check successful: ${filename} has ${initialPageCount} pages.`);
    // **** END ADDED CHECK ****
    
    // Following the exact format from the official documentation
    const processorName = `projects/${projectId}/locations/${docAILocation}/processors/${docAIProcessorId}`;
    const buffer = Buffer.from(fileBuffer);
    
    // Create the request exactly as shown in the documentation
    const request = {
      name: processorName,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };
    
    console.log(`Sending Document AI request to processor: ${processorName}`);
    const [result] = await docAIClient.processDocument(request);
    console.log('Document AI request completed successfully');
    
    const { document } = result;

    if (!document || !document.text) {
      console.warn(`Document AI returned no text for PDF ${filename}.`);
      throw new Error('Document AI could not detect any text in the PDF.');
    }

    // Extract language information from Document AI response
    const detectedLanguages = new Set<string>();
    
    // Document AI provides language information in pages[].detectedLanguages
    if (document.pages && document.pages.length > 0) {
      for (const page of document.pages) {
        if (page.detectedLanguages && page.detectedLanguages.length > 0) {
          for (const lang of page.detectedLanguages) {
            if (lang.languageCode) {
              // Extract primary language code (e.g., 'en' from 'en-US')
              const primaryCode = lang.languageCode.split('-')[0];
              detectedLanguages.add(primaryCode);
            }
          }
        }
      }
    }
    
    // Log detected languages
    console.log(`Document AI detected languages for ${filename}:`, Array.from(detectedLanguages));

    const extractedText = document.text;
    const characterCount = extractedText.length;
    const pageCount = document.pages?.length || initialPageCount; // Use initial count if API doesn't return one
    console.log(`Document AI extraction complete for PDF ${filename}, extracted ${characterCount} characters from ${pageCount} pages.`);

    return {
      text: extractedText,
      info: {
        pages: pageCount,
        metadata: { 
          source: 'Document AI', 
          characters: characterCount,
          detectedLanguages: Array.from(detectedLanguages)
        }
      }
    };
  } catch (error: any) {
    // Catch the specific page limit error re-thrown from extractTextFromPdf
    if (error.message.startsWith('PDF_PAGE_LIMIT_EXCEEDED::')) {
      throw error;
    }
    
    // Original Document AI error handling
    console.error(`Document AI extraction error for PDF ${filename}:`, JSON.stringify(error, null, 2));
    console.error(`Document AI error details:`, error.message);
    
    // More specific error handling
    if (error.message.includes('INVALID_ARGUMENT')) {
      throw new Error(`Failed to process PDF with Document AI: Invalid argument in the request. Please ensure the file is a valid PDF document.`);
    }
    
    if (error.message.includes('PERMISSION_DENIED') || error.message.includes('permission')) {
      throw new Error(`Failed to process PDF with Document AI: Permission denied. The service account may not have the required 'documentai.apiUser' role.`);
    }
    
    if (error.message.includes('NOT_FOUND')) {
      throw new Error(`Failed to process PDF with Document AI: Processor not found. Check that processor ID '${docAIProcessorId}' exists in project '${projectId}' in location '${docAILocation}'.`);
    }
    
    throw new Error(`Failed to process PDF with Document AI: ${error.message}`);
  }
}

// Extract text from PDF using pdf-lib (fallback method)
async function extractTextFromPdf(fileBuffer: ArrayBuffer, filename: string) {
  console.log(`Starting pdf-lib check for PDF: ${filename}`);
  
  try {
    // Load the PDF document, ignoring encryption for page counting
    const pdfDoc = await PDFDocument.load(fileBuffer, { 
      ignoreEncryption: true 
    });
    const pageCount = pdfDoc.getPageCount();
    
    // Check the page count against the limit
    if (pageCount > 30) {
      console.warn(`PDF "${filename}" has ${pageCount} pages, exceeding the 30-page limit.`);
      // Throw a specific, parseable error
      throw new Error(`PDF_PAGE_LIMIT_EXCEEDED::${filename}::${pageCount}`);
    }
    
    // If the check passes, return page count info but indicate no text extracted by pdf-lib itself
    console.log(`pdf-lib check complete for ${filename}: ${pageCount} pages (within limit).`);
    return {
      text: "", // Indicate no text extracted by this *method* itself
      info: {
        pages: pageCount,
        metadata: { 
          source: 'pdf-lib', 
          characters: 0,
          note: 'Page count checked by pdf-lib. Extraction relies on Document AI.'
        }
      }
    };
  } catch (error: any) {
    // Re-throw the specific page limit error, otherwise throw a generic processing error
    if (error.message.startsWith('PDF_PAGE_LIMIT_EXCEEDED::')) {
      throw error;
    }
    console.error(`pdf-lib processing error for ${filename}:`, error.message);
    throw new Error(`Failed to process PDF metadata with pdf-lib: ${error.message}`);
  }
}

// --- Flashcard Generation ---
async function generateFlashcardsFromText(text: string, filename: string, fileInfo?: any) {
  console.log(`[generateFlashcards] Attempting to generate flashcards for: ${filename}`);
  if (!text || text.trim().length < 10) {
    console.warn(`[generateFlashcards] Input text for ${filename} is too short or empty. Skipping generation.`);
    return [];
  }
  
  // IMPORTANT: Reset language info for each file to prevent carryover
  // Detect languages from the text and metadata
  let languageInfo: {
    questionLanguage?: string;
    answerLanguage?: string;
    isBilingual: boolean;
  } = { isBilingual: false, questionLanguage: undefined, answerLanguage: undefined };
  
  try {
    // Pass the metadata that might contain detected languages
    languageInfo = await detectLanguages(text, fileInfo?.metadata);
    console.log(`[generateFlashcards] Detected languages for ${filename}:`, languageInfo);
  } catch (langError) {
    console.error(`[generateFlashcards] Language detection error for ${filename}:`, langError);
    // Continue with generation even if language detection fails
  }
  
  try {
    // Use the pre-initialized vertexAI client
    const model = vertexAI.getGenerativeModel({ model: vertexModelName });
    const MAX_CHARS = 50000; 
    const truncatedText = text.length > MAX_CHARS
      ? text.slice(0, MAX_CHARS) + `...(text truncated at ${MAX_CHARS} characters)`
      : text;
      
    // Enhanced prompt with better language detection instructions
    const prompt = `
I have a document titled "${filename}" with the following extracted text:

"""
${truncatedText}
"""

Instructions:

1. Determine Document Type: Analyze the file content to determine if it's a translation vocabulary list (pairs of words like "word1 - word2") or knowledge-based text (regular prose or factual information).

2. Detect Languages: Identify the language(s) used in the document.
   - If it's a vocabulary list, identify the source language and target language.
   - If it's regular text, identify the main language used.
   ${languageInfo.questionLanguage ? `- Primary detected language is ${languageInfo.questionLanguage}.` : ''}
   ${languageInfo.answerLanguage && languageInfo.answerLanguage !== languageInfo.questionLanguage ? `- Secondary detected language is ${languageInfo.answerLanguage}.` : ''}

3. Apply Appropriate Mode:
   Mode 1: Translation Vocabulary: If the document is a translation vocabulary list, create one flashcard per word pair.
     "question": The word in the source language.
     "answer": Its translation in the target language.
     
   Mode 2: Knowledge-Based Text: If the document is knowledge-based text, create at least two high-quality question-answer pairs for each provided topic.
     Make questions test understanding, not just recall.
     Keep answers concise (under 100 words).
     Use the same language as the document for both questions and answers.
     
4. Format Output: Format each flashcard as a JSON object with "question" and "answer" fields. Return an array of these objects.

Example Mode 1:
[ { "question": "Tafel", "answer": "Table" }, { "question": "Stuhl", "answer": "Chair" } ]

Example Mode 2:
[ { "question": "What is the main function of photosynthesis?", "answer": "Photosynthesis converts light energy into chemical energy in the form of glucose, using water and carbon dioxide." }, { "question": "How does chlorophyll contribute to photosynthesis?", "answer": "Chlorophyll absorbs light energy, which is then used to drive the chemical reactions of photosynthesis." } ]

Important:
- Do not mix modes in the same question.
- Ensure formatting consistency.
- Use the original languages detected in the document.`;

    console.log(`[generateFlashcards] Sending prompt for ${filename} to model ${vertexModelName}. Prompt length: ${prompt.length}`);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log(`[generateFlashcards] Raw response received for ${filename}: ${responseText ? responseText.substring(0, 100) + '...' : 'No text content'}`);
    
    if (!responseText) {
      console.error(`[generateFlashcards] No text content received from AI model for ${filename}.`);
      throw new Error('No text generated by AI model');
    }
    
    const jsonStartIndex = responseText.indexOf('[');
    const jsonEndIndex = responseText.lastIndexOf(']') + 1;
    
    if (jsonStartIndex === -1 || jsonEndIndex === 0) {
      console.error(`[generateFlashcards] Could not find JSON array markers in response for ${filename}. Response text: ${responseText}`);
      return []; 
    }
    
    const jsonStr = responseText.substring(jsonStartIndex, jsonEndIndex);
    try {
      const parsedFlashcards = JSON.parse(jsonStr);
      console.log(`[generateFlashcards] Successfully parsed ${Array.isArray(parsedFlashcards) ? parsedFlashcards.length : 0} flashcards for ${filename}.`);
      
      // Add language information to each flashcard based on the mode
      const cardsWithLanguageInfo = Array.isArray(parsedFlashcards) ? parsedFlashcards.map(card => {
        // Debug logging for language info
        console.log(`[Language Debug] Current language info for card:`, {
          questionLanguage: languageInfo.questionLanguage,
          answerLanguage: languageInfo.answerLanguage,
          isBilingual: languageInfo.isBilingual
        });

        // Analyze the card content to determine if it's a translation card
        const isTranslationMode = (card: any) => {
          // Check if we have detected two different languages
          const hasTwoLanguages = languageInfo.questionLanguage && 
                                languageInfo.answerLanguage && 
                                languageInfo.questionLanguage !== languageInfo.answerLanguage;
                                
          // Check if the card follows a translation pattern (short Q&A)
          const isTranslationPattern = 
            typeof card.question === 'string' &&
            typeof card.answer === 'string' &&
            card.question.split(' ').length <= 3 && // Translation cards typically have short phrases
            card.answer.split(' ').length <= 3 &&
            !card.question.endsWith('?') && // Knowledge questions typically end with '?'
            !card.answer.endsWith('?');
            
          const result = hasTwoLanguages && isTranslationPattern;
          console.log(`[Language Debug] Card analysis:`, {
            hasTwoLanguages,
            isTranslationPattern,
            isTranslationMode: result,
            questionLength: card.question.split(' ').length,
            answerLength: card.answer.split(' ').length,
            endsWithQuestion: card.question.endsWith('?')
          });
          return result;
        };

        if (isTranslationMode(card)) {
          // For translation mode (Mode 1), swap the language assignments
          console.log(`[Language Debug] Mode 1 - Translation mode detected. Swapping languages.`);
          return {
            ...card,
            questionLanguage: languageInfo.answerLanguage, // Target language becomes question language
            answerLanguage: languageInfo.questionLanguage,  // Source language becomes answer language
            isBilingual: true
          };
        } else {
          // For knowledge-based text (Mode 2), let's display both detected languages for debugging
          console.log(`[Language Debug] Mode 2 - Knowledge mode detected. Raw language info:`, {
            primaryLang: languageInfo.questionLanguage,
            secondaryLang: languageInfo.answerLanguage
          });
          
          // For debugging, use both languages but mark them as the same
          const detectedLanguage = languageInfo.questionLanguage || languageInfo.answerLanguage;
          console.log(`[Language Debug] Mode 2 - Using detected language:`, detectedLanguage);
          
          return {
            ...card,
            questionLanguage: detectedLanguage,
            answerLanguage: detectedLanguage, // Same as question language for Mode 2
            isBilingual: false
          };
        }
      }) : [];
      
      return cardsWithLanguageInfo;
    } catch (parseError: any) {
      console.error(`[generateFlashcards] Error parsing JSON from AI response for ${filename}:`, parseError.message);
      console.error("[generateFlashcards] Received text:", responseText);
      console.error("[generateFlashcards] Attempted JSON string:", jsonStr);
      return [];
    }
  } catch (error: any) {
    console.error(`[generateFlashcards] Error generating flashcards for ${filename}:`, error.message, error.stack);
    return []; 
  }
}

// Add this interface near the top of the file with other interfaces
interface Flashcard {
  question: string;
  answer: string;
  source?: string;
  fileType?: 'pdf' | 'image';
  questionLanguage?: string;
  answerLanguage?: string;
  isBilingual?: boolean;
}

// Add a type for skipped files near the top interfaces
interface SkippedFile {
  filename: string;
  pages?: number;
  reason: string;
}

// --- API Route Handlers ---

export async function GET(request: NextRequest) {
  // Check credentials before processing
  if (!projectId || !clientEmail || !privateKey) {
    return NextResponse.json({ error: "Server configuration error: Missing GCP credentials." }, { status: 500 });
  }
  return NextResponse.json({
    message: 'Document extraction API is active. Use POST method to extract text.',
    status: 'ok',
  });
}

export async function OPTIONS(request: NextRequest) {
  // Check credentials before processing (optional, but good practice)
  if (!projectId || !clientEmail || !privateKey) {
     return NextResponse.json({ error: "Server configuration error: Missing GCP credentials." }, { status: 500 });
  }
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API /extract-pdf] Processing request');
    
    // Ensure credentials are available
    if (!projectId || !clientEmail || !privateKey) {
      console.error('[API /extract-pdf] Missing required GCP credentials');
      return NextResponse.json({ 
        success: false, 
        message: 'Server configuration error: Missing GCP credentials' 
      }, { status: 500 });
    }
    
    let skippedFiles: SkippedFile[] = [];
    let allFlashcards: Flashcard[] = [];
    let allResults = [];
    let totalPages = 0;
    let combinedPreview = "";
    let extractionInfo: any = { pages: 0, metadata: {} };

    const contentType = request.headers.get('content-type') || '';

    // **** HANDLE JSON PAYLOAD (for files uploaded to storage) ****
    if (contentType.includes('application/json')) {
      const jsonData = await request.json();
      const fileReferences = jsonData.files as { filename: string, filePath: string }[];

      if (!fileReferences || !Array.isArray(fileReferences) || fileReferences.length === 0) {
        return NextResponse.json({ success: false, message: 'Invalid or empty file list provided in JSON request' }, { status: 400 });
      }

      console.log(`[API /extract-pdf] Processing ${fileReferences.length} files from storage paths.`);

      // Process each referenced file
      for (const ref of fileReferences) {
        let fileBuffer: ArrayBuffer | null = null;
        try {
          // Get file from storage
          fileBuffer = await getFileFromStorage(ref.filePath);
          if (!fileBuffer) throw new Error('File not found in storage');

          const fileType = getSupportedFileType(ref.filename);
          if (!fileType) {
             skippedFiles.push({ filename: ref.filename, reason: 'Unsupported file type' });
             console.warn(`Skipping unsupported file from storage: ${ref.filename}`);
             continue;
          }

          let result;
          if (fileType === 'pdf') {
            result = await extractTextFromPdfWithDocumentAI(fileBuffer, ref.filename, 'application/pdf');
          } else {
            result = await extractTextFromImage(fileBuffer, ref.filename);
          }
          
          // --- Collect results (similar to multi-file FormData path) --- 
          const fileResult = { filename: ref.filename, type: fileType, text: result.text, info: result.info };
          allResults.push(fileResult);
          totalPages += result.info.pages || 1;
          combinedPreview += `--- Content from ${ref.filename} ---\n${result.text.slice(0, 200)}...\n\n`;
          
          // Generate flashcards
          console.log(`Generating flashcards for ${ref.filename} (from storage)`);
          const fileFlashcards = await generateFlashcardsFromText(result.text, ref.filename, result.info);
          const cardsWithSource = fileFlashcards.map((card: Flashcard) => ({ ...card, source: ref.filename, fileType }));
          allFlashcards = [...allFlashcards, ...cardsWithSource];

        } catch (fileError: any) {
           // Handle page limit error specifically
           if (fileError.message.startsWith('PDF_PAGE_LIMIT_EXCEEDED::')) {
              const [, fname, pageCountStr] = fileError.message.split('::');
              const pageCount = parseInt(pageCountStr, 10);
              skippedFiles.push({ filename: fname, pages: pageCount, reason: `Exceeds 30-page limit (${pageCount} pages)` });
           } else { 
              // Handle other errors (storage retrieval, processing)
              console.error(`Error processing stored file ${ref.filename} (${ref.filePath}):`, fileError.message);
              skippedFiles.push({ filename: ref.filename, reason: `Processing error: ${fileError.message}` });
           }
           continue; // Continue to next file reference
        }
      }
      // End of loop for file references

    } 
    // **** HANDLE MULTIPART/FORM-DATA (existing logic for small files) ****
    else if (contentType.includes('multipart/form-data')) {
        console.log('[API /extract-pdf] Handling multipart/form-data request.');
        const formData = await request.formData();
        const files = formData.getAll('file') as File[]; // Assuming these are File objects
        
        if (!files || files.length === 0) {
          console.log('[API /extract-pdf] No files found in FormData.');
          return NextResponse.json({ success: false, message: 'No files provided in form-data' }, { status: 400 });
        }
        
        console.log(`[API /extract-pdf] Received ${files.length} file entries from FormData.`);
        
        // Process each file from FormData
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          // **** ADDED LOGGING ****
          console.log(`[API /extract-pdf] Processing file ${i+1}/${files.length}: Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
          if (!file.name || file.size === 0) {
            console.warn(`[API /extract-pdf] Skipping file ${i+1} due to missing name or zero size.`);
            skippedFiles.push({ filename: file.name || `Unnamed File ${i+1}`, reason: 'Invalid file data (missing name or zero size)' });
            continue;
          }
          // Check if crucial methods exist
          if (typeof file.arrayBuffer !== 'function') {
              console.error(`[API /extract-pdf] Skipping file ${file.name}: Missing arrayBuffer method.`);
              skippedFiles.push({ filename: file.name, reason: 'Invalid file object received (no arrayBuffer)' });
              continue;
          }
          // **** END ADDED LOGGING ****

          try {
            const arrayBuffer = await file.arrayBuffer(); // Potential point of failure on mobile?
            console.log(`[API /extract-pdf] Successfully got arrayBuffer for ${file.name}`);
            const fileType = getSupportedFileType(file.name);
            
            if (!fileType) {
              skippedFiles.push({ filename: file.name, reason: 'Unsupported file type' }); 
              console.warn(`[API /extract-pdf] Skipping unsupported file: ${file.name}`);
              continue;
            }
            
            // --- Start actual processing --- 
            let result;
            if (fileType === 'pdf') {
               result = await extractTextFromPdfWithDocumentAI(arrayBuffer, file.name, 'application/pdf');
            } else {
               result = await extractTextFromImage(arrayBuffer, file.name);
            }
            // --- End actual processing --- 
                      
            // Store the extraction result
            const fileResult = { filename: file.name, type: fileType, text: result.text, info: result.info };
            allResults.push(fileResult);
            
            // Update metrics and preview (keep these)
            totalPages += result.info.pages || 1;
            combinedPreview += `--- Content from ${file.name} ---\n${result.text.slice(0, 200)}...\n\n`;
            console.log(`[API /extract-pdf] Successfully processed text extraction for ${file.name}.`);

            // **** ADD BACK FLASHCARD GENERATION LOGIC ****
            console.log(`[API /extract-pdf] Attempting flashcard generation for ${file.name}`);
            const fileFlashcards = await generateFlashcardsFromText(result.text, file.name, result.info);
            const cardsWithSource = fileFlashcards.map((card: Flashcard) => ({
              ...card,
              source: file.name, 
              fileType
            }));
            allFlashcards = [...allFlashcards, ...cardsWithSource];
            console.log(`[API /extract-pdf] Added ${fileFlashcards.length} flashcards from ${file.name}. Total now: ${allFlashcards.length}`);
            // **** END ADDED LOGIC ****

          } catch (fileError: any) {
             console.error(`[API /extract-pdf] Error processing file ${file.name} from FormData:`, fileError.message);
             // Handle page limit error specifically
             if (fileError.message.startsWith('PDF_PAGE_LIMIT_EXCEEDED::')) {
               const [, fname, pageCountStr] = fileError.message.split('::');
               const pageCount = parseInt(pageCountStr, 10);
               skippedFiles.push({ filename: fname, pages: pageCount, reason: `Exceeds 30-page limit (${pageCount} pages)` });
             } else {
               skippedFiles.push({ filename: file.name, reason: `Processing error: ${fileError.message}` });
             }
             continue; // Continue to next file
          }
        } // End for loop
    } 
    // **** HANDLE UNSUPPORTED CONTENT TYPE ****
    else {
      return NextResponse.json({ success: false, message: `Unsupported content type: ${contentType}` }, { status: 400 });
    }

    // --- COMBINE AND RETURN RESULTS (applies to both JSON and FormData paths) ---
    if (allResults.length === 0 && skippedFiles.length > 0) {
      console.log(`[API /extract-pdf] All files were skipped. Returning info about ${skippedFiles.length} skipped files.`);
      
      // Special case for single file exceeding page limit
      if (skippedFiles.length === 1 && skippedFiles[0]?.reason.includes('Exceeds 30-page limit')) {
        const skippedFile = skippedFiles[0];
        return NextResponse.json({
          success: false,
          message: `File "${skippedFile.filename}" exceeds the 30-page limit (${skippedFile.pages} pages).`,
          code: 'PAGE_LIMIT_EXCEEDED',
          skippedFiles // Include the single skipped file
        }, { status: 400 });
      }
      
      // Multiple files all skipped case
      return NextResponse.json({
        success: false,
        message: 'No files could be processed successfully due to validation issues.',
        skippedFiles,
        extractedTextPreview: null,
        fileInfo: { pages: 0, files: 0, metadata: { sources: [] } }, // Ensure fileInfo is set with empty values
        flashcards: [] // Ensure flashcards is at least an empty array
      }, { status: 400 });
    } else if (allResults.length === 0) {
      // Generic failure (should be rare as validation typically catches issues earlier)
      return NextResponse.json({
        success: false,
        message: 'Failed to extract text from any provided files.',
        skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined
      }, { status: 400 });
    }

    // Combine metadata (ensure this uses the collected allResults)
    let extractedText = allResults.map(result => {
      return `--- Content from ${result.filename} ---\n\n${result.text}\n\n`;
    }).join('\n');
    extractionInfo = {
      pages: totalPages,
      files: allResults.length,
      metadata: {
        sources: allResults.map(r => ({ 
          filename: r.filename, 
          type: r.type, 
          pages: r.info.pages || 1,
          characters: r.info.metadata?.characters || 0,
          flashcards: allFlashcards.filter(card => card.source === r.filename).length
        }))
      }
    };
    
    console.log(`[API /extract-pdf] Final Result: Processed ${allResults.length}, Skipped ${skippedFiles.length}, Generated ${allFlashcards.length} flashcards`);
        
    return NextResponse.json({
      success: true,
      extractedTextPreview: combinedPreview.length > 1000 ? combinedPreview.slice(0, 1000) + "..." : combinedPreview,
      fileInfo: extractionInfo,
      flashcards: allFlashcards,
      skippedFiles // Include skipped files
    });

  } catch (error: any) {
    console.error('[API /extract-pdf] Unhandled error:', error);
    return NextResponse.json({
      success: false,
      message: `Unhandled server error: ${error.message}`
    }, { status: 500 });
  }
} 