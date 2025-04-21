import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
// Import Document AI Client
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { getFileFromStorage } from '@/lib/actions/storageActions';
import { PDFDocument } from 'pdf-lib'; // Import pdf-lib

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

// --- Text Extraction Functions ---

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
    const characterCount = extractedText.length;
    console.log(`Vision AI extraction complete for IMAGE ${filename}, extracted ${characterCount} characters`);
    return {
      text: extractedText,
      info: {
        pages: result.fullTextAnnotation?.pages?.length || 1, // Get page count if available
        metadata: { source: 'Vision AI', characters: characterCount }
      }
    };
  } catch (error: any) {
    console.error(`Vision AI extraction error for IMAGE ${filename}:`, error.message);
    throw new Error(`Failed to extract text from image ${filename}: ${error.message}`);
  }
}

// Extract text from PDF using Google Cloud Document AI
async function extractTextFromPdfWithDocumentAI(fileBuffer: ArrayBuffer, filename: string, mimeType: string) {
  console.log(`Starting Document AI text extraction for PDF: ${filename} with reported mimeType: ${mimeType}`);
  
  try {
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
      console.warn(`Document AI returned no text for PDF ${filename}. It might be empty or unreadable.`);
      throw new Error('Document AI could not detect any text in the PDF. The file might be empty, corrupted, or password-protected.');
    }

    const extractedText = document.text;
    const characterCount = extractedText.length;
    const pageCount = document.pages?.length || 1;
    console.log(`Document AI extraction complete for PDF ${filename}, extracted ${characterCount} characters from ${pageCount} pages.`);

    return {
      text: extractedText,
      info: {
        pages: pageCount,
        metadata: { source: 'Document AI', characters: characterCount }
      }
    };
  } catch (error: any) {
    // Log the full error object for more details on INVALID_ARGUMENT
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
  console.log(`Starting pdf-lib extraction for PDF: ${filename}`);
  
  try {
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(fileBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    if (pageCount > 30) {
      console.warn(`PDF has ${pageCount} pages, which exceeds the recommended limit of 30 pages`);
    }
    
    // Since pdf-lib doesn't directly extract text, we'll return page count info
    // and rely on the vision API as the main extraction method
    const extractedText = `This PDF document contains ${pageCount} pages.
The content cannot be directly extracted with pdf-lib.
Please use Document AI or Vision AI for extracting text content.`;
    
    console.log(`pdf-lib extraction complete for ${filename}: extracted metadata from ${pageCount} pages`);
    
    return {
      text: extractedText,
      info: {
        pages: pageCount,
        metadata: { 
          source: 'pdf-lib', 
          characters: extractedText.length,
          note: 'Limited text extraction - consider uploading image captures of the document for better results'
        }
      }
    };
  } catch (error: any) {
    console.error(`pdf-lib extraction error for ${filename}:`, error.message);
    throw new Error(`Failed to process PDF: ${error.message}`);
  }
}

// --- Flashcard Generation ---
async function generateFlashcardsFromText(text: string, filename: string) {
  try {
    // Use the pre-initialized vertexAI client
    const model = vertexAI.getGenerativeModel({ model: vertexModelName });
    const MAX_CHARS = 50000; 
    const truncatedText = text.length > MAX_CHARS
      ? text.slice(0, MAX_CHARS) + `...(text truncated at ${MAX_CHARS} characters)`
      : text;
    const prompt = `
I have a document titled "${filename}" with the following extracted text:

"""
${truncatedText}
"""

Instructions:

Determine Document Type: Analyze the file content to determine if it's a translation vocabulary list (pairs of words like "word1 - word2") or knowledge-based text (regular prose or factual information).
Apply Appropriate Mode:

Mode 1: Translation Vocabulary: If the document is a translation vocabulary list, create one flashcard per word pair.

"question": The word in the source language.
"answer": Its translation in the target language.
Mode 2: Knowledge-Based Text: If the document is knowledge-based text, create at least two high-quality question-answer pairs for each provided topic.

Make questions test understanding, not just recall.
Keep answers concise (under 100 words).
Use the same language as the document for both questions and answers. If the document contains two languages, create questions and answers in the respective language.
Format Output: Format each flashcard as a JSON object with "question" and "answer" fields. Return an array of these objects.
Example Mode 1:

[ { "question": "Tafel", "answer": "Table" }, { "question": "Stuhl", "answer": "Chair" } ]

Example Mode 2:

[ { "question": "What is the main function of photosynthesis?", "answer": "Photosynthesis converts light energy into chemical energy in the form of glucose, using water and carbon dioxide." }, { "question": "How does chlorophyll contribute to photosynthesis?", "answer": "Chlorophyll absorbs light energy, which is then used to drive the chemical reactions of photosynthesis." } ]

Important:

Do not mix modes in the same question.
Ensure formatting consistency.
Use the provided topics only if the document is knowledge-based.
For translation vocabulary, use the original languages detected in the document.`;
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('No text generated by AI model');
    const jsonStartIndex = responseText.indexOf('[');
    const jsonEndIndex = responseText.lastIndexOf(']') + 1;
    if (jsonStartIndex === -1 || jsonEndIndex === 0) {
      console.error("Could not find JSON array in AI response:", responseText);
      throw new Error("AI model did not return the expected JSON format.");
    }
    const jsonStr = responseText.substring(jsonStartIndex, jsonEndIndex);
    try {
      return JSON.parse(jsonStr);
    } catch (parseError: any) {
      console.error("Error parsing JSON from AI response:", parseError.message);
      console.error("Received text:", responseText);
      console.error("Attempted JSON string:", jsonStr);
      throw new Error("Failed to parse flashcards from AI response.");
    }
  } catch (error: any) {
    console.error('Error generating flashcards:', error.message, error.stack);
    throw error; 
  }
}

// Add this interface near the top of the file with other interfaces
interface Flashcard {
  question: string;
  answer: string;
  source?: string;
  fileType?: 'pdf' | 'image';
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
    
    // Parse request data
    let fileData: ArrayBuffer | null = null;
    let filePath: string | null = null;
    let filename = 'document.pdf';
    let files: File[] = [];
    
    try {
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const formFiles = formData.getAll('file') as File[];
        
        if (!formFiles || formFiles.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'No files provided'
          }, { status: 400 });
        }
        
        files = formFiles;
        filename = files[0]?.name || 'document';
        
      } else if (contentType.includes('application/json')) {
        const jsonData = await request.json();
        filePath = jsonData.filePath;
        filename = jsonData.filename || 'document.pdf';
        
        if (!filePath) {
          return NextResponse.json({
            success: false,
            message: 'No filePath provided in JSON request'
          }, { status: 400 });
        }
        
        // Get file from storage
        try {
          const fileBuffer = await getFileFromStorage(filePath);
          if (!fileBuffer) {
            throw new Error(`Failed to retrieve file from storage: ${filePath}`);
          }
          fileData = fileBuffer;
        } catch (storageError: any) {
          console.error('[API /extract-pdf] Storage error:', storageError);
          return NextResponse.json({
            success: false,
            message: `Failed to retrieve file from storage: ${storageError.message}`
          }, { status: 500 });
        }
      } else {
        return NextResponse.json({
          success: false,
          message: `Unsupported content type: ${contentType}`
        }, { status: 400 });
      }
    } catch (parseError: any) {
      console.error('[API /extract-pdf] Request parsing error:', parseError);
      return NextResponse.json({
        success: false,
        message: `Failed to parse request: ${parseError.message}`
      }, { status: 400 });
    }
    
    // Extract text from either multiple files or a single storage file
    let extractedText = '';
    let extractionInfo: any = { pages: 0, metadata: {} };
    let fileType: 'pdf' | 'image' | null = null;
    
    try {
      if (fileData) {
        // Processing a single file from storage
        fileType = getSupportedFileType(filename);
        
        if (!fileType) {
          return NextResponse.json({
            success: false,
            message: `Unsupported file type: ${filename}`
          }, { status: 400 });
        }
        
        // Use the appropriate extraction function based on fileType
        let result;
        if (fileType === 'pdf') {
          try {
            result = await extractTextFromPdfWithDocumentAI(fileData, filename, 'application/pdf');
          } catch (pdfError) {
            console.error('Document AI extraction failed, attempting pdf-lib fallback', pdfError);
            result = await extractTextFromPdf(fileData, filename);
          }
        } else {
          result = await extractTextFromImage(fileData, filename);
        }
        
        extractedText = result.text;
        extractionInfo = result.info;
        
        // Generate flashcards from the extracted text
        const flashcards = await generateFlashcardsFromText(extractedText, filename);
        
        return NextResponse.json({
          success: true,
          extractedTextPreview: extractedText.slice(0, 1000),
          fileInfo: extractionInfo,
          flashcards
        });
      } else {
        // Processing multiple files from form data
        let allResults = [];
        let totalPages = 0;
        let combinedPreview = "";
        let allFlashcards: Flashcard[] = [];
        
        // Process each file and collect results
        for (const file of files) {
          const arrayBuffer = await file.arrayBuffer();
          const fileType = getSupportedFileType(file.name);
          
          if (!fileType) {
            console.warn(`Skipping unsupported file: ${file.name}`);
            continue;
          }
          
          try {
            let result;
            if (fileType === 'pdf') {
              try {
                result = await extractTextFromPdfWithDocumentAI(
                  arrayBuffer, 
                  file.name, 
                  'application/pdf'
                );
              } catch (pdfError) {
                console.error('Document AI extraction failed, attempting pdf-lib fallback', pdfError);
                result = await extractTextFromPdf(arrayBuffer, file.name);
              }
            } else {
              result = await extractTextFromImage(arrayBuffer, file.name);
            }
            
            // Store the extraction result
            const fileResult = {
              filename: file.name,
              type: fileType,
              text: result.text,
              info: result.info
            };
            allResults.push(fileResult);
            
            // Update metrics
            totalPages += result.info.pages || 1;
            
            // Add to combined preview (limited to 200 chars per file)
            combinedPreview += `--- Content from ${file.name} ---\n${result.text.slice(0, 200)}...\n\n`;
            
            // Generate flashcards specifically for this file
            console.log(`Generating flashcards for ${file.name}`);
            const fileFlashcards = await generateFlashcardsFromText(result.text, file.name);
            
            // Add source information to each flashcard
            const cardsWithSource = fileFlashcards.map((card: Flashcard) => ({
              ...card,
              source: file.name, // Add the source filename
              fileType // Add the file type (pdf or image)
            }));
            
            // Add to combined flashcards
            allFlashcards = [...allFlashcards, ...cardsWithSource];
            console.log(`Generated ${fileFlashcards.length} flashcards from ${file.name}`);
          } catch (fileError: any) {
            console.error(`Error processing file ${file.name}:`, fileError);
            // Continue with other files even if one fails
          }
        }
        
        // Combine all results
        if (allResults.length === 0) {
          return NextResponse.json({
            success: false,
            message: 'Failed to extract text from any of the provided files'
          }, { status: 400 });
        }
        
        // Join text from all files with clear separators
        extractedText = allResults.map(result => {
          return `--- Content from ${result.filename} ---\n\n${result.text}\n\n`;
        }).join('\n');
        
        // Combine metadata
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
        
        console.log(`[API /extract-pdf] Successfully extracted text from ${allResults.length} files, generated ${allFlashcards.length} flashcards`);
        
        return NextResponse.json({
          success: true,
          extractedTextPreview: combinedPreview.length > 1000 ? combinedPreview.slice(0, 1000) + "..." : combinedPreview,
          fileInfo: extractionInfo,
          flashcards: allFlashcards
        });
      }
    } catch (error: any) {
      console.error('[API /extract-pdf] Processing error:', error);
      return NextResponse.json({
        success: false,
        message: `Error processing document: ${error.message}`
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[API /extract-pdf] Unhandled error:', error);
    return NextResponse.json({
      success: false,
      message: `Unhandled server error: ${error.message}`
    }, { status: 500 });
  }
} 