import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StoriesPageClient } from '@/components/stories/StoriesPageClient';

export const metadata = {
  title: 'Stories',
};

export default async function StoriesPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <StoriesPageClient />;
}
