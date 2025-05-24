import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server'; // Assuming this exists

export default async function RootPage() {
  // Optional: Check auth and redirect to /login if not authenticated,
  // or let middleware handle that.
  // For an authenticated user, redirect to the new default practice page.
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login'); // Or your primary login page
  } else {
    redirect('/practice/decks'); // Or '/[locale]/practice/decks' if using i18n
  }
  // This page might not render anything itself if it always redirects.
  return null;
}