// app/api/extract-pdf/config.ts
/**
 * Configuration module for the PDF/Image extraction and flashcard generation API.
 * Reads environment variables and defines constants.
 */

function getEnvVariable(key: string, optional: boolean = false): string | undefined {
    const value = process.env[key];
    if (!value && !optional) {
        console.error(`[Config] Missing required environment variable: ${key}`);
        // In a real app, you might throw an error here or have a stricter startup check
        // For now, we log the error and allow the app to potentially fail later if the value is used.
    }
    return value;
}

// --- GCP Credentials ---
export const GCP_PROJECT_ID = getEnvVariable('GCP_PROJECT_ID');
export const GCP_SERVICE_ACCOUNT_EMAIL = getEnvVariable('GCP_SERVICE_ACCOUNT_EMAIL');
// Ensure newlines are correctly interpreted if present
export const GCP_PRIVATE_KEY = getEnvVariable('GCP_PRIVATE_KEY')?.replace(/\\n/g, '\n');

export const credentials = {
    client_email: GCP_SERVICE_ACCOUNT_EMAIL,
    private_key: GCP_PRIVATE_KEY,
};

// --- Document AI Configuration ---
export const DOCAI_LOCATION = getEnvVariable('DOCAI_LOCATION') || 'eu'; // Default to 'eu' if not set
export const DOCAI_PROCESSOR_ID = getEnvVariable('DOCAI_PROCESSOR_ID');
export const DOCAI_API_ENDPOINT = `${DOCAI_LOCATION}-documentai.googleapis.com`;

// --- Vertex AI Configuration ---
export const VERTEX_LOCATION = getEnvVariable('VERTEX_LOCATION') || 'us-central1'; // Default if not set
export const VERTEX_MODEL_NAME = getEnvVariable('VERTEX_MODEL_NAME') || 'gemini-2.0-flash-lite-001'; // Default model

// --- Processing Limits ---
export const PAGE_LIMIT = 30;
export const MAX_TEXT_CHARS_FOR_GEMINI = 50000;

// --- Validation Function ---
export function validateConfiguration(): boolean {
    const requiredVars = [
        GCP_PROJECT_ID,
        GCP_SERVICE_ACCOUNT_EMAIL,
        GCP_PRIVATE_KEY,
        DOCAI_LOCATION,
        DOCAI_PROCESSOR_ID,
        VERTEX_LOCATION,
        VERTEX_MODEL_NAME,
    ];

    const missingVars = requiredVars.filter(v => !v);

    if (missingVars.length > 0) {
        console.error(`[Config Validation] FAILED: Missing required configuration. Check environment variables.`);
        // Logging which specific vars are missing was done by getEnvVariable
        return false;
    }

    console.log(`[Config Validation] SUCCESS: All required configurations seem to be present.`);
    return true;
}

// Log configuration on module load for debugging purposes
console.log(`[Config Loaded] API Configuration:
  - GCP Project ID: ${GCP_PROJECT_ID ? 'Configured' : 'MISSING!'}
  - GCP Service Account: ${GCP_SERVICE_ACCOUNT_EMAIL ? 'Configured' : 'MISSING!'}
  - GCP Private Key: ${GCP_PRIVATE_KEY ? 'Configured' : 'MISSING!'}
  - Doc AI Location: ${DOCAI_LOCATION}
  - Doc AI Processor ID: ${DOCAI_PROCESSOR_ID ? 'Configured' : 'MISSING!'}
  - Doc AI Endpoint: ${DOCAI_API_ENDPOINT}
  - Vertex AI Location: ${VERTEX_LOCATION}
  - Vertex AI Model: ${VERTEX_MODEL_NAME}
  - Page Limit: ${PAGE_LIMIT}
  - Max Gemini Chars: ${MAX_TEXT_CHARS_FOR_GEMINI}
`);

// Initial validation check during server startup/module load
// Note: This won't stop the server cold in Vercel, but logs the issue early.
// The POST handler should perform a runtime check as well.
validateConfiguration();