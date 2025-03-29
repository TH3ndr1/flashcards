import { NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Removed unnecessary mapping - we expect full language codes from the client
// const LANGUAGE_CODES: Record<string, string> = {
//   en: "en-US",
//   nl: "nl-NL",
//   fr: "fr-FR",
// };

// Removed unnecessary helper
// const getFullLanguageCode = (shortCode: string | undefined): string | undefined => {
//   if (!shortCode) return undefined;
//   return LANGUAGE_CODES[shortCode.toLowerCase()];
// };

export const getGCPCredentials = () => {
  // for Vercel, use environment variables
  return process.env.GCP_PRIVATE_KEY
    ? {
        credentials: {
          client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GCP_PRIVATE_KEY,
        },
        projectId: process.env.GCP_PROJECT_ID,
      }
      // for local development, use gcloud CLI
    : {};
};

// Initialize Google Cloud TTS client
const client = new TextToSpeechClient(getGCPCredentials());

export async function POST(request: Request) {
  // 1. Authentication Check
  const supabase = createSupabaseServerClient();
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error('TTS API: Authentication error or no session', sessionError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`TTS API: Request received from user ${session.user.id}`);

  try {
    // Expect full language code (e.g., "en-US", "nl-NL") directly from client
    const { text, language } = await request.json();

    // 2. Input Validation
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Use provided language code, default to en-US only if missing/empty
    const languageCodeForApi = language?.trim() || 'en-US';

    console.log('TTS API using language:', languageCodeForApi);

    // Call Google Cloud TTS API
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: languageCodeForApi, ssmlGender: 'NEUTRAL' },
      audioConfig: { audioEncoding: 'MP3' },
    });

    if (!response.audioContent) {
      throw new Error('Failed to generate speech');
    }

    // Return the audio as a response with appropriate headers
    return new NextResponse(response.audioContent, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('TTS Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
} 
