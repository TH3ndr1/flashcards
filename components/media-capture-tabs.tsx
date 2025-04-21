'use client';

import React from 'react';
import { FileUpload } from '@/components/file-upload';

interface MediaCaptureTabsProps {
  onFilesSelected: (files: File[]) => void;
  supportedFileTypes: string;
  supportedExtensions: string[];
  maxFileSize?: number; // in MB
  maxImages?: number;
}

export function MediaCaptureTabs({
  onFilesSelected,
  supportedFileTypes,
  supportedExtensions,
  maxFileSize = 25,
  maxImages = 5
}: MediaCaptureTabsProps) {
  const handleFileUpload = (files: File[]) => {
    if (!files || files.length === 0) return;
    onFilesSelected(files);
  };

  return (
    <FileUpload
      onFilesSelected={handleFileUpload}
      supportedFileTypes={supportedFileTypes}
      supportedExtensions={supportedExtensions}
      maxFileSize={maxFileSize}
    />
  );
} 