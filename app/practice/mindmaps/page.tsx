import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ComingSoonPageClient } from '@/components/study-method/ComingSoonPageClient';

export const metadata = {
  title: 'Mind Maps',
};

export default async function MindMapsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <ComingSoonPageClient type="mindmap" />;
}
