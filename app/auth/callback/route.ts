import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

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
  // The `next` parameter might be used if you want to redirect to a specific page after login
  // const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createServerClient()
    try {
      const { error, data } = await supabase.auth.exchangeCodeForSession(code)
      
      if (!error && data.session) {
        // Email confirmed, session created successfully.
        // Redirect to the main application page or a specified 'next' page.
        console.log('Auth callback successful, redirecting to /');
        return NextResponse.redirect(`${origin}/`) // Redirect to home page
      } else {
        // Handle errors during code exchange
        console.error('Auth callback error during code exchange:', error?.message);

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
      console.error('Auth callback unexpected error:', e);
      return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
    }
  }

  // If no code is present in the URL, redirect to login with an error
  console.warn('Auth callback called without a code.');
  return NextResponse.redirect(`${origin}/login?error=missing_confirmation_code`);
} 