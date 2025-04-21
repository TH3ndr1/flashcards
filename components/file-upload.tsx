'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, File, X } from 'lucide-react';
import React from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  supportedFileTypes: string;
  supportedExtensions: string[];
  maxFileSize?: number; // in MB
}

export const FileUpload = (
  {
    onFilesSelected,
    supportedFileTypes,
    supportedExtensions,
    maxFileSize = 25
  }: FileUploadProps
) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateFiles = (files: FileList | null): boolean => {
    if (!files || files.length === 0) return false;
    
    // Check file extensions
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      
      if (!supportedExtensions.includes(`.${extension}`)) {
        setError(`File type not supported. Please upload ${supportedFileTypes}.`);
        return false;
      }
      
      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        setError(`File size exceeds the ${maxFileSize}MB limit.`);
        return false;
      }
    }
    
    return true;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const { files } = e.dataTransfer;
    handleFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    handleFiles(files);
  };

  const handleFiles = (files: FileList | null) => {
    setError(null);
    
    if (!files || files.length === 0) {
      if (!error) {
        setError('No files were selected.');
      }
      return;
    }
    
    // Create an array of new files to add
    const newFiles: File[] = [];
    
    // Track possible iOS camera filenames (like "image.jpg")
    const filenameCount: Record<string, number> = {};
    
    // Validate each file before adding
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      
      // Check file extension
      if (!supportedExtensions.includes(`.${extension}`)) {
        setError(`File "${file.name}" type not supported. Please upload ${supportedFileTypes}.`);
        continue;
      }
      
      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the ${maxFileSize}MB limit.`);
        continue;
      }
      
      // Handle possible iOS duplicate filenames
      // Check if we've already added this filename OR if it's already in the selected files
      const isDuplicate = selectedFiles.some(existingFile => existingFile.name === file.name) ||
        newFiles.some(newFile => newFile.name === file.name);
      
      if (isDuplicate) {
        // Instead of creating a new File (which has TS issues), we'll skip this file
        // but log a warning so the user knows why
        console.log(`Skipping duplicate file: ${file.name}`);
        
        // Show a different error message if this is likely an iOS camera issue
        if (file.name === 'image.jpg' || file.name === 'image.jpeg') {
          setError('Multiple photos detected with the same filename. This is a known iOS issue. Please upload photos one at a time or use a different device.');
        } else {
          setError(`A file named "${file.name}" is already selected.`);
        }
        continue;
      }
      
      newFiles.push(file);
    }
    
    if (newFiles.length > 0) {
      // Add new files to the existing selection
      const updatedFiles = [...selectedFiles, ...newFiles];
      setSelectedFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      onFilesSelected(newFiles);
      return newFiles;
    });
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onFilesSelected([]);
  };

  return (
    <div className="w-full">
      {/* File input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={supportedExtensions.join(',')}
        onChange={handleChange}
        className="hidden"
      />
      
      {/* Dropzone */}
      <Card
        className={`w-full p-6 border-2 border-dashed transition-colors ${
          dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        {selectedFiles.length > 0 ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Selected Files</h3>
              <div className="flex items-center gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={handleButtonClick}
                >
                  Add More Files
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFiles}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 mt-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div className="flex items-center">
                    <File className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-sm truncate max-w-[250px]">{file.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add iOS Safari note */}
            {selectedFiles.some(file => file.name === 'image.jpg' || file.name === 'image.jpeg') && (
              <div className="mt-1 text-xs text-amber-600 p-2 bg-amber-50 rounded-md">
                <strong>iOS User?</strong> Due to how iOS names photos, you may need to upload each new photo individually to avoid duplicates.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-medium text-lg">Upload Files</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Drag and drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              Supported formats: {supportedFileTypes}
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {maxFileSize}MB
            </p>
            <Button 
              variant="outline" 
              onClick={handleButtonClick}
              className="mt-4"
            >
              Browse Files
            </Button>
          </div>
        )}
      </Card>
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}; 