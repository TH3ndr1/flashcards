import { NextRequest, NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import pdfParse from 'pdf-parse';
import { ImageAnnotatorClient } from '@google-cloud/vision';

// Specify Node.js runtime for Vercel with explicit configuration
export const config = {
  runtime: 'nodejs',
  regions: ['iad1'], // US East (N. Virginia)
  maxDuration: 60
};

// Configuration for Vertex AI
const projectId = process.env.GCP_PROJECT_ID;
const location = 'us-central1';
const modelName = 'gemini-2.0-flash-lite-001';

// Modify the PDF parse options to be more memory-efficient
const PDF_PARSE_OPTIONS = {
  // Reduce max pages for Vercel compatibility
  max: 30,
  // Only extract text, ignore other content
  pagerender: function(pageData: any) {
    return pageData.getTextContent()
      .then(function(textContent: any) {
        let text = '';
        for (let item of textContent.items) {
          text += item.str + ' ';
        }
        return text;
      });
  }
};

// Supported file types
const SUPPORTED_EXTENSIONS = {
  // Images
  'jpg': 'image',
  'jpeg': 'image',
  'png': 'image',
  'gif': 'image',
  'bmp': 'image',
  'webp': 'image',
  // PDFs
  'pdf': 'pdf',
};

// Check if file type is supported
function getSupportedFileType(filename: string): string | null {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXTENSIONS[extension as keyof typeof SUPPORTED_EXTENSIONS] || null;
}

// Extract text from PDF file using pdf-parse with better error handling
async function extractTextFromPdf(pdfBuffer: ArrayBuffer) {
  try {
    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(pdfBuffer);
    
    console.log('Starting PDF parsing with pdf-parse...');
    // Use pdf-parse with options
    const result = await pdfParse(buffer, PDF_PARSE_OPTIONS);
    console.log(`PDF parsing complete: ${result.numpages} pages processed`);
    
    return {
      text: result.text,
      info: {
        pages: result.numpages,
        metadata: result.info
      }
    };
  } catch (error: any) {
    console.error('PDF parsing error:', error.message, error.stack);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

// Extract text from image using Google Cloud Vision API with improved logging
async function extractTextFromImage(imageBuffer: ArrayBuffer) {
  try {
    console.log('Starting Vision AI text extraction...');
    // Create client for Vision API
    const visionClient = new ImageAnnotatorClient();
    
    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(imageBuffer);
    
    // Use document text detection for best results with document images
    const [result] = await visionClient.documentTextDetection({
      image: { content: buffer.toString('base64') }
    });
    
    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      console.log('Vision AI returned no text detections');
      throw new Error('No text detected in the image');
    }
    
    // Full text is typically the first annotation
    const extractedText = detections[0].description || '';
    console.log(`Vision AI extraction complete, extracted ${extractedText.length} characters`);
    
    return {
      text: extractedText,
      info: {
        pages: 1,
        metadata: { source: 'Vision AI' }
      }
    };
  } catch (error: any) {
    console.error('Vision AI extraction error:', error.message, error.stack);
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
}

// Function to generate flashcards from extracted text
async function generateFlashcardsFromText(text: string, filename: string) {
  try {
    // Initialize Vertex AI client
    const vertexAI = new VertexAI({
      project: projectId!,
      location
    });

    const model = vertexAI.getGenerativeModel({ model: modelName });

    // Create a prompt that uses the extracted text
    // Increased character limit to 50,000 (still far below the 1M token limit mentioned)
    const truncatedText = text.length > 50000 
      ? text.slice(0, 50000) + '...(text truncated for token limits)'
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

    // Generate content
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('No text generated');
    }

    // Extract and parse JSON
    const jsonStr = responseText.substring(responseText.indexOf('['), responseText.lastIndexOf(']') + 1);
    return JSON.parse(jsonStr);
  } catch (error: any) {
    console.error('Error generating flashcards:', error.message);
    throw error;
  }
}

// Export the API route handler
export async function POST(request: NextRequest) {
  console.log('POST request received to /api/extract-pdf');
  try {
    // Get the form data with more robust error handling
    let formData;
    try {
      formData = await request.formData();
      console.log('FormData parsed successfully');
    } catch (formError: any) {
      console.error('Error parsing form data:', formError);
      return NextResponse.json({ 
        success: false, 
        message: 'Error processing uploaded file. Please try again.',
        formError: formError.message
      }, { status: 400 });
    }
    
    // Get the file from the form data with better error handling
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        message: 'No file provided in request'
      }, { status: 400 });
    }
    
    // Verify the file is a proper File or Blob object
    if (!(file instanceof Blob)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Uploaded file is not in the expected format',
        receivedType: typeof file
      }, { status: 400 });
    }

    // Extract filename from file object with fallback
    const filename = 'name' in file && typeof file.name === 'string' 
      ? file.name 
      : 'uploaded-file';

    // Check if file type is supported
    const fileType = getSupportedFileType(filename);
    if (!fileType) {
      return NextResponse.json({ 
        success: false, 
        message: `Unsupported file type: "${filename}". Please upload a PDF or image file (jpg, jpeg, png, gif, bmp, webp).`
      }, { status: 400 });
    }

    // Increased file size limit to 25MB
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 25MB.`);
    }

    // Get file information
    const fileSize = file.size;
    const fileMimeType = file.type;

    // Convert file to array buffer for processing
    const arrayBuffer = await file.arrayBuffer();
    
    // Extract text from the document based on file type
    let extractedText = '';
    let extractInfo = { pages: 0, metadata: {} };
    let extractionMethod = '';
    
    if (fileType === 'pdf') {
      try {
        // Try to extract text with pdf-parse first
        const extractResult = await extractTextFromPdf(arrayBuffer);
        extractedText = extractResult.text;
        extractInfo = extractResult.info;
        extractionMethod = 'pdf-parse';
        
        // Handle empty text case
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text could be extracted with pdf-parse');
        }
      } catch (extractError: any) {
        console.error('Primary text extraction failed:', extractError);
        
        try {
          // Fallback to Vision AI for PDFs
          console.log('Attempting fallback to Vision AI...');
          const visionResult = await extractTextFromImage(arrayBuffer);
          extractedText = visionResult.text;
          extractInfo = visionResult.info;
          extractionMethod = 'Vision AI';
          
          // If Vision AI also returns empty text
          if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('No text could be extracted with Vision AI either');
          }
        } catch (visionError: any) {
          console.error('Fallback extraction also failed:', visionError);
          
          // Both extraction methods failed
          return NextResponse.json({ 
            success: false, 
            message: `Could not extract text from PDF. The file might be scanned, password-protected, or contain only images that our extractors couldn't process.`,
            flashcards: []
          }, { status: 422 });
        }
      }
    } else if (fileType === 'image') {
      // For images, go directly to Vision AI
      try {
        const visionResult = await extractTextFromImage(arrayBuffer);
        extractedText = visionResult.text;
        extractInfo = visionResult.info;
        extractionMethod = 'Vision AI';
        
        // Handle empty text case
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text could be detected in the image');
        }
      } catch (error: any) {
        console.error('Image text extraction failed:', error);
        return NextResponse.json({ 
          success: false, 
          message: `Could not extract text from image: ${error.message}`,
          flashcards: []
        }, { status: 422 });
      }
    }
    
    // Generate flashcards from the extracted text
    const flashcards = await generateFlashcardsFromText(extractedText, filename);
    
    // Return the results
    return NextResponse.json({ 
      success: true, 
      flashcards,
      fileInfo: {
        name: filename,
        size: fileSize,
        type: fileMimeType,
        fileType: fileType,
        pages: extractInfo.pages,
        extractionMethod
      },
      extractedTextPreview: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''),
      message: `Successfully processed ${fileType} ${extractInfo.pages > 1 ? `(${extractInfo.pages} pages)` : ''} with ${extractionMethod} and generated ${flashcards.length} flashcards`
    });
  } catch (error: any) {
    console.error('API error:', error.message);
    return NextResponse.json({ 
      success: false, 
      message: `Error: ${error.message}`,
      flashcards: []
    }, { status: 500 });
  }
}

// Add OPTIONS handler to support CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Add a simple GET handler for testing connectivity
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'PDF extraction API is active. Use POST method to extract text from PDF files.',
    status: 'ok',
  });
} 