'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Flashcard {
  question: string;
  answer: string;
}

// Supported file types
const SUPPORTED_FILE_TYPES = "application/pdf, image/jpeg, image/jpg, image/png, image/gif, image/bmp, image/webp";
const SUPPORTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
const MAX_FILE_SIZE_MB = 20; // 20MB recommended max size
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function AiGeneratePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      
      // Check file size and warn if too large
      if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
        toast.warning(
          `File size (${(selectedFile.size / 1024 / 1024).toFixed(2)}MB) exceeds the recommended limit of ${MAX_FILE_SIZE_MB}MB. Processing may fail or take longer than expected.`,
          { duration: 6000 }
        );
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
    
    // Warn about file size again but don't prevent submission
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.warning(
        `Processing a large ${(file.size / 1024 / 1024).toFixed(2)}MB file. This may take longer or fail due to size limits.`,
        { duration: 5000 }
      );
    }

    setIsLoading(true);
    setError(null);
    setFlashcards([]);
    setExtractedTextPreview(null);
    
    // Create a unique ID for the loading toast so we can dismiss it later
    const loadingToastId = `loading-${Date.now()}`;
    
    // Create a safety timeout to dismiss toast after 60 seconds regardless of what happens
    const safetyTimeout = setTimeout(() => {
      toast.dismiss(loadingToastId);
      // If still loading after 60 seconds, we should show an error
      if (isLoading) {
        setIsLoading(false);
        setError("Processing timed out. The file may be too large or complex. Please try with a smaller file.");
        toast.error("Processing timed out. Try a smaller file.");
      }
    }, 60000);
    
    // Show the loading toast with more details
    toast.loading(
      `Processing ${fileExtension === '.pdf' ? 'PDF' : 'image'} file (${(file.size / 1024 / 1024).toFixed(2)}MB)`, 
      { id: loadingToastId, duration: 60000 }
    );
    
    try {
      // Create a new FormData instance
      const formData = new FormData();
      
      // Append file directly without creating a new Blob to preserve original file
      formData.append('file', file);
      
      // Wrap fetch in a timeout to prevent hanging indefinitely
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
          // Check if this was an abort error (timeout)
          if (error.name === 'AbortError') {
            throw new Error("Request timed out. The server took too long to respond. Try with a smaller file.");
          }
          throw error;
        }
      };
      
      // Use the fetch with timeout
      const response = await fetchWithTimeout('/api/extract-pdf', {
        method: 'POST',
        body: formData
      }, 60000); // 60 second timeout
      
      // Check if the response is valid JSON
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error(`Server returned an invalid response (${response.status} ${response.statusText}). Please try again later.`);
      }
      
      if (!response.ok) {
        console.error('API Error:', response.status, response.statusText, data);
        
        // Handle specific error codes
        if (response.status === 413) {
          throw new Error("File is too large for the server to process. Please try a smaller file (under 20MB).");
        } else if (response.status === 422) {
          throw new Error(data?.message || "The document couldn't be processed. It may be corrupted, password-protected, or too complex.");
        } else {
          throw new Error(data?.message || `Error: ${response.status} ${response.statusText}`);
        }
      }
      
      // Clear safety timeout as we got here successfully
      clearTimeout(safetyTimeout);
      // Dismiss the loading toast
      toast.dismiss(loadingToastId);
      
      setFlashcards(data.flashcards || []);
      setExtractedTextPreview(data.extractedTextPreview || null);
      
      toast.success(`Successfully created ${data.flashcards.length} flashcards`);
    } catch (err: any) {
      console.error('Error:', err);
      const errorMessage = err.message || 'An error occurred while generating flashcards';
      setError(errorMessage);
      // Show error toast here to ensure it has the current error
      toast.error(errorMessage);
    } finally {
      // Always clean up
      clearTimeout(safetyTimeout);
      // Always dismiss the loading toast regardless of outcome
      toast.dismiss(loadingToastId);
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
                  Files up to 25MB are supported, but we recommend files under {MAX_FILE_SIZE_MB}MB for best results.
                  Very large PDFs will be limited to the first 30 pages.
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