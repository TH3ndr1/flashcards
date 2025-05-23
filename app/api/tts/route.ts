import { NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';
import { appLogger, statusLogger } from '@/lib/logger';

// Remove client initialization outside the handler
// const ttsClient = new TextToSpeechClient();

/**
 * API Route Handler for POST requests to generate Text-to-Speech audio.
 * Expects a JSON body with:
 * {
 *   text: string,
 *   languageCode: string,
 *   ssmlGender?: 'SSML_VOICE_GENDER_UNSPECIFIED' | 'MALE' | 'FEMALE' | 'NEUTRAL',
 *   voiceName?: string | null
 * }
 */
export async function POST(request: Request) {
    let text: string;
    let languageCode: string;
    let ssmlGender: google.cloud.texttospeech.v1.SsmlVoiceGender;
    let voiceName: string | null | undefined;

    try {
        const body = await request.json();
        text = body.text;
        languageCode = body.languageCode;
        ssmlGender = body.ssmlGender || google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL;
        voiceName = body.voiceName;

        if (!text || !languageCode) {
            appLogger.warn("[API /tts] Missing text or languageCode in request body.");
            return NextResponse.json({ error: "Missing required parameters: text and languageCode" }, { status: 400 });
        }
        if (body.ssmlGender && !(body.ssmlGender in google.cloud.texttospeech.v1.SsmlVoiceGender)) {
             appLogger.warn(`[API /tts] Invalid ssmlGender provided: ${body.ssmlGender}`);
             return NextResponse.json({ error: `Invalid ssmlGender value. Valid options are: ${Object.keys(google.cloud.texttospeech.v1.SsmlVoiceGender).join(', ')}` }, { status: 400 });
        }
    } catch (error) {
        appLogger.error("[API /tts] Failed to parse request body:", error);
        return NextResponse.json({ error: "Invalid request body. Expected JSON." }, { status: 400 });
    }

    appLogger.info(`[API /tts] Request received (using explicit GCP_... creds): lang=${languageCode}, gender=${ssmlGender}, voice=${voiceName ?? 'default'}, text="${text.substring(0, 50)}..."`);

    // Check for the specific credentials provided by the gcpvercel.com integration
    if (!process.env.GCP_PROJECT_ID || !process.env.GCP_SERVICE_ACCOUNT_EMAIL || !process.env.GCP_PRIVATE_KEY) {
         appLogger.error("[API /tts] Required GCP credentials (GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, GCP_PRIVATE_KEY) are not set in Vercel environment variables.");
         return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }
    
    try {
        // Explicitly configure the client with credentials from environment variables
        const credentials = {
            client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'), // Ensure newlines are correct
        };
        const projectId = process.env.GCP_PROJECT_ID;

        // Initialize client inside the handler with explicit credentials
        const ttsClient = new TextToSpeechClient({ credentials, projectId });

        const ttsRequest: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
            input: { text: text },
            voice: {
                languageCode: languageCode,
                ssmlGender: ssmlGender,
                ...(voiceName && { name: voiceName })
            },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(ttsRequest);

        if (response.audioContent instanceof Uint8Array) {
            const audioBase64 = Buffer.from(response.audioContent).toString('base64');
            appLogger.info(`[API /tts] Successfully generated TTS audio (using explicit creds) for lang: ${languageCode}`);
            return NextResponse.json({ audioContent: audioBase64 }, { status: 200 });
        } else {
             appLogger.error("[API /tts] TTS response did not contain valid audio content.", response);
            return NextResponse.json({ error: "TTS generation failed: Invalid audio content received." }, { status: 500 });
        }
    } catch (error: any) {
        appLogger.error('[API /tts] Google TTS API Error (using explicit creds):', error);
        const errorMessage = error.details || error.message || 'Unknown API error';
        return NextResponse.json({ error: `TTS generation failed: ${errorMessage}` }, { status: 500 });
    }
} 