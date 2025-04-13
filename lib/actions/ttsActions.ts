// lib/actions/ttsActions.ts
"use server";

import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';

// Consider initializing the client outside the function for potential reuse
// if appropriate for your serverless environment's lifecycle.
// const ttsClient = new TextToSpeechClient();

/**
 * Server actions for Text-to-Speech (TTS) functionality.
 * 
 * This module provides:
 * - TTS audio generation
 * - Language and voice selection
 * - Audio caching and management
 * 
 * @module ttsActions
 */

/**
 * Generates speech audio from text using Google Cloud TTS.
 *
 * @param text The text to synthesize.
 * @param languageCode The BCP-47 language code (e.g., 'en-US', 'es-ES').
 * @param ssmlGender Optional SSML gender ('SSML_VOICE_GENDER_UNSPECIFIED', 'MALE', 'FEMALE', 'NEUTRAL').
 * @param voiceName Optional specific voice name (e.g., 'en-US-Wavenet-D').
 * @returns Promise<{ audioContent: string | null, error: string | null }> - Base64 encoded audio content or error message.
 */
export async function generateTtsAction(
    text: string,
    languageCode: string,
    ssmlGender: google.cloud.texttospeech.v1.SsmlVoiceGender = google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
    voiceName?: string | null // Make voiceName optional
): Promise<{ audioContent: string | null; error: string | null; }> {

    // Check for Google Cloud credentials in environment variables
    // Supports both GOOGLE_APPLICATION_CREDENTIALS file path and individual vars
    const hasCredentialsFile = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasIndividualCreds = !!process.env.GOOGLE_PROJECT_ID && !!process.env.GOOGLE_CLIENT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;

    if (!hasCredentialsFile && !hasIndividualCreds) {
         console.error("TTS Action Error: Google Cloud credentials are not set properly in environment variables.");
         return { audioContent: null, error: "Server configuration error: Missing TTS credentials." };
    }

    if (!text || !languageCode) {
        console.warn("TTS Action Warning: Missing text or languageCode.");
        return { audioContent: null, error: "Missing required parameters for TTS generation." };
    }

    console.log(`[generateTtsAction] Generating TTS for text: "${text.substring(0, 50)}...", lang: ${languageCode}, gender: ${ssmlGender}, voice: ${voiceName ?? 'default'}`);

    // Initialize client here for serverless compatibility
    // If using long-running server, initialize outside the function.
    const ttsClient = new TextToSpeechClient();

    const request: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text: text },
        voice: {
            languageCode: languageCode,
            ssmlGender: ssmlGender,
            // Only include name if it's provided
            ...(voiceName && { name: voiceName })
        },
        audioConfig: { audioEncoding: 'MP3' },
    };

    try {
        const [response] = await ttsClient.synthesizeSpeech(request);

        if (response.audioContent instanceof Uint8Array) {
            const audioBase64 = Buffer.from(response.audioContent).toString('base64');
            console.log(`[generateTtsAction] Successfully generated TTS audio for lang: ${languageCode}`);
            return { audioContent: audioBase64, error: null };
        } else {
             console.error("[generateTtsAction] TTS response did not contain valid audio content.", response);
            return { audioContent: null, error: "TTS generation failed: Invalid audio content received." };
        }
    } catch (error: any) {
        console.error('[generateTtsAction] Google TTS API Error:', error);
        // Attempt to provide a more specific error message if available
        const errorMessage = error.details || error.message || 'Unknown API error';
        return { audioContent: null, error: `TTS generation failed: ${errorMessage}` };
    }
}

/**
 * Generates TTS audio for the given text.
 * 
 * @param {Object} params - TTS generation parameters
 * @param {string} params.text - Text to convert to speech
 * @param {string} params.language - Language code for TTS (e.g., 'en-US')
 * @param {string} [params.voice] - Optional voice ID to use
 * @returns {Promise<ArrayBuffer>} The generated audio data
 * @throws {Error} If TTS generation fails or parameters are invalid
 */
export async function generateTTS({
  text,
  language,
  voice,
}: {
  text: string;
  language: string;
  voice?: string;
}): Promise<ArrayBuffer> {
  const result = await generateTtsAction(
    text,
    language,
    voice ? undefined : google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL,
    voice || null
  );
  
  if (result.error || !result.audioContent) {
    throw new Error(result.error || 'Failed to generate TTS audio');
  }
  
  // Convert base64 string to ArrayBuffer
  const buffer = Buffer.from(result.audioContent, 'base64');
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}