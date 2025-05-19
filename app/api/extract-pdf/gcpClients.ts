// app/api/extract-pdf/gcpClients.ts
/**
 * Initializes and exports configured GCP service clients.
 */
import { VertexAI } from '@google-cloud/vertexai';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { appLogger, statusLogger } from '@/lib/logger';

import * as config from './config';

// Ensure configuration is valid before attempting to create clients
if (!config.validateConfiguration()) {
    // Log a critical error, but avoid throwing here to prevent breaking module resolution
    // during potential build phases. The API route handler will perform the runtime check.
    appLogger.error("[GCP Clients] CRITICAL: Cannot initialize clients due to missing configuration.");
}

// Document AI client
const docAIClientOptions = {
    credentials: config.credentials,
    projectId: config.GCP_PROJECT_ID,
    apiEndpoint: config.DOCAI_API_ENDPOINT,
};
// Conditionally create clients only if config is likely valid
export const docAIClient = (config.GCP_PROJECT_ID && config.GCP_SERVICE_ACCOUNT_EMAIL && config.GCP_PRIVATE_KEY && config.DOCAI_PROCESSOR_ID)
    ? new DocumentProcessorServiceClient(docAIClientOptions)
    : null;

// Vision AI client
export const visionClient = (config.GCP_PROJECT_ID && config.GCP_SERVICE_ACCOUNT_EMAIL && config.GCP_PRIVATE_KEY)
    ? new ImageAnnotatorClient({
          credentials: config.credentials,
          projectId: config.GCP_PROJECT_ID
      })
    : null;

// Vertex AI client
export const vertexAI = (config.GCP_PROJECT_ID && config.GCP_SERVICE_ACCOUNT_EMAIL && config.GCP_PRIVATE_KEY)
    ? new VertexAI({
          project: config.GCP_PROJECT_ID!, // Use non-null assertion after validation check
          location: config.VERTEX_LOCATION,
          googleAuthOptions: { credentials: config.credentials }
      })
    : null;

// Log client initialization status
if (!docAIClient || !visionClient || !vertexAI) {
    appLogger.warn("[GCP Clients] One or more GCP clients could not be initialized due to missing configuration. API functionality will be limited.");
} else {
    appLogger.info("[GCP Clients] Document AI, Vision AI, and Vertex AI clients initialized.");
}