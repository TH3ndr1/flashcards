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

export default function AiGeneratePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extractedTextPreview, setExtractedTextPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
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

    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      toast.loading("Processing file");
      
      const response = await fetch('/api/extract-pdf', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate flashcards');
      }
      
      setFlashcards(data.flashcards || []);
      setExtractedTextPreview(data.extractedTextPreview || null);
      
      toast.success(`Successfully created ${data.flashcards.length} flashcards`);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred while generating flashcards');
      
      toast.error(err.message || 'Failed to generate flashcards');
    } finally {
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
                  Note: Text is extracted using pdf-parse for PDFs (up to 100 pages) or Google Cloud Vision AI 
                  for images. Files up to 25MB are supported.
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