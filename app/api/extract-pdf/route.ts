import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
// Import Document AI Client
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Specify Node.js runtime for Vercel with explicit configuration
export const config = {
  runtime: 'nodejs',
  regions: ['iad1'], // US East (N. Virginia)
  maxDuration: 60
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
    
    // Add processor options to handle more complex documents
    const request = {
      name: processorName,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: 'application/pdf',
      },
      // Add process options to improve complex document handling
      processOptions: {
        // Limit the number of pages to prevent timeout with very large PDFs
        individualPageSelector: {
          pages: Array.from({ length: 30 }, (_, i) => i + 1), // Process max 30 pages
        },
        // Set OCR options for better text extraction
        ocrConfig: {
          enableImageQualityScores: true,
        }
      }
    };
    
    console.log(`Sending Document AI request to processor: ${processorName}`);
    console.log(`PDF size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    
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
    console.error(`Document AI extraction error for PDF ${filename}:`, error);
    
    // Try to extract more useful information from the error
    const errorMessage = error.message || '';
    const errorDetails = error.details || '';
    
    console.error(`Document AI error details:`, {
      message: errorMessage,
      details: errorDetails,
      code: error.code,
      metadata: error.metadata,
    });
    
    // More specific error handling
    if (errorMessage.includes('INVALID_ARGUMENT')) {
      // For invalid argument errors, check if it's related to PDF size
      if (fileBuffer.byteLength > 10 * 1024 * 1024) {
        throw new Error(`The PDF file is too large (${(fileBuffer.byteLength / 1024 / 1024).toFixed(2)}MB) or too complex for Document AI to process. Please try with a smaller or simpler PDF document.`);
      }
      throw new Error(`Failed to process PDF with Document AI: Invalid argument in the request. Please ensure the file is a valid PDF document.`);
    }
    
    if (errorMessage.includes('PERMISSION_DENIED') || errorMessage.includes('permission')) {
      throw new Error(`Failed to process PDF with Document AI: Permission denied. The service account may not have the required 'documentai.apiUser' role.`);
    }
    
    if (errorMessage.includes('NOT_FOUND')) {
      throw new Error(`Failed to process PDF with Document AI: Processor not found. Check that processor ID '${docAIProcessorId}' exists in project '${projectId}' in location '${docAILocation}'.`);
    }
    
    if (errorMessage.includes('DEADLINE_EXCEEDED') || errorMessage.includes('timeout')) {
      throw new Error(`The PDF processing timed out. The document may be too large or complex. Please try with a smaller document or fewer pages.`);
    }
    
    throw new Error(`Failed to process PDF with Document AI: ${errorMessage}`);
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

You are a professor who is an expert in the field of the document.
Based on this document content, please create high-quality flashcard-style question and answer pairs.
Capture the essence of the document in the flashcards so that if a student were to read the flashcards, they would have a good understanding of the document and pass the exam.
Provide as many flashcards as needed to cover the document but do it in a way that is efficient and effective and that is not redundant.
In any case, do not provide more than 50 flashcards.
Keep answers concise but complete (under 100 words).
Format each pair as a JSON object with "question" and "answer" fields.
Make the questions test understanding rather than just recall.
Return an array of these objects.

Example format:

[
  {
    "question": "What is the main principle of X?",
    "answer": "X primarily works by doing Y, which enables Z"
  }
]`;
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
  console.log('POST request received to /api/extract-pdf (using explicit GCP_... creds)');
  let filename = 'uploaded-file'; // Default filename
  let fileType: 'pdf' | 'image' | null = null;

  // Check for credentials at the start of the handler
  if (!projectId || !clientEmail || !privateKey) {
    console.error('[API /extract-pdf] Handler stopped: Missing required GCP credentials.');
    return NextResponse.json({ success: false, message: "Server configuration error: Missing credentials." }, { status: 500 });
  }
  
  try {
    const formData = await request.formData();
    console.log('FormData parsed successfully');

    const file = formData.get('file');
    if (!file) throw new Error('No file provided in request');
    if (!(file instanceof Blob)) throw new Error('Uploaded item is not a Blob/File');

    filename = 'name' in file && typeof file.name === 'string' ? file.name : filename;
    console.log(`Processing file: ${filename}`);

    fileType = getSupportedFileType(filename);
    if (!fileType) {
      throw new Error(`Unsupported file type: "${filename}". Please upload a supported PDF or image file.`);
    }

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 25MB.`);
    }

    const fileMimeType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    console.log(`File ${filename} converted to ArrayBuffer, size: ${arrayBuffer.byteLength}`);

    // --- Call appropriate extraction function --- 
    let extractResult;
    let extractionMethod: string;

    if (fileType === 'pdf') {
      extractionMethod = 'Document AI';
      extractResult = await extractTextFromPdfWithDocumentAI(arrayBuffer, filename, fileMimeType);
    } else { // fileType === 'image'
      extractionMethod = 'Vision AI';
      extractResult = await extractTextFromImage(arrayBuffer, filename);
    }
    // --- End extraction call ---

    const { text: extractedText, info: extractInfo } = extractResult;

    if (!extractedText || extractedText.trim().length === 0) {
      // This case should ideally be handled within the specific extraction functions now
      console.warn(`${extractionMethod} detected no text in ${filename}.`);
      throw new Error(`${extractionMethod} could not detect any text in the ${fileType} file.`);
    }

    console.log(`Generating flashcards for ${filename} using text from ${extractionMethod}...`);
    const flashcards = await generateFlashcardsFromText(extractedText, filename);
    console.log(`Generated ${flashcards.length} flashcards for ${filename}`);

    return NextResponse.json({
      success: true,
      flashcards,
      fileInfo: {
        name: filename,
        size: file.size,
        type: fileMimeType,
        fileType: fileType,
        pages: extractInfo.pages,
        extractionMethod
      },
      extractedTextPreview: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      message: `Successfully processed ${fileType} with ${extractionMethod} and generated ${flashcards.length} flashcards`
    });

  } catch (error: any) {
    console.error(`API error processing ${filename} (using explicit creds):`, error.message, error.stack);
    let status = 500;
    let message = `An unexpected server error occurred: ${error.message}`;

    // Set specific statuses based on error type
    if (error.message.includes("No file provided")) status = 400;
    if (error.message.includes("Unsupported file type")) status = 400;
    if (error.message.includes("File too large")) status = 413;
    if (error.message.includes("could not detect any text")) status = 422;
    if (error.message.includes("Failed to process PDF with Document AI")) status = 422;
    if (error.message.includes("Failed to extract text from image")) status = 422;
    if (error.message.includes("AI model did not return")) status = 502; // Bad Gateway from AI
    if (error.message.includes("Failed to parse flashcards")) status = 502;

    // Use the specific message from the error if it's one we threw intentionally
    if (status !== 500 && status !== 502) {
        message = error.message; 
    }

    return NextResponse.json({
      success: false,
      message: message,
      flashcards: []
    }, { status });
  }
} 