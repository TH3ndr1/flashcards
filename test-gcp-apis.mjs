// test-gcp-apis.mjs
import dotenv from 'dotenv';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { VertexAI } from '@google-cloud/vertexai';

// Load environment variables from .env.local (or .env)
dotenv.config({ path: '.env.local' });

// --- Configuration ---
const projectId = process.env.GCP_PROJECT_ID;
const clientEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL;
// Read the private key and replace escaped newlines with actual newlines
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n');
const location = 'us-central1';
const testImageUrl = 'https://storage.googleapis.com/cloud-samples-data/vision/ocr/sign.jpg';
const testPrompt = 'Explain Spaced Repetition System (SRS) simply, in one sentence.';
const geminiModel = 'gemini-2.0-flash-lite-001';

// --- Validation & Credential Setup ---
if (!projectId || !clientEmail || !privateKey) {
  console.error(
    '\n❌ Error: Missing required Google Cloud credentials in environment variables.'
  );
  console.error(
    '   Ensure GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, and GCP_PRIVATE_KEY are set correctly in your .env.local file.'
  );
  process.exit(1);
}

// Log service account details for debugging
console.log('\n--- Service Account Details ---');
console.log(`Project ID: ${projectId}`);
console.log(`Service Account Email: ${clientEmail}`);
console.log(`Private Key exists: ${Boolean(privateKey)}`);
console.log('-----------------------------\n');

// Credentials object structure expected by google-auth-library
const credentials = {
  client_email: clientEmail,
  private_key: privateKey,
};

// --- Test Execution ---
async function runTests() {
  console.log('--- Testing Google Cloud APIs ---');
  let visionSuccess = false;
  let vertexSuccess = false;
  
  // Test 1: Cloud Vision AI OCR
  console.log('\n1. Testing Cloud Vision AI (OCR)...');
  try {
    const visionClient = new ImageAnnotatorClient({ credentials, projectId });
    console.log('   Vision Client Initialized.');
    const [result] = await visionClient.textDetection(testImageUrl);
    const detections = result.textAnnotations;
    if (detections && detections.length > 0 && detections[0]?.description) {
      console.log('✅ Vision API Success! Detected Text (excerpt):');
      console.log(`   "${detections[0].description.substring(0, 100)}..."`);
      visionSuccess = true;
    } else {
      console.error('❌ Vision API Error: No text detected or unexpected response format.');
      console.error('   Full Response:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('❌ Vision API Error: Request failed.');
    if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        if ('code' in error) console.error(`   Code: ${error.code}`);
        if ('details' in error) console.error(`   Details: ${error.details}`);
    } else {
        console.error(error);
    }
  }

  // Test 2: Vertex AI Gemini Text Generation
  console.log('\n2. Testing Vertex AI (Gemini)...');
  try {
    const vertexAI = new VertexAI({
        project: projectId,
        location: location,
        googleAuthOptions: {
            credentials
        }
    });
    console.log('   Vertex AI Client Initialized.');

    const generativeModel = vertexAI.getGenerativeModel({ model: geminiModel });
    console.log(`   Attempting to generate content with model: ${geminiModel}`);

    const result = await generativeModel.generateContent(testPrompt);
    const response = result.response;

    const candidate = response?.candidates?.[0];
    if (candidate) {
        if (candidate.content?.parts?.[0]?.text) {
             const text = candidate.content.parts[0].text;
             console.log('✅ Vertex AI Success! Generated Text:');
             console.log(`   "${text.trim()}"`);
             vertexSuccess = true;
        } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
             console.warn(`⚠️ Vertex AI Warning: Generation finished with reason: ${candidate.finishReason}`);
             if(candidate.safetyRatings) console.warn('   Safety Ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
        }
        else {
             console.error('❌ Vertex AI Error: No text part found in the candidate.');
             console.error('   Full Candidate:', JSON.stringify(candidate, null, 2));
        }
    } else {
        console.error('❌ Vertex AI Error: No candidates returned in the response.');
        console.error('   Full Response:', JSON.stringify(response, null, 2));
    }

  } catch (error) {
    console.error('❌ Vertex AI Error: Request failed.');
     if (error instanceof Error) {
        console.error(`   Message: ${error.message}`);
        if ('code' in error) console.error(`   Code: ${error.code}`);
        if ('details' in error) console.error(`   Details: ${error.details}`);
    } else {
        console.error(error);
    }
  }

  // --- Summary ---
  console.log('\n--- Test Summary ---');
  console.log(`Cloud Vision API: ${visionSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Vertex AI Gemini API: ${vertexSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('--------------------');

  if (!visionSuccess || !vertexSuccess) {
    console.error('\nOne or more API tests failed. Check credentials in .env.local, ensure APIs are enabled in GCP, and verify IAM roles for the service account.');
    process.exit(1);
  } else {
     console.log('\nAll API tests passed successfully!');
  }
}

// Run the tests
runTests(); 