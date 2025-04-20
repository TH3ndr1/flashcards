'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useSupabase } from '@/hooks/use-supabase';
import { useAuth } from '@/hooks/use-auth';
import { v4 as uuidv4 } from 'uuid';

interface Flashcard {
  question: string;
  answer: string;
}

// Supported file types
const SUPPORTED_FILE_TYPES = "application/pdf, image/jpeg, image/jpg, image/png, image/gif, image/bmp, image/webp";
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const LARGE_FILE_SIZE = 10 * 1024 * 1024; // Use Supabase Storage for files larger than this
const DIRECT_UPLOAD_LIMIT = 10 * 1024 * 1024; // Max size for direct API upload
const UPLOAD_BUCKET = 'ai-uploads'; // Bucket name

export default function AiGeneratePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { supabase } = useSupabase();
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
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
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    // Check if file extension is supported
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
      setError(`Unsupported file type. Please select one of: ${SUPPORTED_EXTENSIONS.join(', ')}`);
      return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 50MB.`);
      return;
    }

    // Warn about large files
    if (file.size > LARGE_FILE_SIZE) {
      toast.info(`Large file detected (${(file.size / 1024 / 1024).toFixed(2)}MB). Using secure storage for processing.`);
    }

    setIsLoading(true);
    setError(null);
    setFlashcards([]);
    setExtractedTextPreview(null);
    
    const loadingToastId = `loading-${Date.now()}`;
    const safetyTimeout = setTimeout(() => toast.dismiss(loadingToastId), 90000);
    toast.loading("Processing file...", { id: loadingToastId, duration: 60000 });
    
    try {
      let response;
      let filePath: string | null = null;
      let finalFilename = file.name;

      if (file.size > DIRECT_UPLOAD_LIMIT) {
        toast.loading("Uploading to secure storage...", { id: `${loadingToastId}-upload` });
        
        const fileExt = file.name.split('.').pop();
        const storageFileName = `${uuidv4()}.${fileExt}`;
        const storagePath = `${user.id}/${storageFileName}`;
        finalFilename = file.name;

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

        filePath = uploadData.path;
        console.log('File uploaded to Supabase Storage:', filePath);
        toast.loading("Processing from secure storage...", { id: loadingToastId });
        
        response = await fetch('/api/extract-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: filePath, filename: finalFilename }),
          credentials: 'same-origin'
        });

      } else {
        const formData = new FormData();
        formData.append('file', file);
        
        const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 60000) => {
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
              throw new Error('Request timed out. The file may be too large or the server is busy.');
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
        
        if (response.status === 413) {
          throw new Error(`File is too large for direct processing. Please try again and we'll use our secure storage method.`);
        }
        
        throw new Error(data?.message || `Error: ${response.status} ${response.statusText}`);
      }
      
      clearTimeout(safetyTimeout);
      toast.dismiss(loadingToastId);
      
      setFlashcards(data.flashcards || []);
      setExtractedTextPreview(data.extractedTextPreview || null);
      
      toast.success(`Successfully created ${data.flashcards.length} flashcards`);
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
    setFile(null);
    setFlashcards([]);
    setError(null);
    setExtractedTextPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
              <CardTitle>Upload Document</CardTitle>
              <CardDescription>
                Upload a PDF or image file to generate flashcards using AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept={SUPPORTED_FILE_TYPES}
                    onChange={handleFileChange}
                    disabled={isLoading}
                  />
                  {file && (
                    <p className="text-sm mt-2">
                      Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                  {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button type="submit" disabled={!file || isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Generate Flashcards
                      </>
                    )}
                  </Button>
                  {file && (
                    <Button type="button" variant="outline" onClick={handleClear} disabled={isLoading}>
                      Clear
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {extractedTextPreview && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Extracted Text Preview</CardTitle>
                <CardDescription>
                  Preview of the text extracted from your document
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm italic">{extractedTextPreview}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Note: PDFs are processed using Google Document AI, and images are processed using Google Vision AI.
                  Files up to 50MB are supported through our secure storage system.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {flashcards.length > 0 ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Generated Flashcards ({flashcards.length})</h2>
                <Button onClick={handleSaveFlashcards} size="sm">
                  Save Flashcards
                </Button>
              </div>
              
              {flashcards.map((card, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-lg">Question {index + 1}</CardTitle>
                    <CardDescription className="font-medium text-base">
                      {card.question}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-3 rounded-md">
                      <p className="text-sm font-medium">Answer:</p>
                      <p className="text-sm">{card.answer}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            !isLoading && (
              <div className="border border-dashed rounded-lg p-10 text-center">
                <p className="text-muted-foreground">
                  Upload a file and generate flashcards to see results here
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
} 