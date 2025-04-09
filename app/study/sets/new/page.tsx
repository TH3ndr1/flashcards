'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StudySetBuilder } from '@/components/study/StudySetBuilder'; // Adjust path if needed
import { createStudySet } from '@/lib/actions/studySetActions'; // Import the create action
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button'; // For potential cancel button
import Link from 'next/link'; // For linking back

export default function NewStudySetPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveStudySet = useCallback(async (data: {
    name: string;
    description: string | null;
    criteria: StudyQueryCriteria;
  }) => {
    setIsSaving(true);
    console.log("[NewStudySetPage] Saving new study set:", data);
    try {
      const result = await createStudySet(data);
      if (result.error) {
        toast.error("Failed to create study set", { description: result.error });
      } else {
        toast.success(`Study Set "${result.data?.name}" created successfully!`);
        // Navigate back to the list page (adjust path if different)
        router.push('/study/sets'); 
        // Optional: revalidate list page path if needed, though action might handle it
        // revalidatePath('/study/sets'); 
      }
    } catch (err) {
      console.error("[NewStudySetPage] Unexpected error saving study set:", err);
      toast.error("An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  }, [router]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Create New Smart Playlist</h1>
        <Button variant="outline" asChild>
          <Link href="/study/sets">Cancel</Link>
        </Button>
      </div>

      <StudySetBuilder 
        onSave={handleSaveStudySet} 
        isSaving={isSaving} 
        // No initialData is passed for creating a new set
      />
    </div>
  );
} 