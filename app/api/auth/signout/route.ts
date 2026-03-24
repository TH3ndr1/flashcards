import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { appLogger } from '@/lib/logger';

/**
 * Hard server-side sign-out.
 * Called via a plain href navigation so it works even when the client-side
 * auth state is in a phantom/broken state (where supabase.auth.signOut()
 * on the client silently fails because the session is already invalid).
 *
 * Steps:
 *  1. Call supabase.auth.signOut() server-side to invalidate the session token.
 *  2. Clear all Supabase auth cookies from the response.
 *  3. Redirect to /login.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  try {
    const supabase = createServerClient();
    await supabase.auth.signOut();
  } catch (e) {
    // Even if sign-out fails (e.g. token already invalid), we still clear cookies
    appLogger.warn('Server-side signOut error (continuing to clear cookies):', e);
  }

  // Redirect to login — the @supabase/ssr server client will have cleared the
  // auth cookies when it processed the signOut (or the session was already gone).
  const response = NextResponse.redirect(`${origin}/login`);

  // Belt-and-suspenders: explicitly delete known Supabase cookie names so the
  // browser has no lingering session even if the server call failed.
  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token',
    `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/\/\/([^.]+)/)?.[1]}-auth-token`,
  ];

  cookiesToClear.forEach(name => {
    response.cookies.set(name, '', {
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  });

  return response;
}
