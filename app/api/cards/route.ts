import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Tables } from "@/types/database";
import { appLogger, statusLogger } from '@/lib/logger';
type DbCard = Tables<'cards'>;

export const dynamic = 'force-dynamic'

// Expects card IDs in the request body
export async function POST(request: Request) {
  appLogger.info(`[API /api/cards] POST request received`);

  let cardIds: string[] = [];
  try {
    const body = await request.json();
    if (!Array.isArray(body.cardIds) || body.cardIds.length === 0) {
        throw new Error("cardIds array is required in the request body.");
    }
    cardIds = body.cardIds;
    appLogger.info(`[API /api/cards] Requesting details for ${cardIds.length} cards.`);
  } catch (e) {
    appLogger.error("[API /api/cards] Invalid request body:", e);
    return NextResponse.json({ error: 'Invalid request body. Expecting { "cardIds": [...] }' }, { status: 400 })
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    appLogger.error('[API /api/cards] Auth error or no session', sessionError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    appLogger.info(`[API /api/cards] Fetching cards for user: ${session.user.id}`);
    const { data: dbCards, error: fetchError } = await supabase
      .from('cards')
      .select(`*`) // Select all needed card fields
      .in('id', cardIds)
      // RLS policy should handle user access via deck relationship
      
    appLogger.info("[API /api/cards] Supabase fetch result:", { count: dbCards?.length, fetchError });

    if (fetchError) {
      appLogger.error("[API /api/cards] Supabase fetch error:", fetchError);
      throw fetchError;
    }

    if (!dbCards) {
      // This shouldn't happen if fetchError is null, but good practice
      return NextResponse.json({ cards: [] }) 
    }
    
    // Return the raw DbCard data - mapping will happen on client if needed, 
    // or adjust DbCard type to match FlashCard needs exactly
    return NextResponse.json({ cards: dbCards })

  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     appLogger.error('[API /api/cards] Caught error:', errorMessage, error);
     return NextResponse.json({ error: 'Failed to fetch card details', details: errorMessage }, { status: 500 })
  }
} 