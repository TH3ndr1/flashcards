'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StudySetBuilder } from '@/components/study/StudySetBuilder'; // Adjust path if needed
import { getStudySet, updateStudySet, deleteStudySet } from '@/lib/actions/studySetActions'; // Import actions
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import type { Tables } from '@/types/database'; // Import Tables
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2 as IconLoader, AlertTriangle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { appLogger, statusLogger } from '@/lib/logger';

// Define the DbStudySet type using Tables
type DbStudySet = Tables<'study_sets'>;

// Define the type for the data passed to the onSave callback
interface StudySetSaveData {
    name: string;
    description: string | null;
    criteria: StudyQueryCriteria;
}

export default function EditStudySetPage() {
    const router = useRouter();
    const params = useParams();
    const studySetId = params.studySetId as string; // Get ID from route params

    const [initialData, setInitialData] = useState<DbStudySet | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Loading initial data
    const [isSaving, setIsSaving] = useState(false); // Saving updates
    const [isDeleting, setIsDeleting] = useState(false); // Added deleting state
    const [error, setError] = useState<string | null>(null);

    // Fetch initial study set data
    useEffect(() => {
        if (!studySetId) {
            setError("Study Set ID not found in URL.");
            setIsLoading(false);
            return;
        }

        const fetchSetData = async () => {
            setIsLoading(true);
            setError(null);
            appLogger.info(`[EditStudySetPage] Fetching data for set ID: ${studySetId}`);
            try {
                const result = await getStudySet(studySetId);
                if (result.error) {
                    setError(result.error);
                    toast.error("Failed to load study set", { description: result.error });
                    // Optionally redirect if not found/authorized
                    // router.replace('/study/sets'); 
                } else if (result.data) {
                    setInitialData(result.data);
                    appLogger.info("[EditStudySetPage] Initial data loaded:", result.data);
                } else {
                     // Handle case where data is null but no specific error (e.g., not found)
                     setError("Study set not found or you do not have permission to edit it.");
                     toast.error("Study set not found.");
                     // Optionally redirect
                     // router.replace('/study/sets');
                }
            } catch (err) {
                appLogger.error(`[EditStudySetPage] Unexpected error fetching study set:`, err);
                const message = err instanceof Error ? err.message : "An unexpected error occurred.";
                setError(message);
                toast.error("Error loading study set", { description: message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSetData();
    }, [studySetId]); // Removed router dependency as it doesn't change

    // Handle saving updates
    const handleUpdateStudySet = useCallback(async (data: StudySetSaveData) => {
        if (!studySetId) {
            toast.error("Cannot save: Study Set ID is missing.");
            return;
        }
        setIsSaving(true);
        appLogger.info(`[EditStudySetPage] Updating study set ${studySetId}:`, data);
        try {
            const result = await updateStudySet(studySetId, data); // Pass ID and updated data
            if (result.error) {
                toast.error("Failed to update study set", { description: result.error });
            } else {
                toast.success(`Study Set "${result.data?.name}" updated successfully!`);
                // Optionally navigate back or refresh data
                router.push('/study/sets'); // Navigate back to list on success
                 // Or maybe just refresh initial data if staying on page:
                 // setInitialData(result.data); // Update local state with saved data
            }
        } catch (err) {
            appLogger.error(`[EditStudySetPage] Unexpected error updating study set:`, err);
            toast.error("An unexpected error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    }, [studySetId, router]);

    // Added handleDelete function
    const handleDelete = useCallback(async () => {
        if (!studySetId || !initialData) {
            toast.error("Cannot delete: Study Set data missing.");
            return;
        }
        setIsDeleting(true);
        const setName = initialData.name;
        appLogger.info(`[EditStudySetPage] Deleting study set: ${setName} (${studySetId})`);
        try {
            const result = await deleteStudySet(studySetId);
            if (result.error) {
                toast.error(`Failed to delete "${setName}"`, { description: result.error });
            } else {
                toast.success(`Study Set "${setName}" deleted.`);
                router.push('/study/sets'); // Navigate back to list on success
            }
        } catch (err) {
            appLogger.error(`[EditStudySetPage] Unexpected error deleting study set:`, err);
            toast.error("An unexpected error occurred while deleting.");
        } finally {
            setIsDeleting(false); // Ensure state is reset even on error
        }
    }, [studySetId, initialData, router]);

    // --- Render Logic ---

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <IconLoader className="h-8 w-8 animate-spin mr-2" /> Loading study set...
            </div>
        );
    }

    if (error) {
         return (
            <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
                <Alert variant="destructive" className="max-w-md">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error Loading Study Set</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={() => router.push('/study/sets')} className="mt-4" variant="outline">
                    Back to Playlists
                </Button>
            </div>
        );
    }

    if (!initialData) {
        // Should ideally be covered by error state, but acts as a final fallback
        return <div className="container mx-auto p-4">Study set data could not be loaded.</div>;
    }

    return (
        <div className="py-4 px-4 md:p-6 max-w-4xl mx-auto">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Edit Smart Playlist</h1>
                <Button variant="outline" asChild>
                    <Link href="/study/sets">Cancel</Link>
                </Button>
             </div>

            <StudySetBuilder
                // Pass the fetched data, ensuring criteria is included
                initialData={{
                    id: initialData.id,
                    name: initialData.name,
                    description: initialData.description,
                    criteria: initialData.query_criteria as StudyQueryCriteria, // Cast criteria
                }}
                onSave={handleUpdateStudySet}
                isSaving={isSaving}
            />

            {/* Added Delete Section */}
            <div className="mt-8 pt-6 border-t border-dashed border-destructive/50">
                <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">Deleting this playlist cannot be undone.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting || isSaving}>
                       <Trash2 className="mr-2 h-4 w-4" /> Delete Playlist
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{initialData.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone. This will permanently delete the smart playlist definition, but will not delete any actual cards.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                       <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                       <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? <IconLoader className="h-4 w-4 animate-spin mr-2"/> : null} Delete
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
} 