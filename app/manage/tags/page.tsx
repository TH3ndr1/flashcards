import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getTags } from '@/lib/actions/tagActions';
import { TagManagerClient } from '@/components/tags/TagManagerClient';

/**
 * Tags Management Page
 * 
 * This is a Server Component that pre-fetches all tags server-side
 * before rendering the page, eliminating client-side data fetching delays.
 * 
 * @returns {Promise<JSX.Element>} The Tags page with pre-fetched data
 */
export default async function ManageTagsPage() {
  // Check authentication server-side
  const supabase = createServerClient();
  const { data: { session }, error: authError } = await supabase.auth.getSession();
  
  if (!session || authError) {
    redirect('/login');
  }

  // Pre-fetch all tags in a single server-side request
  const { data: tags, error: fetchError } = await getTags();

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center">
        <Button asChild variant="ghost" size="icon" className="mr-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Manage Tags</h1>
      </div>
      
      <TagManagerClient initialTags={tags || []} />
    </div>
  );
} 