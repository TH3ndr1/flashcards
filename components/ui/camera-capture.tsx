'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Trash2, CheckCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (images: File[]) => void;
  maxImages?: number;
}

export function CameraCapture({ onCapture, maxImages = 5 }: CameraCaptureProps) {
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Unable to access camera. Please check permissions or try uploading images instead.');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
  }, []);

  // Capture image
  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      // Create file from blob
      const timestamp = new Date().toISOString();
      const file = new File([blob], `camera-capture-${timestamp}.jpg`, { type: 'image/jpeg' });
      
      // Add to captured images
      setCapturedImages(prev => [...prev, file]);
      
      // If we've reached max images, stop camera
      if (capturedImages.length + 1 >= maxImages) {
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  }, [capturedImages.length, maxImages, stopCamera]);

  // Remove image
  const removeImage = useCallback((index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle file selection as alternative to camera
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newFiles: File[] = [];
    for (let i = 0; i < Math.min(files.length, maxImages - capturedImages.length); i++) {
      newFiles.push(files[i]);
    }
    
    setCapturedImages(prev => [...prev, ...newFiles]);
    
    // Reset the input to allow re-selection of the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit captured images
  const handleSubmit = useCallback(() => {
    if (capturedImages.length === 0) return;
    onCapture(capturedImages);
    setCapturedImages([]);
  }, [capturedImages, onCapture]);

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden elements */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera view or captured images */}
      <Card className="overflow-hidden">
        {isCapturing ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto aspect-video object-cover"
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
              <Button 
                variant="secondary" 
                size="lg" 
                className="rounded-full w-14 h-14"
                onClick={captureImage}
              >
                <Camera className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {capturedImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {capturedImages.map((image, index) => (
                  <div key={index} className="relative aspect-video">
                    <img
                      src={URL.createObjectURL(image)}
                      alt={`Captured ${index + 1}`}
                      className="w-full h-full object-cover rounded-md"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 w-6 h-6 rounded-full"
                      onClick={() => removeImage(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Camera className="h-12 w-12 mb-2 text-muted-foreground" />
                <h3 className="font-medium text-lg">No images captured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start the camera to capture images or upload them directly
                </p>
                <div className="flex gap-2">
                  <Button onClick={startCamera}>Open Camera</Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Images
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      
      {/* Controls */}
      {capturedImages.length > 0 && (
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {capturedImages.length} of {maxImages} images captured
            </span>
            {capturedImages.length < maxImages && !isCapturing && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={startCamera}
              >
                Add More
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {isCapturing && (
              <Button 
                variant="outline" 
                onClick={stopCamera}
              >
                Done
              </Button>
            )}
            <Button 
              onClick={handleSubmit}
              disabled={capturedImages.length === 0}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Use {capturedImages.length} Image{capturedImages.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}
      
      {isCapturing && (
        <p className="text-sm text-muted-foreground text-center">
          Aim your camera at the document or text you want to capture
        </p>
      )}
    </div>
  );
} 