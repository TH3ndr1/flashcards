import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ComingSoonPageClient } from '@/components/study-method/ComingSoonPageClient';

export const metadata = {
  title: 'Knowledge Graphs',
};

export default async function KnowledgeGraphsPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return <ComingSoonPageClient type="knowledge-graph" />;
}
