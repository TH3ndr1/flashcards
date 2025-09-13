import { DeckListClient } from "@/components/DeckListClient";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Ensure fresh data on every request - prevent caching issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Home page component.
 * 
 * This is a Server Component that handles authentication check and redirects
 * unauthenticated users to the login page. The actual deck data is fetched
 * client-side using real-time subscriptions for cross-device synchronization.
 * 
 * @returns {Promise<JSX.Element>} The Home page with real-time deck list
 */
export default async function Home() {
  // Check authentication server-side
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  // Redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }
  
  return (
    <div className="grid gap-4">
      <DeckListClient />
    </div>
  );
}

