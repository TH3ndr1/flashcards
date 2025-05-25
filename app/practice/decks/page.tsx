import { DeckListClient } from "@/components/DeckListClient";
// import { getDecksWithSrsCounts } from "@/lib/actions/deckActions"; // Deprecated
import { getDecks } from "@/lib/actions/deckActions"; // Use the new function
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { appLogger, statusLogger } from '@/lib/logger';

/**
 * Home page component.
 * 
 * This is a Server Component that pre-fetches deck data with all SRS counts
 * server-side before rendering the page. This eliminates client-side requests
 * and provides a faster initial load experience.
 * 
 * The page is protected and requires authentication. If the user is not
 * authenticated, they are redirected to the login page.
 * 
 * @returns {Promise<JSX.Element>} The Home page with pre-fetched data
 */
export default async function Home() {
  // Check authentication server-side
  const cookieStore = cookies();
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  // Redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }
  
  // Fetch all deck data with SRS counts in a single database call using the new function
  const { data: decksWithCounts, error: fetchError } = await getDecks();
  
  // Log any fetch errors but still render the page (client will handle empty state)
  if (fetchError) {
    appLogger.error("Error fetching decks with counts:", fetchError);
  }
  
  return (
    <div className="grid gap-4">
      <DeckListClient initialData={decksWithCounts || []} />
    </div>
  );
}

