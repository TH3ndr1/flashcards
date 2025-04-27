'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, File as FileIcon, X, PlusCircle } from 'lucide-react';
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

  // Create a memoized version of the file update function to prevent unnecessary rerenders
  const updateParentFiles = useCallback(() => {
    console.log(`FileUpload: Updating parent with ${selectedFiles.length} files`);
    onFilesSelected([...selectedFiles]);
  }, [selectedFiles, onFilesSelected]);

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
    let hasError = false;
    
    // Validate each file before adding
    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      
      // Check file extension
      if (!supportedExtensions.includes(`.${extension}`)) {
        setError(`File "${file.name}" type not supported. Please upload ${supportedFileTypes}.`);
        hasError = true;
        continue;
      }
      
      // Check file size
      if (file.size > maxFileSize * 1024 * 1024) {
        setError(`File "${file.name}" exceeds the ${maxFileSize}MB limit.`);
        hasError = true;
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
    
    // Only update state if we have files to add and no errors
    if (newFiles.length > 0) {
      console.log(`Adding ${newFiles.length} new files to state`);
      // Update the state with the new files and notify parent
      setSelectedFiles(prev => {
        const updatedFiles = [...prev, ...newFiles];
        // Call the parent callback only after state update is complete
        setTimeout(() => onFilesSelected(updatedFiles), 0);
        return updatedFiles;
      });
    } else if (!hasError) {
      // If we have no files to add but also no error, set an informative error
      setError('No valid files were selected.');
    }
  };

  const handleButtonClick = () => {
    // Make sure input is reset before clicking to avoid issues with previously selected files
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Then trigger the file selection
    inputRef.current?.click();
  };

  const removeFile = (index: number) => {
    console.log(`Removing file at index ${index}`);
    
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      console.log(`Current files: ${newFiles.length}, removing index ${index}`);
      newFiles.splice(index, 1);
      console.log(`New files count: ${newFiles.length}`);
      
      // Notify parent of the updated files
      setTimeout(() => onFilesSelected(newFiles), 0);
      
      return newFiles;
    });
    
    // Clear any error messages
    setError(null);
  };

  const clearFiles = () => {
    console.log('Clearing all files');
    
    // Reset the selected files state
    setSelectedFiles([]);
    
    // Notify parent of cleared files
    setTimeout(() => onFilesSelected([]), 0);
    
    // Reset the file input value - important for making sure any re-selection works properly
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Clear any error messages
    setError(null);
    
    // Log for debugging
    console.log('All files cleared');
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
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 justify-between items-start sm:items-center">
              <h3 className="font-medium">Selected Files</h3>
              {/* On desktop, buttons stay in the header */}
              <div className="hidden sm:flex items-center gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={handleButtonClick}
                >
                  <PlusCircle className="h-4 w-4 mr-1.5" />
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
                  <div className="flex items-center overflow-hidden max-w-[calc(100%-36px)]">
                    <FileIcon className="h-4 w-4 flex-shrink-0 mr-2 text-muted-foreground" />
                    <div className="overflow-hidden">
                      <span className="text-xs sm:text-sm font-medium truncate block">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => removeFile(index)}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Mobile buttons below file list */}
            <div className="flex flex-col sm:hidden gap-2 mt-3">
              <Button 
                type="button"
                variant="outline" 
                className="w-full"
                size="sm" 
                onClick={handleButtonClick}
              >
                <PlusCircle className="h-4 w-4 mr-1.5" />
                Add More Files
              </Button>
              <Button 
                type="button"
                variant="outline" 
                size="sm"
                className="w-full" 
                onClick={clearFiles}
              >
                <X className="h-4 w-4 mr-1.5" />
                Clear All
              </Button>
            </div>

            {/* Add iOS Safari note */}
            {selectedFiles.some(file => file.name.includes('image_20') && (file.name.includes('.jpg') || file.name.includes('.jpeg'))) && (
              <div className="mt-1 text-xs text-blue-600 p-2 bg-blue-50 rounded-md">
                <strong>iOS User?</strong> We've automatically renamed your photos to ensure they can be processed individually.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-6 sm:py-8">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
            <h3 className="font-medium text-base sm:text-lg">Upload Files</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-2 sm:mb-3">
              Drag and drop or click to upload
            </p>
            <p className="text-xs text-muted-foreground">
              Supported formats: {supportedFileTypes}
            </p>
            <p className="text-xs text-muted-foreground">
              Max size: {maxFileSize}MB
            </p>
            <Button 
              type="button"
              variant="outline" 
              onClick={handleButtonClick}
              className="mt-3 sm:mt-4"
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