import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { DbCard } from "@/types/database";

export const dynamic = 'force-dynamic'

// Expects card IDs in the request body
export async function POST(request: Request) {
  console.log(`[API /api/cards] POST request received`);

  let cardIds: string[] = [];
  try {
    const body = await request.json();
    if (!Array.isArray(body.cardIds) || body.cardIds.length === 0) {
        throw new Error("cardIds array is required in the request body.");
    }
    cardIds = body.cardIds;
    console.log(`[API /api/cards] Requesting details for ${cardIds.length} cards.`);
  } catch (e) {
    console.error("[API /api/cards] Invalid request body:", e);
    return NextResponse.json({ error: 'Invalid request body. Expecting { "cardIds": [...] }' }, { status: 400 })
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error('[API /api/cards] Auth error or no session', sessionError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[API /api/cards] Fetching cards for user: ${session.user.id}`);
    const { data: dbCards, error: fetchError } = await supabase
      .from('cards')
      .select(`*`) // Select all needed card fields
      .in('id', cardIds)
      // RLS policy should handle user access via deck relationship
      
    console.log("[API /api/cards] Supabase fetch result:", { count: dbCards?.length, fetchError });

    if (fetchError) {
      console.error("[API /api/cards] Supabase fetch error:", fetchError);
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
     console.error('[API /api/cards] Caught error:', errorMessage, error);
     return NextResponse.json({ error: 'Failed to fetch card details', details: errorMessage }, { status: 500 })
  }
} 