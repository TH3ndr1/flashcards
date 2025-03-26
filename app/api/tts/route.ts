
import { NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const LANGUAGE_CODES: Record<string, string> = {
  en: "en-US",
  nl: "nl-NL",
  fr: "fr-FR",
};


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
  try {
    const { text, language = 'en-US' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log('TTS API using language:', language);

    // Call Google Cloud TTS API
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: language, ssmlGender: 'NEUTRAL' },
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
