import { NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';

// It's often better to initialize the client once outside the handler
// if the environment supports it (e.g., not edge functions without global state).
// However, initializing inside is safer for broad serverless compatibility.
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
        // Provide a default gender if not specified in the request
        ssmlGender = body.ssmlGender || google.cloud.texttospeech.v1.SsmlVoiceGender.NEUTRAL;
        voiceName = body.voiceName;

        // Basic validation
        if (!text || !languageCode) {
            console.warn("[API /tts] Missing text or languageCode in request body.");
            return NextResponse.json({ error: "Missing required parameters: text and languageCode" }, { status: 400 });
        }

        // Validate ssmlGender if provided
        if (body.ssmlGender && !(body.ssmlGender in google.cloud.texttospeech.v1.SsmlVoiceGender)) {
             console.warn(`[API /tts] Invalid ssmlGender provided: ${body.ssmlGender}`);
             return NextResponse.json({ error: `Invalid ssmlGender value. Valid options are: ${Object.keys(google.cloud.texttospeech.v1.SsmlVoiceGender).join(', ')}` }, { status: 400 });
        }

    } catch (error) {
        console.error("[API /tts] Failed to parse request body:", error);
        return NextResponse.json({ error: "Invalid request body. Expected JSON." }, { status: 400 });
    }

    console.log(`[API /tts] Request received: lang=${languageCode}, gender=${ssmlGender}, voice=${voiceName ?? 'default'}, text="${text.substring(0, 50)}..."`);

    // Check for Google Cloud credentials
    const hasCredentialsFile = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const hasIndividualCreds = !!process.env.GCP_PROJECT_ID && !!process.env.GCP_SERVICE_ACCOUNT_EMAIL && !!process.env.GCP_PRIVATE_KEY;

    if (!hasCredentialsFile && !hasIndividualCreds) {
         console.error("[API /tts] Google Cloud credentials are not set properly in environment variables (checked GOOGLE_APPLICATION_CREDENTIALS, GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, GCP_PRIVATE_KEY).");
         // Return a generic error to the client for security
         return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    try {
        // Explicitly configure the client with credentials from environment variables
        const credentials = {
            client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
            private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Ensure newlines are correct
            project_id: process.env.GCP_PROJECT_ID,
        };

        // Initialize client inside the handler with explicit credentials
        const ttsClient = new TextToSpeechClient({ credentials, projectId: credentials.project_id });

        const ttsRequest: google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
            input: { text: text },
            voice: {
                languageCode: languageCode,
                ssmlGender: ssmlGender,
                // Only include name if it's provided and not null/empty
                ...(voiceName && { name: voiceName })
            },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await ttsClient.synthesizeSpeech(ttsRequest);

        if (response.audioContent instanceof Uint8Array) {
            const audioBase64 = Buffer.from(response.audioContent).toString('base64');
            console.log(`[API /tts] Successfully generated TTS audio for lang: ${languageCode}`);
            return NextResponse.json({ audioContent: audioBase64 }, { status: 200 });
        } else {
             console.error("[API /tts] TTS response did not contain valid audio content.", response);
            return NextResponse.json({ error: "TTS generation failed: Invalid audio content received." }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[API /tts] Google TTS API Error:', error);
        // Attempt to provide a more specific error message if available, but keep it generic for the client
        const errorMessage = error.details || error.message || 'Unknown API error';
        return NextResponse.json({ error: `TTS generation failed: ${errorMessage}` }, { status: 500 }); // Use 500 for API/server errors
    }
} 