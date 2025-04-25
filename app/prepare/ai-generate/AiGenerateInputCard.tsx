// app/prepare/ai-generate/AiGenerateInputCard.tsx
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, BotMessageSquare, FileText } from 'lucide-react';
import { MediaCaptureTabs } from '@/components/media-capture-tabs';

// Constants defined here or imported from a central constants file
const SUPPORTED_FILE_TYPES = "PDF, JPG, JPEG, PNG, GIF, BMP, WEBP";
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 25; // 25MB
const MAX_IMAGES = 10; // Example limit

interface AiGenerateInputCardProps {
    files: File[];
    isLoading: boolean;
    error: string | null;
    onFilesSelected: (selectedFiles: File[]) => void;
    onSubmit: (e: React.FormEvent) => Promise<void>; // Make onSubmit async if needed
    onClearAll: () => void;
    // Add props for any other display elements needed, e.g., results exist to show clear button
    hasResults: boolean;
}

export function AiGenerateInputCard({
    files,
    isLoading,
    error,
    onFilesSelected,
    onSubmit,
    onClearAll,
    hasResults
}: AiGenerateInputCardProps) {
    return (
        <Card className="sticky top-4"> {/* Make input card sticky */}
            <CardHeader className="px-4 sm:px-6 py-4">
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> 1. Upload Source</CardTitle>
                <CardDescription> Upload PDF/Image files or use camera. </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4">
                {/* Pass onSubmit directly to the form */}
                <form onSubmit={onSubmit}>
                    <div className="mb-4">
                        <MediaCaptureTabs
                            onFilesSelected={onFilesSelected} // Pass down the handler
                            supportedFileTypes={SUPPORTED_FILE_TYPES}
                            supportedExtensions={SUPPORTED_EXTENSIONS}
                            maxFileSize={MAX_FILE_SIZE}
                            maxImages={MAX_IMAGES}
                            // Pass current files ONLY if MediaCaptureTabs needs to display them
                            // initialFiles={files}
                        />
                        {/* Display error specific to input/validation */}
                        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button type="submit" disabled={isLoading || !files || files.length === 0} className="flex-1">
                            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : <><BotMessageSquare className="mr-2 h-4 w-4" /> Generate Flashcards</>}
                        </Button>
                        {/* Show Clear button if files selected OR results exist */}
                        {(files.length > 0 || hasResults) && !isLoading && (
                            <Button type="button" variant="outline" onClick={onClearAll}> Clear All </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}