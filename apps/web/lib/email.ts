import { Resend } from 'resend';
import { env } from '@/src/env';

let cachedClient: Resend | null = null;

/**
 * Get or create a singleton Resend client instance
 */
export const getResendClient = () => {
  if (!cachedClient) {
    if (!env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured - email notifications disabled');
      return null;
    }
    cachedClient = new Resend(env.RESEND_API_KEY);
  }

  return cachedClient;
};

type NewLeadEmailData = {
  contractorName: string;
  contractorEmail: string;
  leadId: string;
  homeownerName: string;
  homeownerEmail: string;
  homeownerPhone: string;
  address: string;
  tradeType: string;
  budget?: number;
  timeline?: string;
  description?: string;
  photoCount: number;
  dashboardUrl: string;
};

/**
 * Send email notification for a new lead
 */
export async function sendNewLeadNotification(data: NewLeadEmailData): Promise<boolean> {
  const client = getResendClient();

  if (!client) {
    console.warn('Resend client not available - skipping email notification');
    return false;
  }

  try {
    await client.emails.send({
      from: 'ScopeGuard <notifications@scopeguard.com>', // Update with your verified domain
      to: data.contractorEmail,
      subject: `New Lead: ${data.homeownerName} - ${data.tradeType}`,
      html: generateNewLeadEmailHtml(data),
    });

    console.log(`New lead email sent to ${data.contractorEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send new lead email:', error);
    return false;
  }
}

/**
 * Generate HTML email for new lead notification
 */
function generateNewLeadEmailHtml(data: NewLeadEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Lead Notification</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">New Lead Received!</h1>
    <p style="margin: 0; color: #666;">You have a new project inquiry from ${data.homeownerName}</p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #111;">Lead Details</h2>

    <div style="margin-bottom: 16px;">
      <strong style="color: #666;">Homeowner:</strong><br>
      ${data.homeownerName}<br>
      <a href="mailto:${data.homeownerEmail}" style="color: #2563eb; text-decoration: none;">${data.homeownerEmail}</a><br>
      <a href="tel:${data.homeownerPhone}" style="color: #2563eb; text-decoration: none;">${data.homeownerPhone}</a>
    </div>

    <div style="margin-bottom: 16px;">
      <strong style="color: #666;">Property Address:</strong><br>
      ${data.address}
    </div>

    <div style="margin-bottom: 16px;">
      <strong style="color: #666;">Trade Type:</strong><br>
      <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 14px;">${data.tradeType}</span>
    </div>

    ${data.budget ? `
    <div style="margin-bottom: 16px;">
      <strong style="color: #666;">Budget:</strong><br>
      $${data.budget.toLocaleString()}
    </div>
    ` : ''}

    ${data.timeline ? `
    <div style="margin-bottom: 16px;">
      <strong style="color: #666;">Timeline:</strong><br>
      ${data.timeline}
    </div>
    ` : ''}

    ${data.description ? `
    <div style="margin-bottom: 16px;">
      <strong style="color: #666;">Description:</strong><br>
      ${data.description}
    </div>
    ` : ''}

    <div style="margin-bottom: 16px;">
      <strong style="color: #666;">Photos Uploaded:</strong><br>
      ${data.photoCount} photo${data.photoCount !== 1 ? 's' : ''}
    </div>
  </div>

  ${data.photoCount > 0 ? `
  <div style="background-color: #dbeafe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e40af;">
      <strong>AI Analysis In Progress</strong>
    </p>
    <p style="margin: 0; font-size: 14px; color: #1e40af;">
      We're analyzing the uploaded photos to extract project details and generate a preliminary scope of work. Check your dashboard for results.
    </p>
  </div>
  ` : ''}

  <div style="text-align: center; margin-bottom: 24px;">
    <a href="${data.dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
      View Lead in Dashboard
    </a>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0 0 8px 0;">ScopeGuard</p>
    <p style="margin: 0;">AI-powered estimating for contractors</p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send confirmation email to homeowner
 */
export async function sendHomeownerConfirmation(data: {
  homeownerName: string;
  homeownerEmail: string;
  contractorName: string;
  tradeType: string;
}): Promise<boolean> {
  const client = getResendClient();

  if (!client) {
    console.warn('Resend client not available - skipping email notification');
    return false;
  }

  try {
    await client.emails.send({
      from: 'ScopeGuard <notifications@scopeguard.com>',
      to: data.homeownerEmail,
      subject: `We received your project inquiry`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project Inquiry Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; font-size: 24px; color: #111;">Thank You, ${data.homeownerName}!</h1>
    <p style="margin: 0; color: #666;">Your project inquiry has been received</p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
    <p style="margin: 0 0 16px 0;">
      Thank you for submitting your ${data.tradeType} project details to ${data.contractorName}.
    </p>
    <p style="margin: 0 0 16px 0;">
      The team has been notified and will review your information. They'll reach out soon to discuss next steps, schedule a site visit, and provide an estimate.
    </p>
    <p style="margin: 0;">
      If you have any questions in the meantime, feel free to contact ${data.contractorName} directly.
    </p>
  </div>

  <div style="text-align: center; color: #999; font-size: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0 0 8px 0;">Powered by ScopeGuard</p>
  </div>
</body>
</html>
      `.trim(),
    });

    console.log(`Confirmation email sent to ${data.homeownerEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    return false;
  }
}
