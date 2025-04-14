'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { StudySetBuilder } from '@/components/study/StudySetBuilder'; // Adjust path if needed
import { getStudySet, updateStudySet } from '@/lib/actions/studySetActions'; // Import actions
import type { StudyQueryCriteria } from '@/lib/schema/study-query.schema';
import type { Tables } from '@/types/database'; // Import Tables
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2 as IconLoader, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
            console.log(`[EditStudySetPage] Fetching data for set ID: ${studySetId}`);
            try {
                const result = await getStudySet(studySetId);
                if (result.error) {
                    setError(result.error);
                    toast.error("Failed to load study set", { description: result.error });
                    // Optionally redirect if not found/authorized
                    // router.replace('/study/sets'); 
                } else if (result.data) {
                    setInitialData(result.data);
                    console.log("[EditStudySetPage] Initial data loaded:", result.data);
                } else {
                     // Handle case where data is null but no specific error (e.g., not found)
                     setError("Study set not found or you do not have permission to edit it.");
                     toast.error("Study set not found.");
                     // Optionally redirect
                     // router.replace('/study/sets');
                }
            } catch (err) {
                console.error(`[EditStudySetPage] Unexpected error fetching study set:`, err);
                const message = err instanceof Error ? err.message : "An unexpected error occurred.";
                setError(message);
                toast.error("Error loading study set", { description: message });
            } finally {
                setIsLoading(false);
            }
        };

        fetchSetData();
    }, [studySetId, router]); // Depend on studySetId and router

    // Handle saving updates
    const handleUpdateStudySet = useCallback(async (data: StudySetSaveData) => {
        if (!studySetId) {
            toast.error("Cannot save: Study Set ID is missing.");
            return;
        }
        setIsSaving(true);
        console.log(`[EditStudySetPage] Updating study set ${studySetId}:`, data);
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
            console.error(`[EditStudySetPage] Unexpected error updating study set:`, err);
            toast.error("An unexpected error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    }, [studySetId, router]);

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
        <div className="container mx-auto p-4 md:p-6 max-w-4xl">
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
        </div>
    );
} 