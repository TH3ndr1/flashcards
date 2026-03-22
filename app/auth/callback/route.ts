import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { appLogger, statusLogger } from '@/lib/logger'

/**
 * Handles the GET request for the authentication callback.
 * This route is hit when the user clicks the email confirmation link sent by Supabase.
 * It exchanges the provided code for a user session.
 * 
 * @param {Request} request The incoming request object.
 * @returns {Promise<NextResponse>} A response object, typically a redirect.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createServerClient()
    try {
      const { error, data } = await supabase.auth.exchangeCodeForSession(code)

      if (!error && data.session) {
        // Email confirmed, session created successfully.
        // Redirect to the `next` page or home page.
        appLogger.info(`Auth callback successful, redirecting to ${next}`);
        return NextResponse.redirect(`${origin}${next}`) // Redirect to next page
      } else {
        // Handle errors during code exchange
        appLogger.error('Auth callback error during code exchange:', error?.message);

        // Check for common errors indicating the link was already used, expired, or invalid
        const isInvalidGrantError = error?.message?.toLowerCase().includes('invalid grant') || 
                                  error?.message?.toLowerCase().includes('invalid or expired') ||
                                  error?.message?.toLowerCase().includes('already confirmed');

        if (isInvalidGrantError) {
          // Redirect to login with a message indicating the issue (already confirmed, expired link, etc.)
          return NextResponse.redirect(`${origin}/login?message=email_already_confirmed_or_link_invalid`);
        } else {
           // Redirect to login page with a generic error for other issues
          return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
        }
      }
    } catch (e) {
      // Catch unexpected errors during the process
      appLogger.error('Auth callback unexpected error:', e);
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
    }
  }

  // If no code is present in the URL, redirect to login with an error
  appLogger.warn('Auth callback called without a code.');
  return NextResponse.redirect(`${origin}/login?error=missing_confirmation_code`);
} 