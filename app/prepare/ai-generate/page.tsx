'use client';

import { useState, useCallback } from 'react';
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
}

// Supported file types
const SUPPORTED_FILE_TYPES = "PDF, JPG, JPEG, PNG, GIF, BMP, WEBP";
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 25; // 25MB
const DIRECT_UPLOAD_LIMIT = 4; // 4MB - Use Supabase Storage for files larger than this
const UPLOAD_BUCKET = 'ai-uploads'; // Bucket name

export default function AiGeneratePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
  const { supabase } = useSupabase();
  const { user } = useAuth();

  const handleFilesSelected = (selectedFiles: File[]) => {
    if (selectedFiles && selectedFiles.length > 0) {
      // Store all selected files, not just the first one
      setFiles(selectedFiles);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase) {
      setError('Database connection not ready. Please wait a moment and try again.');
      return;
    }
    if (!user) {
      setError('You must be logged in to upload files.');
      return;
    }
    
    if (!files.length) {
      setError('Please select or capture at least one file');
      return;
    }

    // Validate all files
    for (const file of files) {
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
    
    const loadingToastId = `loading-${Date.now()}`;
    const safetyTimeout = setTimeout(() => toast.dismiss(loadingToastId), 90000);
    toast.loading(`Processing ${files.length} file${files.length > 1 ? 's' : ''}...`, { id: loadingToastId, duration: 60000 });
    
    try {
      let response;

      // For multiple files or small files, use FormData
      const formData = new FormData();
      
      // Determine if any file is larger than the direct upload limit
      const hasLargeFile = files.some(file => file.size > DIRECT_UPLOAD_LIMIT * 1024 * 1024);
      
      if (hasLargeFile && files.length === 1) {
        // If a single large file, use storage upload method
        const file = files[0];
        const fileSizeMB = file.size / (1024 * 1024);
        toast.loading(`Uploading large file (${fileSizeMB.toFixed(2)}MB) to secure storage...`, { id: `${loadingToastId}-upload` });
        
        const fileExt = file.name.split('.').pop();
        const storageFileName = `${uuidv4()}.${fileExt}`;
        const storagePath = `${user.id}/${storageFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(UPLOAD_BUCKET)
          .upload(storagePath, file, {
            upsert: false,
          });

        toast.dismiss(`${loadingToastId}-upload`);

        if (uploadError) {
          console.error('Client-side Supabase upload error:', uploadError);
          throw new Error(`Failed to upload file to secure storage: ${uploadError.message}`);
        }

        const filePath = uploadData.path;
        console.log('File uploaded to Supabase Storage:', filePath);
        toast.loading("Processing from secure storage...", { id: loadingToastId });
        
        response = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: filePath, filename: file.name }),
          credentials: 'same-origin'
        });
      } else {
        // Direct upload for multiple files or small files
        for (let i = 0; i < files.length; i++) {
          formData.append('file', files[i]);
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
        throw new Error(`Server returned an invalid response (${response.status} ${response.statusText}). Please try again later.`);
      }
      
      if (!response.ok) {
        console.error('API Error:', response.status, response.statusText, data);
        throw new Error(data?.message || `Error: ${response.status} ${response.statusText}`);
      }
      
      clearTimeout(safetyTimeout);
      toast.dismiss(loadingToastId);
      
      setFlashcards(data.flashcards || []);
      setExtractedTextPreview(data.extractedTextPreview || null);
      
      toast.success(`Successfully created ${data.flashcards.length} flashcards from ${files.length} file${files.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      console.error('Error during handleSubmit:', err);
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      clearTimeout(safetyTimeout);
      toast.dismiss(loadingToastId);
      toast.dismiss(`${loadingToastId}-upload`);
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setFiles([]);
    setFlashcards([]);
    setError(null);
    setExtractedTextPreview(null);
  };

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

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">AI Flashcard Generator</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Upload or Capture Documents</CardTitle>
              <CardDescription>
                Upload a document or use your camera to capture text for flashcard generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  {/* New component for file and camera capture */}
                  <MediaCaptureTabs
                    onFilesSelected={handleFilesSelected}
                    supportedFileTypes={SUPPORTED_FILE_TYPES}
                    supportedExtensions={SUPPORTED_EXTENSIONS}
                    maxFileSize={MAX_FILE_SIZE}
                    maxImages={5}
                  />
                  
                  {files.length > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-md">
                      <h4 className="font-medium text-sm mb-1">Selected file:</h4>
                      <p className="text-sm">
                        <span className="font-medium">{files[0].name}</span> ({(files[0].size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  )}
                  
                  {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    type="submit" 
                    disabled={isLoading || files.length === 0}
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
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Generated Flashcards</span>
                {flashcards.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleSaveFlashcards}>
                    <Download className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {flashcards.length > 0 
                  ? `${flashcards.length} flashcards generated`
                  : 'Flashcards will appear here after processing'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-auto">
              {flashcards.length > 0 ? (
                <div className="space-y-4">
                  {flashcards.map((card, index) => (
                    <Card key={index} className="overflow-hidden">
                      <CardHeader className="bg-primary/5 pb-3">
                        <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                        <CardDescription className="font-medium text-foreground text-base">
                          {card.question}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-sm font-medium mb-1">Answer:</p>
                          <p className="text-sm">{card.answer}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : extractedTextPreview ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Extracted Text Preview:</h3>
                    <span className="text-xs text-muted-foreground">First 500 characters</span>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm whitespace-pre-line">
                      {extractedTextPreview.substring(0, 500)}
                      {extractedTextPreview.length > 500 && '...'}
                    </p>
                  </div>
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p>Extraction method:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>PDFs: Processed with pdf-parse, with Google Vision AI as fallback</li>
                      <li>Images: Processed with Google Vision AI for text recognition</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Preview will appear here</p>
                </div>
              )}
            </CardContent>
            {flashcards.length > 0 && (
              <CardFooter className="border-t px-6 py-4">
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