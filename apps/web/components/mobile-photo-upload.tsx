'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button, cn } from '@scopeguard/ui';

interface MobilePhotoUploadProps {
  onDrop: (files: File[]) => void;
  onDropRejected?: () => void;
  disabled?: boolean;
  maxPhotos: number;
  maxFileSize: number;
  currentCount: number;
  isDragActive?: boolean;
  isDragReject?: boolean;
}

export function MobilePhotoUpload({
  onDrop,
  onDropRejected,
  disabled,
  maxPhotos,
  maxFileSize,
  currentCount,
  isDragActive = false,
  isDragReject = false
}: MobilePhotoUploadProps) {
  const { getRootProps, getInputProps, open } = useDropzone({
    accept: { 'image/*': [] },
    maxSize: maxFileSize,
    multiple: true,
    onDrop,
    onDropRejected,
    disabled,
    noClick: true,
    noKeyboard: true
  });

  const handleCameraClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Use rear camera
    input.multiple = true;

    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        onDrop(files);
      }
    };

    input.click();
  }, [onDrop]);

  const handleGalleryClick = useCallback(() => {
    open();
  }, [open]);

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition',
          isDragActive && 'border-primary bg-primary/5',
          disabled && 'pointer-events-none opacity-60',
          isDragReject && 'border-destructive/60 bg-destructive/5'
        )}
      >
        <input {...getInputProps()} />
        <p className="text-sm font-medium">Drop your jobsite photos here</p>
        <p className="text-xs text-muted-foreground">We accept JPG, PNG, or HEIC files.</p>
      </div>

      {/* Mobile-optimized upload buttons */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleCameraClick}
          disabled={disabled}
        >
          <span className="mr-2">📷</span>
          Take Photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGalleryClick}
          disabled={disabled}
        >
          <span className="mr-2">🖼️</span>
          Choose from Gallery
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {currentCount} / {maxPhotos} photos uploaded
      </p>
    </div>
  );
}
