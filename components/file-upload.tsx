'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, File as FileIcon, X } from 'lucide-react';
import React from 'react';

// Function to create a new File with a unique name
const createUniqueFile = (file: File): File => {
  // Extract the extension
  const nameComponents = file.name.split('.');
  const extension = nameComponents.length > 1 ? nameComponents.pop() : '';
  const baseName = nameComponents.join('.');
  
  // Create a timestamp-based name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uniqueName = `${baseName}_${timestamp}.${extension}`;
  
  // Create new file with unique name (but keeping same content and type)
  return new File([file], uniqueName, { type: file.type });
};

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
    
    // Validate each file before adding
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
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
      
      // Check if this is potentially an iOS camera photo or a duplicate filename
      const isIosPhoto = file.name === 'image.jpg' || file.name === 'image.jpeg';
      const isDuplicate = selectedFiles.some(existingFile => existingFile.name === file.name) ||
        newFiles.some(newFile => newFile.name === file.name);
      
      // Always rename iOS photos and any duplicate filenames
      if (isIosPhoto || isDuplicate) {
        console.log(`Renaming file with duplicate name: ${file.name}`);
        file = createUniqueFile(file);
        console.log(`New unique name: ${file.name}`);
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
                    <FileIcon className="h-4 w-4 mr-2 text-muted-foreground" />
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
            {selectedFiles.some(file => file.name.includes('image_20') && (file.name.includes('.jpg') || file.name.includes('.jpeg'))) && (
              <div className="mt-1 text-xs text-blue-600 p-2 bg-blue-50 rounded-md">
                <strong>iOS User?</strong> We've automatically renamed your photos to ensure they can be processed individually.
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