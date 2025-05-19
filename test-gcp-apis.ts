// test-gcp-apis.ts
import dotenv from 'dotenv';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VertexAI } from '@google-cloud/vertexai';
import { appLogger } from '@/lib/logger';

// Load environment variables from .env.local (or .env)
// Make sure you have run: pnpm add -D dotenv @types/dotenv (or npm/yarn equivalent)
dotenv.config({ path: '.env.local' });

// --- Configuration ---
const projectId = process.env.GCP_PROJECT_ID;
const clientEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
// Read the private key and replace escaped newlines with actual newlines
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n');
const location = 'europe-west4'; // Or your preferred Vertex AI region for Gemini models
const testImageUrl = 'https://storage.googleapis.com/cloud-samples-data/vision/ocr/sign.jpg'; // Public image for OCR
const testPrompt = 'Explain Spaced Repetition System (SRS) simply, in one sentence.';
const geminiModel = 'gemini-2.0-flash-lite-001'; // Use a fast and recent model

// --- Validation & Credential Setup ---
if (!projectId || !clientEmail || !privateKey) {
  appLogger.error(
    '\n❌ Error: Missing required Google Cloud credentials in environment variables.'
  );
  appLogger.error(
    '   Ensure GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, and GCP_PRIVATE_KEY are set correctly in your .env.local file.'
  );
  process.exit(1); // Exit script if credentials are missing
}

// Credentials object structure expected by google-auth-library (used internally)
const credentials = {
  client_email: clientEmail,
  private_key: privateKey,
};

// --- Test Execution ---
async function runTests() {
  appLogger.info('--- Testing Google Cloud APIs ---');
  let visionSuccess = false;
  let vertexSuccess = false;
  
  // Test 1: Cloud Vision AI OCR
  appLogger.info('\n1. Testing Cloud Vision AI (OCR)...');
  try {
    // Vision client accepts credentials directly
    const visionClient = new ImageAnnotatorClient({ credentials, projectId });
    appLogger.info('   Vision Client Initialized.');
    const [result] = await visionClient.textDetection(testImageUrl);
    const detections = result.textAnnotations;
    if (detections && detections.length > 0 && detections[0]?.description) {
      appLogger.info('✅ Vision API Success! Detected Text (excerpt):');
      appLogger.info(`   "${detections[0].description.substring(0, 100)}..."`);
      visionSuccess = true;
    } else {
      appLogger.error('❌ Vision API Error: No text detected or unexpected response format.');
      appLogger.error('   Full Response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    appLogger.error('❌ Vision API Error: Request failed.');
    if (error instanceof Error) {
        appLogger.error(`   Message: ${error.message}`);
        if ('code' in error) appLogger.error(`   Code: ${(error as any).code}`); // Log common error codes
        if ('details' in error) appLogger.error(`   Details: ${(error as any).details}`);
    } else {
        appLogger.error(error);
    }
  }

  // Test 2: Vertex AI Gemini Text Generation
  appLogger.info('\n2. Testing Vertex AI (Gemini)...');
  try {
    // Initialize VertexAI client passing credentials via googleAuthOptions
    const vertexAI = new VertexAI({
        project: projectId,
        location: location,
        googleAuthOptions: { // Correct way to pass credentials
            credentials
        }
    });
    appLogger.info('   Vertex AI Client Initialized.');

    // Select Gemini model
    const generativeModel = vertexAI.getGenerativeModel({ model: geminiModel });
    appLogger.info(`   Attempting to generate content with model: ${geminiModel}`);

    // Generate content
    const result = await generativeModel.generateContent(testPrompt);
    const response = result.response;

    // Process response safely
    const candidate = response?.candidates?.[0];
    if (candidate) {
        if (candidate.content?.parts?.[0]?.text) {
             const text = candidate.content.parts[0].text;
             appLogger.info('✅ Vertex AI Success! Generated Text:');
             appLogger.info(`   "${text.trim()}"`);
             vertexSuccess = true;
        } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
             appLogger.warn(`⚠️ Vertex AI Warning: Generation finished with reason: ${candidate.finishReason}`);
             if(candidate.safetyRatings) appLogger.warn('   Safety Ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
        }
        else {
             appLogger.error('❌ Vertex AI Error: No text part found in the candidate.');
             appLogger.error('   Full Candidate:', JSON.stringify(candidate, null, 2));
        }
    } else {
        appLogger.error('❌ Vertex AI Error: No candidates returned in the response.');
        appLogger.error('   Full Response:', JSON.stringify(response, null, 2));
    }

  } catch (error) {
    appLogger.error('❌ Vertex AI Error: Request failed.');
     if (error instanceof Error) {
        appLogger.error(`   Message: ${error.message}`);
        if ('code' in error) appLogger.error(`   Code: ${(error as any).code}`);
        if ('details' in error) appLogger.error(`   Details: ${(error as any).details}`);
    } else {
        appLogger.error(error);
    }
  }

  // --- Summary ---
  appLogger.info('\n--- Test Summary ---');
  appLogger.info(`Cloud Vision API: ${visionSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  appLogger.info(`Vertex AI Gemini API: ${vertexSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  appLogger.info('--------------------');

  if (!visionSuccess || !vertexSuccess) {
    appLogger.error('\nOne or more API tests failed. Check credentials in .env.local, ensure APIs are enabled in GCP, and verify IAM roles for the service account.');
    process.exit(1);
  } else {
     appLogger.info('\nAll API tests passed successfully!');
  }
}

// Run the tests
runTests();