'use client';

import Image from 'next/image';
import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';

import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn
} from '@scopeguard/ui';

import { leadIntakeSchema } from '@/lib/validators/lead-intake';
import type { LeadIntakeValues, LeadPhotoMetadata, LeadDocumentMetadata } from '@/lib/validators/lead-intake';
import { DocumentUpload, type DocumentMetadata } from './document-upload';

type IntakeFormProps = {
  contractorSlug: string;
  contractorName: string;
  projectTypes?: string[];
};

type LocalPhoto = {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
  key?: string;
  url?: string;
};

const DEFAULT_PROJECT_TYPES = [
  'Kitchen remodel',
  'Bathroom remodel',
  'Whole-home renovation',
  'ADU or addition',
  'Exterior improvements',
  'Insurance restoration'
];

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const initialValues: LeadIntakeValues = {
  homeownerName: '',
  homeownerEmail: '',
  homeownerPhone: '',
  address: '',
  projectType: '',
  budget: undefined,
  timeline: '',
  description: '',
  photos: [],
  documents: []
};

export function IntakeForm({ contractorSlug, contractorName, projectTypes }: IntakeFormProps) {
  const [photos, setPhotos] = React.useState<LocalPhoto[]>([]);
  const photosRef = React.useRef<LocalPhoto[]>([]);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [formStatus, setFormStatus] = React.useState<{ type: 'idle' | 'success' | 'error'; message: string | null }>({
    type: 'idle',
    message: null
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [leadTempId, setLeadTempId] = React.useState(() => crypto.randomUUID());

  const options = projectTypes && projectTypes.length > 0 ? projectTypes : DEFAULT_PROJECT_TYPES;
  const form = useForm<LeadIntakeValues>({
    resolver: zodResolver(leadIntakeSchema),
    defaultValues: initialValues
  });

  const setPhotoState = React.useCallback((id: string, update: Partial<LocalPhoto>) => {
    setPhotos((prev) => prev.map((photo) => (photo.id === id ? { ...photo, ...update } : photo)));
  }, []);

  const removePhoto = React.useCallback((id: string) => {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((photo) => photo.id !== id);
    });
  }, []);

  React.useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  React.useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.preview));
    };
  }, []);

  const hasActiveUploads = photos.some((photo) => photo.status === 'pending' || photo.status === 'uploading');
  const uploadedPhotoMetadata: LeadPhotoMetadata[] = React.useMemo(
    () =>
      photos
        .filter((photo): photo is LocalPhoto & { key: string; url: string } => photo.status === 'uploaded' && !!photo.key && !!photo.url)
        .map((photo) => ({
          id: photo.id,
          key: photo.key!,
          url: photo.url!,
          name: photo.name,
          type: photo.type,
          size: photo.size
        })),
    [photos]
  );

  React.useEffect(() => {
    form.setValue('photos', uploadedPhotoMetadata, { shouldValidate: true });
  }, [uploadedPhotoMetadata, form]);

  const uploadPhoto = React.useCallback(
    async (photo: LocalPhoto) => {
      try {
        setPhotoState(photo.id, { status: 'uploading', error: undefined });
        const presignResponse = await fetch('/api/uploads/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractorSlug,
            leadTempId,
            contentType: photo.type,
            fileName: photo.name,
            fileSize: photo.size
          })
        });

        const presignPayload = await presignResponse.json().catch(() => null);

        if (!presignResponse.ok || !presignPayload?.upload) {
          const message = presignPayload?.error ?? 'Could not prepare an upload slot.';
          throw new Error(message);
        }

        const { upload } = presignPayload;
        const formData = new FormData();
        Object.entries(upload.fields).forEach(([key, value]) => {
          formData.append(key, value);
        });
        formData.append('file', photo.file);

        const s3Response = await fetch(upload.url, {
          method: 'POST',
          body: formData
        });

        if (!s3Response.ok) {
          throw new Error('Upload failed. Please try again.');
        }

        setPhotoState(photo.id, {
          status: 'uploaded',
          key: upload.key,
          url: upload.publicUrl
        });
      } catch (error) {
        console.error('Photo upload error', error);
        const message = error instanceof Error ? error.message : 'Upload failed. Please try again.';
        setPhotoState(photo.id, { status: 'error', error: message });
        setUploadError(message);
      }
    },
    [contractorSlug, leadTempId, setPhotoState]
  );

  const handleDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) return;
      setUploadError(null);

      const spaceAvailable = MAX_PHOTOS - photosRef.current.length;
      if (spaceAvailable <= 0) {
        setUploadError(`You can upload up to ${MAX_PHOTOS} photos.`);
        return;
      }

      const imageFiles = acceptedFiles.filter((file) => file.type?.startsWith('image/'));
      if (imageFiles.length === 0) {
        setUploadError('Only image files are allowed.');
        return;
      }

      if (imageFiles.length !== acceptedFiles.length) {
        setUploadError('Only image files are allowed; skipped unsupported files.');
      }

      const filesToUpload = imageFiles.slice(0, spaceAvailable);

      if (imageFiles.length > spaceAvailable) {
        setUploadError(
          `You can upload only ${spaceAvailable} more photo${spaceAvailable === 1 ? '' : 's'}. Extra files were skipped.`
        );
      }

      const newPhotos: LocalPhoto[] = filesToUpload.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        preview: URL.createObjectURL(file),
        status: 'pending'
      }));

      setPhotos((prev) => [...prev, ...newPhotos]);
      newPhotos.forEach((photo) => {
        void uploadPhoto(photo);
      });
    },
    [setPhotoState, uploadPhoto]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: { 'image/*': [] },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    onDrop: handleDrop,
    onDropRejected: () => {
      setUploadError(`Photos should be images under ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB each.`);
    },
    disabled: photos.length >= MAX_PHOTOS
  });

  const onSubmit = async (values: LeadIntakeValues) => {
    if (hasActiveUploads) {
      setFormStatus({
        type: 'error',
        message: 'Please wait for your photos to finish uploading.'
      });
      return;
    }

    setIsSubmitting(true);
    setFormStatus({ type: 'idle', message: null });

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          contractorSlug,
          photos: uploadedPhotoMetadata,
          timeline: values.timeline || undefined
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? 'We ran into an issue while saving your request.');
      }

      setFormStatus({
        type: 'success',
        message: `Thanks! ${contractorName} will reach out shortly to review your project.`
      });
      form.reset(initialValues);
      setPhotos((prev) => {
        prev.forEach((photo) => URL.revokeObjectURL(photo.preview));
        return [];
      });
      setLeadTempId(crypto.randomUUID());
      setUploadError(null);
    } catch (error) {
      console.error('Lead intake submit error', error);
      setFormStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to submit the form right now.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Tell us about your project</p>
        <p className="text-sm text-muted-foreground">A project specialist at {contractorName} will follow up within one business day.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="homeownerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input data-testid="homeowner-name" placeholder="Alex Taylor" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="homeownerEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input data-testid="homeowner-email" placeholder="alex@example.com" type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="homeownerPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input data-testid="homeowner-phone" placeholder="(555) 123-4567" type="tel" autoComplete="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project address</FormLabel>
                  <FormControl>
                    <Input data-testid="address" placeholder="123 Market Street, Denver" autoComplete="street-address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="projectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="project-type">
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rough budget</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="budget"
                        type="number"
                        inputMode="decimal"
                        placeholder="75000"
                        min={0}
                        step="1000"
                        value={field.value ?? ''}
                        onChange={(event) => {
                          const value = event.target.value;
                          field.onChange(value ? Number(value) : undefined);
                        }}
                      />
                    </FormControl>
                    <FormDescription>We&apos;ll keep this private.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ideal start date</FormLabel>
                    <FormControl>
                      <Input data-testid="timeline" type="date" value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value || undefined)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project details</FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="description"
                    placeholder="Share scope, finishes, or constraints we should know about."
                    rows={5}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Photos</p>
                <p className="text-xs text-muted-foreground">Drag & drop or click to upload up to {MAX_PHOTOS} photos (max 15MB each).</p>
              </div>
              {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
            </div>
            <div
              {...getRootProps()}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition',
                isDragActive && 'border-primary bg-primary/5',
                (photos.length >= MAX_PHOTOS || hasActiveUploads) && 'pointer-events-none opacity-60',
                isDragReject && 'border-destructive/60 bg-destructive/5'
              )}
            >
              <input {...getInputProps()} />
              <p className="text-sm font-medium">Drop your jobsite photos here</p>
              <p className="text-xs text-muted-foreground">We accept JPG, PNG, or HEIC files.</p>
            </div>

            {photos.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {photos.map((photo) => (
                  <li key={photo.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <div className="h-16 w-16 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={photo.preview}
                        alt={photo.name}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">{photo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(photo.size / (1024 * 1024)).toFixed(1)}MB · {photo.status === 'uploaded' ? 'Uploaded' : photo.status === 'error' ? 'Failed' : 'Uploading…'}
                      </p>
                      {photo.error ? <p className="text-xs text-destructive">{photo.error}</p> : null}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePhoto(photo.id)} disabled={photo.status === 'uploading'}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <DocumentUpload
            contractorSlug={contractorSlug}
            leadTempId={leadTempId}
            onDocumentsChange={(documents) => {
              const documentMetadata: LeadDocumentMetadata[] = documents.map((doc) => ({
                id: doc.id,
                key: doc.key,
                url: doc.url,
                name: doc.name,
                type: doc.type,
                size: doc.size,
              }));
              form.setValue('documents', documentMetadata, { shouldValidate: true });
            }}
          />

          {formStatus.type !== 'idle' && formStatus.message ? (
            <div
              className={cn(
                'rounded-lg border px-4 py-3 text-sm',
                formStatus.type === 'success' ? 'border-green-600/30 bg-green-50 text-green-700' : 'border-destructive/40 bg-destructive/5 text-destructive'
              )}
            >
              {formStatus.message}
            </div>
          ) : null}

          <Button data-testid="submit-button" type="submit" className="w-full" disabled={isSubmitting || hasActiveUploads}>
            {isSubmitting ? 'Submitting...' : 'Submit project'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
