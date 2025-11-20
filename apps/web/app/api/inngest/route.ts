import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { analyzePhotosFunction } from '@/lib/inngest/functions/analyze-photos';
import { analyzeDocumentsFunction } from '@/lib/inngest/functions/analyze-documents';

/**
 * Inngest API route for background jobs
 *
 * This endpoint:
 * - Receives events from your application
 * - Executes background functions
 * - Provides UI for monitoring jobs (in development)
 * - Handles retries and error tracking
 *
 * In development: http://localhost:3000/api/inngest
 * Shows the Inngest Dev Server UI
 */

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzePhotosFunction,
    analyzeDocumentsFunction,
    // Add more functions here as you create them
  ],
  streaming: 'allow', // Enable streaming for better performance
});
