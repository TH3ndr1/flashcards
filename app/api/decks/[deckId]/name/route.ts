import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { appLogger, statusLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic' // Ensure dynamic execution

export async function GET(
  request: Request,
  { params }: { params: { deckId: string } }
) {
  const { deckId } = params
  appLogger.info(`[API /api/decks/name] GET request for deckId: ${deckId}`);

  if (!deckId) {
    appLogger.error("[API /api/decks/name] Missing deckId param.");
    return NextResponse.json({ error: 'Missing deckId' }, { status: 400 })
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // Check user session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    appLogger.error('[API /api/decks/name] Auth error or no session', sessionError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    appLogger.info(`[API /api/decks/name] Querying decks table for id: ${deckId} and user_id: ${session.user.id}`);
    const { data, error } = await supabase
      .from('decks')
      .select('name') // Select the correct column
      .eq('id', deckId)
      .eq('user_id', session.user.id)
      .single()

    appLogger.info("[API /api/decks/name] Supabase query result:", { data, error });

    if (error) {
      appLogger.error("[API /api/decks/name] Supabase query error:", error);
      // Handle specific errors like not found vs other DB errors
      if (error.code === 'PGRST116') { // PostgREST code for "Relation does not exist" or similar (check actual code if needed)
         return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
      }
      throw error; // Re-throw other errors
    }

    if (!data) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    appLogger.info("[API /api/decks/name] Successfully fetched name:", data.name);
    // Return just the name
    return NextResponse.json({ name: data.name })

  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     appLogger.error('[API /api/decks/name] Caught error:', errorMessage, error);
     return NextResponse.json({ error: 'Failed to fetch deck name', details: errorMessage }, { status: 500 })
  }
} 