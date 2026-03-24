// app/api/stories/route.ts
/**
 * API Route for story generation and management.
 * POST  /api/stories  — generate (or return cached) story for a deck
 * PATCH /api/stories  — update paragraph edits for an existing story
 */
import { NextRequest, NextResponse } from 'next/server';
import { createActionClient } from '@/lib/supabase/server';
import { validateConfiguration } from '../extract-pdf/config';
import { generateStory } from './storyGeneratorService';
import { GenerationApiError } from '../extract-pdf/types';
import { computeCardsHash } from '@/lib/utils/storyHash';
import { appLogger } from '@/lib/logger';
import type { StoryParagraph, ReadingTimeMin, StoryFormat } from '@/types/story';
import type { Json } from '@/types/database';

// App Router: top-level exports for runtime and max function duration
export const runtime = 'nodejs';
export const maxDuration = 120;

// --- POST: Generate or return cached story ---

const VALID_READING_TIMES = ['minimal', 5, 10, 20] as const;
const VALID_FORMATS: StoryFormat[] = ['narrative', 'summary', 'dialogue', 'analogy'];

interface GeneratePayload {
  deckId: string;
  readingTimeMin: ReadingTimeMin;
  storyFormat: StoryFormat;
  age: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  appLogger.info('[API Stories POST] Request received');

  if (!validateConfiguration()) {
    return NextResponse.json(
      { success: false, message: 'Server configuration error.', code: 'INVALID_CONFIG' },
      { status: 500 }
    );
  }

  try {
    // --- Auth ---
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // --- Parse payload ---
    let payload: GeneratePayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON payload.', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { deckId, readingTimeMin, storyFormat, age } = payload;
    if (!deckId || !readingTimeMin || !age) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: deckId, readingTimeMin, age.', code: 'INVALID_PAYLOAD' },
        { status: 400 }
      );
    }
    if (!(VALID_READING_TIMES as readonly unknown[]).includes(readingTimeMin)) {
      return NextResponse.json(
        { success: false, message: 'readingTimeMin must be minimal, 5, 10, or 20.', code: 'INVALID_PAYLOAD' },
        { status: 400 }
      );
    }
    const format: StoryFormat = VALID_FORMATS.includes(storyFormat) ? storyFormat : 'narrative';

    // --- Fetch deck ---
    const { data: deck, error: deckError } = await supabase
      .from('decks')
      .select('id, name, is_bilingual, primary_language, secondary_language')
      .eq('id', deckId)
      .eq('user_id', user.id)
      .single();

    if (deckError || !deck) {
      return NextResponse.json(
        { success: false, message: 'Deck not found.', code: 'DECK_NOT_FOUND' },
        { status: 404 }
      );
    }

    // --- Fetch active cards ---
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('question, answer')
      .eq('deck_id', deckId)
      .eq('status', 'active');

    if (cardsError || !cards) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch cards.', code: 'CARDS_FETCH_ERROR' },
        { status: 500 }
      );
    }

    if (cards.length === 0) {
      return NextResponse.json(
        { success: false, message: 'This deck has no active cards.', code: 'NO_CARDS' },
        { status: 400 }
      );
    }

    const deckMode = deck.is_bilingual ? 'translation' : 'knowledge';
    const cardsHash = computeCardsHash(cards);

    // --- Check cache (keyed by deck, user, age, reading time, format, and card content) ---
    const { data: existing } = await supabase
      .from('stories')
      .select('*')
      .eq('deck_id', deckId)
      .eq('user_id', user.id)
      .eq('age_at_generation', age)
      .eq('reading_time_min', readingTimeMin === 'minimal' ? 0 : readingTimeMin)
      .eq('story_format', format)
      .eq('cards_hash', cardsHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      appLogger.info(`[API Stories POST] Cache hit for deck ${deckId}`);
      const duration = Date.now() - startTime;
      return NextResponse.json({ success: true, story: existing, cached: true, processingTimeMs: duration });
    }

    // --- Generate new story ---
    appLogger.info(`[API Stories POST] Cache miss — generating story for deck ${deckId}`);
    const generated = await generateStory({
      cards,
      mode: deckMode,
      primaryLanguage: deck.primary_language,
      secondaryLanguage: deck.secondary_language,
      age,
      readingTimeMin,
      storyFormat: format,
    });

    // Store 'minimal' as 0 in the DB (integer column)
    const readingTimeDb = readingTimeMin === 'minimal' ? 0 : readingTimeMin;

    // --- Save to DB ---
    const { data: saved, error: insertError } = await supabase
      .from('stories')
      .insert({
        deck_id: deckId,
        user_id: user.id,
        age_at_generation: age,
        reading_time_min: readingTimeDb,
        cards_hash: cardsHash,
        deck_mode: deckMode,
        story_format: format,
        paragraphs: generated.paragraphs as unknown as Json,
      })
      .select()
      .single();

    if (insertError || !saved) {
      appLogger.error('[API Stories POST] Failed to save story:', insertError);
      return NextResponse.json(
        { success: false, message: 'Failed to save generated story.', code: 'SAVE_ERROR' },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    appLogger.info(`[API Stories POST] Story generated and saved. Duration: ${duration}ms`);
    return NextResponse.json({ success: true, story: saved, cached: false, processingTimeMs: duration });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : String(error);
    appLogger.error(`[API Stories POST] Unhandled error after ${duration}ms:`, msg);

    if (error instanceof GenerationApiError) {
      return NextResponse.json(
        { success: false, message: `AI Generation Error: ${msg}`, code: 'GENERATION_ERROR', processingTimeMs: duration },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: false, message: `Server error: ${msg}`, code: 'INTERNAL_SERVER_ERROR', processingTimeMs: duration },
      { status: 500 }
    );
  }
}

// --- PATCH: Save manual paragraph edits ---

interface PatchPayload {
  storyId: string;
  paragraphs: StoryParagraph[];
}

export async function PATCH(request: NextRequest) {
  appLogger.info('[API Stories PATCH] Request received');

  try {
    const supabase = createActionClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    let payload: PatchPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON payload.', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const { storyId, paragraphs } = payload;
    if (!storyId || !Array.isArray(paragraphs)) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: storyId, paragraphs.', code: 'INVALID_PAYLOAD' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: story } = await supabase
      .from('stories')
      .select('id, user_id')
      .eq('id', storyId)
      .eq('user_id', user.id)
      .single();

    if (!story) {
      return NextResponse.json(
        { success: false, message: 'Story not found.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('stories')
      .update({
        paragraphs: paragraphs as unknown as Json,
        is_manually_edited: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', storyId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, message: 'Failed to update story.', code: 'UPDATE_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, story: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    appLogger.error('[API Stories PATCH] Unhandled error:', msg);
    return NextResponse.json(
      { success: false, message: `Server error: ${msg}`, code: 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}
