import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserStudySets } from '@/lib/actions/studySetActions';
import { StudySetListClient } from '../../../components/study/StudySetListClient';

/**
 * Study Sets listing page (Smart Playlists).
 * 
 * This is a Server Component that pre-fetches all study sets server-side
 * before rendering the page, eliminating client-side data fetching delays.
 * 
 * @returns {Promise<JSX.Element>} The Study Sets page with pre-fetched data
 */
export default async function ListStudySetsPage() {
  // Check authentication server-side
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (!session || authError) {
    redirect('/login');
  }

  // Pre-fetch all study sets in a single server-side request
  const { data: studySets, error: fetchError } = await getUserStudySets();

  const hasErrors = Boolean(fetchError);

  return (
    <div className="py-4 px-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Smart Playlists</h1>
        <Button asChild>
          <Link href="/study/sets/new">Create New Playlist</Link>
        </Button>
      </div>
      <StudySetListClient initialData={studySets || []} />
    </div>
  );
} 