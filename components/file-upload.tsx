'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, File, X } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: FileList | null) => void;
  supportedFileTypes: string;
  supportedExtensions: string[];
  maxFileSize?: number; // in MB
}

export function FileUpload({
  onFilesSelected,
  supportedFileTypes,
  supportedExtensions,
  maxFileSize = 25
}: FileUploadProps) {
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
    
    if (validateFiles(files)) {
      setSelectedFiles(Array.from(files || []));
      onFilesSelected(files);
    } else if (!error) {
      setError('No valid files were selected.');
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const resubmitFiles = () => {
    if (selectedFiles.length > 0) {
      // Convert the array back to a FileList-like object
      const dataTransfer = new DataTransfer();
      selectedFiles.forEach(file => dataTransfer.items.add(file));
      onFilesSelected(dataTransfer.files);
    }
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
              <Button variant="ghost" size="sm" onClick={clearFiles}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2">
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
            
            <div className="flex justify-end">
              <Button onClick={resubmitFiles}>
                Use Selected Files
              </Button>
            </div>
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
} 