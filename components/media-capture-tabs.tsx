'use client';

import React, { useCallback } from 'react';
import { FileUpload } from '@/components/file-upload';
import { appLogger } from '@/lib/logger';

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
  // Use a memoized callback to avoid re-renders
  const handleFileUpload = useCallback((files: File[]) => {
    appLogger.info(`MediaCaptureTabs received ${files ? files.length : 0} files from FileUpload`);
    // Only propagate the update if we have valid inputs
    if (files && Array.isArray(files)) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  return (
    <FileUpload
      onFilesSelected={handleFileUpload}
      supportedFileTypes={supportedFileTypes}
      supportedExtensions={supportedExtensions}
      maxFileSize={maxFileSize}
    />
  );
} 