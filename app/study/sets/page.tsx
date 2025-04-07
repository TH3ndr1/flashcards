'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStudySets } from '@/hooks/useStudySets';
import { deleteStudySet } from '@/lib/actions/studySetActions';
import { useStudySessionStore, StudyInput } from '@/store/studySessionStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { Loader2 as IconLoader, Edit, Trash2, Play, BookOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { DbStudySet } from '@/types/database'; // Use DbStudySet type
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal } from "lucide-react"


export default function ListStudySetsPage() {
  const router = useRouter();
  const { studySets, isLoading, error, refetchStudySets } = useStudySets();
  const setStudyParameters = useStudySessionStore((state) => state.setStudyParameters);
  const [deletingId, setDeletingId] = useState<string | null>(null); // Track which set is being deleted

  const handleStudy = (studySetId: string, mode: 'learn' | 'review') => {
    console.log(`[ListStudySetsPage] Starting session for Set ID: ${studySetId}, Mode: ${mode}`);
    // Prepare the input for the store/action
    const actionInput: StudyInput = { studySetId: studySetId };
    setStudyParameters(actionInput, mode);
    router.push('/study/session');
  };

  const handleDelete = async (studySet: DbStudySet) => {
    setDeletingId(studySet.id);
    console.log(`[ListStudySetsPage] Deleting study set: ${studySet.name} (${studySet.id})`);
    try {
      const result = await deleteStudySet(studySet.id);
      if (result.error) {
        toast.error(`Failed to delete "${studySet.name}"`, { description: result.error });
      } else {
        toast.success(`Study Set "${studySet.name}" deleted.`);
        await refetchStudySets(); // Refresh the list
      }
    } catch (err) {
      console.error(`[ListStudySetsPage] Unexpected error deleting study set:`, err);
      toast.error("An unexpected error occurred while deleting.");
    } finally {
      setDeletingId(null);
    }
  };

  // --- Render Logic ---

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Smart Playlists</h1>
        <Button asChild>
          <Link href="/study/sets/new">Create New Playlist</Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center h-40">
           <IconLoader className="h-6 w-6 animate-spin mr-2" /> Loading playlists...
        </div>
      )}

      {error && (
         <Alert variant="destructive"><Terminal className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      )}

      {!isLoading && !error && studySets.length === 0 && (
        <p className="text-center text-muted-foreground mt-10">You haven't created any smart playlists yet.</p>
      )}

      {!isLoading && !error && studySets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studySets.map((set) => (
            <Card key={set.id}>
              <CardHeader>
                <CardTitle>{set.name}</CardTitle>
                {set.description && (
                  <CardDescription>{set.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                 <p className="text-xs text-muted-foreground">
                    Last updated: {formatDistanceToNow(new Date(set.updated_at), { addSuffix: true })}
                 </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                 {/* Delete Button */}
                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={deletingId === set.id} aria-label={`Delete ${set.name}`}>
                        {deletingId === set.id ? <IconLoader className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                      </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete "{set.name}"?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletingId === set.id}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(set)} disabled={deletingId === set.id} className="bg-destructive hover:bg-destructive/90">
                            {deletingId === set.id ? <IconLoader className="h-4 w-4 animate-spin mr-2"/> : null} Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                 </AlertDialog>

                {/* Edit Button */}
                 <Button variant="outline" size="sm" asChild>
                   <Link href={`/study/sets/${set.id}/edit`} aria-label={`Edit ${set.name}`}> 
                      <Edit className="h-4 w-4 mr-1" /> Edit 
                   </Link>
                 </Button>

                 {/* Study Buttons */}
                  <Button size="sm" onClick={() => handleStudy(set.id, 'review')} aria-label={`Review ${set.name}`}>
                     <Play className="h-4 w-4 mr-1" /> Review
                  </Button>
                  {/* Optionally add a separate Learn button if desired */}
                  {/* <Button size="sm" variant="secondary" onClick={() => handleStudy(set.id, 'learn')} aria-label={`Learn ${set.name}`}>
                     <BookOpen className="h-4 w-4 mr-1" /> Learn
                  </Button> */}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 