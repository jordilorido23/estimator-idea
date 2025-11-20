import { Inngest } from 'inngest';

/**
 * Inngest client for background jobs and async workflows
 *
 * Inngest provides:
 * - Serverless background jobs
 * - Automatic retries with exponential backoff
 * - Job status tracking and observability
 * - Event-driven workflows
 * - No additional infrastructure required
 */

export const inngest = new Inngest({
  id: 'scopeguard',
  name: 'ScopeGuard',
  eventKey: process.env.INNGEST_EVENT_KEY, // Optional: for production event signing
});

/**
 * Event types for type-safe job triggering
 */
export type InngestEvents = {
  'lead/photo.analyze': {
    data: {
      leadId: string;
      photoUrls: string[];
      leadData: {
        homeownerName: string;
        address: string;
        tradeType: string;
        budget?: number;
        timeline?: string;
        notes?: string;
      };
    };
  };
  'lead/email.send': {
    data: {
      type: 'new-lead' | 'homeowner-confirmation';
      leadId: string;
      contractorId: string;
      homeownerEmail: string;
      homeownerName: string;
    };
  };
};
