'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/file-upload';
import { CameraCapture } from '@/components/camera-capture';
import { Camera, Upload } from 'lucide-react';

export type MediaCaptureMode = 'upload' | 'camera';

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
  const [activeTab, setActiveTab] = useState<MediaCaptureMode>('upload');

  const handleTabChange = (value: string) => {
    setActiveTab(value as MediaCaptureMode);
  };

  const handleCameraCapture = (images: File[]) => {
    onFilesSelected(images);
  };

  const handleFileUpload = (files: File[]) => {
    if (!files || files.length === 0) return;
    onFilesSelected(files);
  };

  return (
    <Tabs 
      defaultValue="upload" 
      value={activeTab} 
      onValueChange={handleTabChange}
      className="w-full"
    >
      <TabsList className="grid grid-cols-2 mb-4">
        <TabsTrigger value="upload" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          <span>Upload Files</span>
        </TabsTrigger>
        <TabsTrigger value="camera" className="flex items-center gap-2">
          <Camera className="h-4 w-4" />
          <span>Camera</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="upload" className="mt-0">
        <FileUpload
          onFilesSelected={handleFileUpload}
          supportedFileTypes={supportedFileTypes}
          supportedExtensions={supportedExtensions}
          maxFileSize={maxFileSize}
        />
      </TabsContent>
      
      <TabsContent value="camera" className="mt-0">
        <CameraCapture 
          onCapture={handleCameraCapture} 
          maxImages={maxImages} 
        />
      </TabsContent>
    </Tabs>
  );
} 