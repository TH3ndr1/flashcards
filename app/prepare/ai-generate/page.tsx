'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download, Camera, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/hooks/use-supabase';
import { useAuth } from '@/hooks/use-auth';
import { v4 as uuidv4 } from 'uuid';
import { MediaCaptureTabs } from '@/components/media-capture-tabs';

interface Flashcard {
  question: string;
  answer: string;
  source?: string;
  fileType?: 'pdf' | 'image';
}

// Supported file types
const SUPPORTED_FILE_TYPES = "PDF, JPG, JPEG, PNG, GIF, BMP, WEBP";
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 25; // 25MB
const DIRECT_UPLOAD_LIMIT = 4; // 4MB - Use Supabase Storage for files larger than this
const COMBINED_SIZE_LIMIT = 4; // 4MB - Maximum combined size for direct API uploads (Vercel payload limit is 4.5MB)
const UPLOAD_BUCKET = 'ai-uploads'; // Bucket name

export default function AiGeneratePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
  const [processingSummary, setProcessingSummary] = useState<string | null>(null);
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentFileIndexRef = useRef<number>(0);

  // handleFilesSelected now directly updates the state, which is correct
  const handleFilesSelected = (selectedFiles: File[]) => {
    console.log(`App received ${selectedFiles.length} files from FileUpload component`);
    
    // This function receives the complete, updated list from FileUpload
    setFiles(Array.isArray(selectedFiles) ? [...selectedFiles] : []);
    
    // Clear the error when files are updated
    if (!selectedFiles || selectedFiles.length === 0) {
      console.log('No files received, clearing state');
    } else {
      console.log(`Files updated: ${selectedFiles.map(f => f.name).join(', ')}`);
    }
    setError(null);
  };

  // handleSubmit uses the state directly
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted");

    // Double check files state to ensure it's valid
    if (!files || !Array.isArray(files) || files.length === 0) {
      console.error('No files available for processing');
      setError('Please select or capture at least one file');
      return;
    }
    
    // Check that files is still a valid array with actual File objects
    const validFiles = files.filter(f => f instanceof File && f.name && f.size > 0);
    if (validFiles.length === 0) {
      console.error('No valid files found in state:', files);
      setError('No valid files found');
      return;
    }
    
    console.log(`Submit triggered with ${validFiles.length} files:`, validFiles.map(f => f.name));
    
    if (!supabase) {
      setError('Database connection not ready. Please wait a moment and try again.');
      return;
    }
    if (!user) {
      setError('You must be logged in to upload files.');
      return;
    }
    
    // Get fresh files state from the component to ensure we're using the most current value
    const currentFiles = files;
    console.log(`Submit triggered with ${currentFiles.length} files`);
    
    // Validate all files
    for (const file of currentFiles) {
      // Check if file extension is supported
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
        setError(`Unsupported file type in "${file.name}". Please select one of: ${SUPPORTED_EXTENSIONS.join(', ')}`);
        return;
      }

      // Check file size against MAX_FILE_SIZE 
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > MAX_FILE_SIZE) {
        setError(`File "${file.name}" too large (${fileSizeMB.toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE}MB.`);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setFlashcards([]);
    setExtractedTextPreview(null);
    setProcessingSummary(null);
    
    // Create a unique ID for this loading process
    const loadingToastId = `loading-${Date.now()}`;
    currentFileIndexRef.current = 0; // Reset file progress index
    
    // Clear any existing timers
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    
    // Initial loading toast
    const totalFiles = currentFiles.length;
    toast.loading(`Preparing ${totalFiles} file${totalFiles > 1 ? 's' : ''} for processing...`, { 
      id: loadingToastId, 
      duration: 90000 // Set to match our safetyTimeout
    });
    
    // Set a safety timeout to dismiss toasts if something goes wrong
    const safetyTimeout = setTimeout(() => {
      toast.dismiss(loadingToastId);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }, 90000);
    
    try {
      // Determine if any file is large BEFORE deciding fetch method
      const isAnyFileLarge = currentFiles.some(file => file.size > DIRECT_UPLOAD_LIMIT * 1024 * 1024);

      // Calculate total size of all files combined
      const totalSizeMB = currentFiles.reduce((sum, file) => sum + (file.size / (1024 * 1024)), 0);

      let response;
      
      // **** NEW LOGIC: If ANY file is large OR combined size is large, upload ALL to storage first ****
      if (isAnyFileLarge || totalSizeMB > COMBINED_SIZE_LIMIT) {
        const uploadReason = isAnyFileLarge 
          ? "Large file(s) detected" 
          : `Combined file size (${totalSizeMB.toFixed(2)}MB) exceeds direct upload limit`;
        
        toast.loading(`${uploadReason}. Uploading to secure storage...`, { 
          id: loadingToastId 
        });
        
        // Show dynamic progress for uploads
        let uploadedCount = 0;
        
        // Create array to store file references for API call
        const fileReferences: { filename: string; filePath: string }[] = [];
        const uploadPromises = currentFiles.map(async (file, index) => {
          const fileExt = file.name.split('.').pop();
          const storageFileName = `${uuidv4()}.${fileExt}`;
          const storagePath = `${user.id}/${storageFileName}`;
          
          try {
            // Update toast to show which file is being uploaded
            toast.loading(`Uploading file ${index + 1}/${totalFiles}: ${file.name}`, { 
              id: loadingToastId 
            });
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from(UPLOAD_BUCKET)
              .upload(storagePath, file, { upsert: false });
            
            if (uploadError) {
              console.error(`Failed to upload ${file.name} to storage:`, uploadError);
              throw new Error(`Storage upload failed for ${file.name}`); // Propagate error
            }
            
            // Update upload count and toast after successful upload
            uploadedCount++;
            toast.loading(`Uploaded ${uploadedCount}/${totalFiles} files - Processing: ${file.name}`, { 
              id: loadingToastId 
            });
            
            console.log(`Uploaded ${file.name} to:`, uploadData.path);
            return { filename: file.name, filePath: uploadData.path }; // Return reference for Promise.all
          } catch (err) {
            console.error(`Error during upload of ${file.name}:`, err);
            // Return null or a specific marker for failed uploads if needed
            return null; 
          }
        });

        const uploadResults = await Promise.all(uploadPromises);

        // Filter out failed uploads
        const successfulUploads = uploadResults.filter(result => result !== null) as { filename: string; filePath: string }[];
        const failedUploadCount = currentFiles.length - successfulUploads.length;

        if (failedUploadCount > 0) {
          toast.error(`${failedUploadCount} file(s) failed to upload to secure storage.`);
        }

        if (successfulUploads.length === 0) {
          throw new Error('All file uploads failed. Cannot proceed.');
        }

        // Start showing dynamic progress for processing
        const filesToProcess = successfulUploads.map(upload => upload.filename);
        startProgressIndicator(loadingToastId, filesToProcess);
        
        // Proceed with API call using storage paths
        response = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: successfulUploads }), // Send array of file references
          credentials: 'same-origin'
        });

      } else {
        // **** EXISTING LOGIC: All files are small, use FormData ****
        // Start showing dynamic progress for processing
        const filesToProcess = currentFiles.map(file => file.name);
        startProgressIndicator(loadingToastId, filesToProcess);
        
        // All files are small, use FormData
        const formData = new FormData();
        for (let i = 0; i < currentFiles.length; i++) {
          formData.append('file', currentFiles[i]);
        }
        
        const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 90000) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
          } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              throw new Error('Request timed out. The files may be too large or the server is busy.');
            }
            throw error;
          }
        };
        
        response = await fetchWithTimeout('/api/extract-pdf', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        });
      }
      
      if (!response) throw new Error("No response received from server.");

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        clearTimeout(safetyTimeout);
        toast.dismiss(loadingToastId);
        throw new Error(`Server returned an invalid response (${response.status} ${response.statusText}). Please try again later.`);
      }
      
      // Dismiss loading toast
      clearTimeout(safetyTimeout);
      toast.dismiss(loadingToastId);
      
      let processingError = null; // Temporary variable for non-blocking errors
      let summaryLines: string[] = []; // Initialize summary lines array

      // --- Start Refined Handling --- 

      // 1. Handle specific single-file page limit error
      if (data.code === 'PAGE_LIMIT_EXCEEDED') {
        console.error('API Error: Page limit exceeded', data.message);
        setError(data.message);
        toast.error(data.message);
        setProcessingSummary(null); // Ensure summary is cleared
        return; // Stop processing
      }

      // 2. Handle the case where *no* files succeeded, but skip info exists
      if (!data.success && data.skippedFiles && data.skippedFiles.length > 0) {
        console.warn('Processing Warning: No files succeeded, some were skipped.');
        processingError = data.message || 'No files could be processed successfully.'; 
        // Show warning toast with skipped details
        const skippedMessages = data.skippedFiles.map(
          (skipped: { filename: string, reason: string }) => 
            `- ${skipped.filename}: ${skipped.reason}`
        ).join('\n');
        toast.warning(
          <div className="text-sm">
            <p className="font-medium mb-1">{processingError}</p>
            <pre className="whitespace-pre-wrap text-xs mt-1">{skippedMessages}</pre>
          </div>,
          { duration: 10000 }
        );
        
        // Generate summary *only* with skipped files
        type SkippedFile = { filename: string; reason: string; pages?: number };
        data.skippedFiles.forEach((skipped: SkippedFile) => {
            summaryLines.push(`- ${skipped.filename}: Skipped (${skipped.reason})`);
        });
        setProcessingSummary(summaryLines.join('\n'));
        setFlashcards([]); // Ensure no leftover flashcards are shown
        setExtractedTextPreview(null);
        // Do *not* set the main error state here, as we want the summary
        // setError(processingError); 
        return; // Stop further processing
      }

      // 3. Handle other general server errors (if not handled above)
      if (!response.ok) {
        console.error('API Error:', response.status, response.statusText, data);
        const errorMessage = data?.message || `Error: ${response.status} ${response.statusText}`;
        setError(errorMessage);
        toast.error(errorMessage);
        setProcessingSummary(null); // Clear summary on general error
        return; // Stop processing
      }

      // --- 4. Process successful response (response.ok is true) --- 
      
      // Check for *partially* skipped files (success: true, but skippedFiles exist)
      if (data.skippedFiles && data.skippedFiles.length > 0) {
          const skippedMessages = data.skippedFiles.map(
            (skipped: { filename: string, reason: string }) => 
              `- ${skipped.filename}: ${skipped.reason}`
          ).join('\n');
          toast.warning(
            <div className="text-sm">
              <p className="font-medium mb-1">Some files were skipped:</p>
              <pre className="whitespace-pre-wrap text-xs">{skippedMessages}</pre>
            </div>,
            { duration: 10000 }
          );
      }

      // Set flashcards and preview
      setFlashcards(data.flashcards || []);
      setExtractedTextPreview(data.extractedTextPreview || null);
      
      // Modify success toast based on whether files were skipped
      const successfulSources = data.flashcards.length > 0 ? data.flashcards.reduce((acc: Record<string, number>, card: { source?: string }) => {
        const sourceName = card.source || 'unknown'; // Use a default if source is missing
        if (!acc[sourceName]) acc[sourceName] = 0;
        acc[sourceName]++;
        return acc;
      }, {}) : {};
      const processedFileCount = Object.keys(successfulSources).length;
      const skippedCount = data.skippedFiles?.length || 0;
      
      let successMessage = `Successfully created ${data.flashcards.length} flashcards`;
      if (skippedCount > 0 && processedFileCount > 0) {
        successMessage += ` from ${processedFileCount} file(s) (${skippedCount} skipped).`;
      } else if (skippedCount === 0 && currentFiles.length > 1) {
        successMessage += ` from ${currentFiles.length} files.`;
      } else if (skippedCount > 0 && processedFileCount === 0) {
        // This case should be handled by the skipped file warning, 
        // but good to have a fallback message if flashcards are empty
        successMessage = `Processed files, but no flashcards were generated. ${skippedCount} file(s) were skipped.`;
        toast.info(successMessage); // Use info instead of success if nothing generated
        return;
      } else {
        successMessage += "."; // Default for single file success
      }
      
      toast.success(successMessage);
      
      // Generate Detailed Summary (using both successful and skipped)
      const sourceCounts: Record<string, number> = {};
      if (data.flashcards && Array.isArray(data.flashcards)) {
        data.flashcards.forEach((card: { source?: string }) => {
          const sourceName = card.source || 'unknown';
          sourceCounts[sourceName] = (sourceCounts[sourceName] || 0) + 1;
        });
      }
      Object.entries(sourceCounts).forEach(([filename, count]) => {
          summaryLines.push(`- ${filename}: ${count} flashcard${count !== 1 ? 's' : ''} generated`);
      });
      if (data.skippedFiles && data.skippedFiles.length > 0) {
          type SkippedFile = { filename: string; reason: string; pages?: number };
          data.skippedFiles.forEach((skipped: SkippedFile) => {
              summaryLines.push(`- ${skipped.filename}: Skipped (${skipped.reason})`);
          });
      }
      if (summaryLines.length > 0) {
          setProcessingSummary(summaryLines.join('\n'));
      } else {
           setProcessingSummary(null);
      }

    } catch (err: any) {
      console.error('Error during handleSubmit:', err);
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      // Make sure loading toast is dismissed in case of client-side errors before API call
      clearTimeout(safetyTimeout);
      toast.dismiss(loadingToastId);
      toast.error(errorMessage);
      setProcessingSummary(null); // Clear summary on error
    } finally {
      setIsLoading(false);
      // Ensure toast and timer are cleaned up
      clearTimeout(safetyTimeout);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      toast.dismiss(loadingToastId);
    }
  };

  const handleClear = () => {
    // Clear all state
    setFiles([]);
    setFlashcards([]);
    setError(null);
    setExtractedTextPreview(null);
    setProcessingSummary(null);
    
    // Log to confirm state was cleared
    console.log('All state cleared');
    
    // Show feedback to user
    toast.success('Input cleared');
  };

  const handleClearResults = useCallback(() => {
    setFlashcards([]);
    setExtractedTextPreview(null);
    setProcessingSummary(null);
    toast.success('Results cleared');
  }, []);

  const handleSaveFlashcards = useCallback(() => {
    if (!flashcards.length) {
      toast.error("No flashcards to save");
      return;
    }

    const dataStr = JSON.stringify(flashcards, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', 'flashcards.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Flashcards saved successfully");
  }, [flashcards]);

  // Add a function to group flashcards by source file
  const getFlashcardsBySource = (cards: Flashcard[]) => {
    const groupedCards: Record<string, Flashcard[]> = {};
    
    cards.forEach(card => {
      const source = card.source || 'Unknown Source';
      if (!groupedCards[source]) {
        groupedCards[source] = [];
      }
      groupedCards[source].push(card);
    });
    
    return groupedCards;
  };

  // Function to simulate progress through files
  const startProgressIndicator = (toastId: string, fileNames: string[]) => {
    const totalFiles = fileNames.length;
    const averageTimePerFile = 3000; // Simulate ~3 seconds per file
    
    // Clear any existing interval
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    
    // Update toast with initial processing message
    toast.loading(`Processing file 1/${totalFiles}: ${fileNames[0]}`, { id: toastId });
    currentFileIndexRef.current = 0;
    
    // Set interval to update progress
    progressTimerRef.current = setInterval(() => {
      currentFileIndexRef.current++;
      
      // If we've gone through all files, show a "finalizing" message
      if (currentFileIndexRef.current >= totalFiles) {
        toast.loading(`Finalizing processing of ${totalFiles} files...`, { id: toastId });
        clearInterval(progressTimerRef.current as NodeJS.Timeout);
        progressTimerRef.current = null;
        return;
      }
      
      // Update toast with current file
      const currentFile = fileNames[currentFileIndexRef.current];
      toast.loading(`Processing file ${currentFileIndexRef.current + 1}/${totalFiles}: ${currentFile}`, { id: toastId });
    }, averageTimePerFile);
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">AI Flashcard Generator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <Card>
            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload documents or use your device's camera to take pictures for flashcard generation
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  {/* File upload component */}
                  <MediaCaptureTabs
                    onFilesSelected={handleFilesSelected}
                    supportedFileTypes={SUPPORTED_FILE_TYPES}
                    supportedExtensions={SUPPORTED_EXTENSIONS}
                    maxFileSize={MAX_FILE_SIZE}
                    maxImages={5}
                  />
                  
                  {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center sm:space-x-2">
                  <Button 
                    type="submit" 
                    disabled={isLoading || !files || files.length === 0}
                    className="w-full"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Generate Flashcards'
                    )}
                  </Button>
                  
                  {files.length > 0 && !isLoading && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={handleClear}
                      className="sm:w-auto"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card className="h-full flex flex-col">
            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <CardTitle>Generated Flashcards</CardTitle>
                <div className="flex items-center gap-2">
                  {flashcards.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleClearResults}>
                        Clear
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSaveFlashcards}>
                        <Download className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <CardDescription className="mt-2">
                {processingSummary ? (
                  <div className="text-xs space-y-1 mt-2 border-t pt-2">
                    {processingSummary.split('\n').map((line, index) => (
                      <p key={index} className="flex items-start">
                        <span className={`flex-shrink-0 ${line.includes('Skipped') ? 'text-orange-500' : 'text-green-500'} mr-1.5`}>
                          {line.includes('Skipped') ? '⚠️' : '✓'}
                        </span> 
                        <span className={line.includes('Skipped') ? 'text-muted-foreground' : ''}>
                          {line.replace(/^- /, '')}
                        </span>
                      </p>
                    ))}
                  </div>
                ) : flashcards.length > 0 ? (
                   // Fallback if summary isn't set but cards exist
                   `${flashcards.length} flashcards generated`
                ) : (
                   'Flashcards will appear here after processing'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-auto px-4 sm:px-6 pb-4 sm:pb-6">
              {flashcards.length > 0 ? (
                <>
                  {Object.entries(getFlashcardsBySource(flashcards)).map(([source, cards], groupIndex) => (
                    <div key={`group-${groupIndex}`} className="mb-6">
                      <div className="sticky top-0 bg-background z-10 mb-3 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 flex-shrink-0 flex items-center justify-center rounded-full bg-primary/10">
                            <span className="text-xs font-semibold text-primary">{cards.length}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm sm:text-lg font-medium truncate">Source: {source}</h3>
                            {cards[0]?.fileType && (
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                {cards[0].fileType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3 sm:space-y-4">
                        {cards.map((card, index) => (
                          <Card key={`${source}-${index}`} className="overflow-hidden">
                            <CardHeader className="bg-primary/5 pb-2 sm:pb-3 px-3 sm:px-4 py-3">
                              <CardTitle className="text-base sm:text-lg">Question {index + 1}</CardTitle>
                              <CardDescription className="font-medium text-foreground text-sm sm:text-base">
                                {card.question}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-2 sm:pt-4 px-3 sm:px-4 py-3">
                              <div className="bg-muted p-2 sm:p-3 rounded-md">
                                <p className="text-xs sm:text-sm font-medium mb-1">Answer:</p>
                                <p className="text-xs sm:text-sm whitespace-pre-line">{card.answer}</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : extractedTextPreview ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm sm:text-base font-medium">Extracted Text Preview:</h3>
                    <span className="text-xs text-muted-foreground">First 500 characters</span>
                  </div>
                  <div className="bg-muted p-2 sm:p-3 rounded-md">
                    <p className="text-xs sm:text-sm whitespace-pre-line">
                      {extractedTextPreview.substring(0, 500)}
                      {extractedTextPreview.length > 500 && '...'}
                    </p>
                  </div>
                  <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
                    <p>Extraction method:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>PDFs: Processed with pdf-parse, with Google Vision AI as fallback</li>
                      <li>Images: Processed with Google Vision AI for text recognition</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8 text-muted-foreground">
                  <Eye className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-20" />
                  <p>Preview will appear here</p>
                </div>
              )}
            </CardContent>
            {flashcards.length > 0 && (
              <CardFooter className="border-t px-4 sm:px-6 py-3 sm:py-4">
                <Button variant="secondary" className="w-full" onClick={handleSaveFlashcards}>
                  <Download className="mr-2 h-4 w-4" />
                  Save Flashcards as JSON
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
} 