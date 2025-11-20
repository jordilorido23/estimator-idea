'use client';

import * as React from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Button,
  cn
} from '@scopeguard/ui';
import { FileText, File, X, Upload, CheckCircle, AlertCircle } from 'lucide-react';

export type LocalDocument = {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  key?: string;
  url?: string;
};

export type DocumentMetadata = {
  id: string;
  key: string;
  url: string;
  name: string;
  type: string;
  size: number;
};

type DocumentUploadProps = {
  contractorSlug: string;
  leadTempId: string;
  maxDocuments?: number;
  maxFileSize?: number;
  onDocumentsChange?: (documents: DocumentMetadata[]) => void;
  disabled?: boolean;
};

const MAX_DOCUMENTS = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Supported document types
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/dwg': ['.dwg'],
  'application/dxf': ['.dxf'],
};

const getFileIcon = (type: string) => {
  if (type === 'application/pdf') {
    return <FileText className="h-8 w-8 text-red-500" />;
  }
  if (type.startsWith('image/')) {
    return <File className="h-8 w-8 text-blue-500" />;
  }
  return <File className="h-8 w-8 text-gray-500" />;
};

const getFileTypeLabel = (type: string): 'PDF' | 'IMAGE' | 'DWG' | 'OTHER' => {
  if (type === 'application/pdf') return 'PDF';
  if (type.startsWith('image/')) return 'IMAGE';
  if (type.includes('dwg') || type.includes('dxf')) return 'DWG';
  return 'OTHER';
};

export function DocumentUpload({
  contractorSlug,
  leadTempId,
  maxDocuments = MAX_DOCUMENTS,
  maxFileSize = MAX_FILE_SIZE,
  onDocumentsChange,
  disabled = false,
}: DocumentUploadProps) {
  const [documents, setDocuments] = React.useState<LocalDocument[]>([]);
  const documentsRef = React.useRef<LocalDocument[]>([]);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      documentsRef.current.forEach((doc) => {
        if (doc.type.startsWith('image/') && doc.file) {
          URL.revokeObjectURL(URL.createObjectURL(doc.file));
        }
      });
    };
  }, []);

  const setDocumentState = React.useCallback((id: string, update: Partial<LocalDocument>) => {
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? { ...doc, ...update } : doc)));
  }, []);

  const removeDocument = React.useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const hasActiveUploads = documents.some((doc) => doc.status === 'pending' || doc.status === 'uploading');

  const uploadedDocumentMetadata: DocumentMetadata[] = React.useMemo(
    () =>
      documents
        .filter((doc): doc is LocalDocument & { key: string; url: string } =>
          doc.status === 'uploaded' && !!doc.key && !!doc.url
        )
        .map((doc) => ({
          id: doc.id,
          key: doc.key,
          url: doc.url,
          name: doc.name,
          type: doc.type,
          size: doc.size,
        })),
    [documents]
  );

  React.useEffect(() => {
    onDocumentsChange?.(uploadedDocumentMetadata);
  }, [uploadedDocumentMetadata, onDocumentsChange]);

  const uploadDocument = React.useCallback(
    async (document: LocalDocument) => {
      try {
        setDocumentState(document.id, { status: 'uploading', error: undefined });

        // Get presigned URL
        const presignResponse = await fetch('/api/uploads/presign-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractorSlug,
            leadTempId,
            contentType: document.type,
            fileName: document.name,
            fileSize: document.size,
          }),
        });

        const presignPayload = await presignResponse.json().catch(() => null);

        if (!presignResponse.ok || !presignPayload?.upload) {
          const message = presignPayload?.error ?? 'Could not prepare an upload slot.';
          throw new Error(message);
        }

        const { upload } = presignPayload;

        // Upload to S3
        const formData = new FormData();
        Object.entries(upload.fields).forEach(([key, value]) => {
          formData.append(key, value as string);
        });
        formData.append('file', document.file);

        const s3Response = await fetch(upload.url, {
          method: 'POST',
          body: formData,
        });

        if (!s3Response.ok) {
          throw new Error('Upload failed. Please try again.');
        }

        setDocumentState(document.id, {
          status: 'uploaded',
          key: upload.key,
          url: upload.publicUrl,
        });
      } catch (error) {
        console.error('Document upload error', error);
        const message = error instanceof Error ? error.message : 'Upload failed. Please try again.';
        setDocumentState(document.id, { status: 'error', error: message });
        setUploadError(message);
      }
    },
    [contractorSlug, leadTempId, setDocumentState]
  );

  const handleDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setUploadError(null);

      const spaceAvailable = maxDocuments - documentsRef.current.length;
      if (spaceAvailable <= 0) {
        setUploadError(`You can upload up to ${maxDocuments} documents.`);
        return;
      }

      const filesToUpload = acceptedFiles.slice(0, spaceAvailable);

      if (acceptedFiles.length > spaceAvailable) {
        setUploadError(
          `You can upload only ${spaceAvailable} more document${spaceAvailable === 1 ? '' : 's'}. Extra files were skipped.`
        );
      }

      const newDocuments: LocalDocument[] = filesToUpload.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        status: 'pending',
      }));

      setDocuments((prev) => [...prev, ...newDocuments]);
      newDocuments.forEach((doc) => {
        void uploadDocument(doc);
      });
    },
    [maxDocuments, uploadDocument]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: ACCEPTED_FILE_TYPES,
    maxSize: maxFileSize,
    multiple: true,
    onDrop: handleDrop,
    onDropRejected: () => {
      setUploadError(`Files should be PDF, PNG, JPG, or DWG under ${Math.round(maxFileSize / (1024 * 1024))}MB each.`);
    },
    disabled: disabled || documents.length >= maxDocuments,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Construction Plans & Drawings (Optional)</p>
          <p className="text-xs text-muted-foreground">
            Upload architectural plans, floor plans, or blueprints (PDF, PNG, JPG, DWG - max {Math.round(maxFileSize / (1024 * 1024))}MB each)
          </p>
        </div>
        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition',
          isDragActive && 'border-primary bg-primary/5',
          (disabled || documents.length >= maxDocuments || hasActiveUploads) && 'pointer-events-none opacity-60',
          isDragReject && 'border-destructive/60 bg-destructive/5'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drop plans here or click to browse</p>
        <p className="text-xs text-muted-foreground">PDF, images, or CAD files accepted</p>
      </div>

      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <div className="flex-shrink-0">
                {getFileIcon(doc.type)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{doc.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{(doc.size / (1024 * 1024)).toFixed(1)}MB</span>
                  <span>•</span>
                  <span>{getFileTypeLabel(doc.type)}</span>
                  {doc.status === 'uploaded' && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Uploaded
                      </span>
                    </>
                  )}
                  {doc.status === 'uploading' && (
                    <>
                      <span>•</span>
                      <span>Uploading...</span>
                    </>
                  )}
                  {doc.status === 'error' && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        Failed
                      </span>
                    </>
                  )}
                </div>
                {doc.error && <p className="text-xs text-destructive">{doc.error}</p>}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeDocument(doc.id)}
                disabled={doc.status === 'uploading'}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
