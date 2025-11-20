/**
 * Payment Service Layer
 *
 * Encapsulates business logic for payment operations:
 * - Creating checkout sessions
 * - Processing payments
 * - Handling refunds
 * - Payment status management
 *
 * Benefits:
 * - Separation of concerns (business logic vs. HTTP layer)
 * - Easier testing (no HTTP dependencies)
 * - Reusability across different contexts
 * - Better error handling and validation
 */

import Stripe from 'stripe';
import { prisma, Prisma } from '@scopeguard/db';
import { env } from '@/env';
import { withTransaction } from '../db-transactions';
import { logger } from '../logger';
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  ExternalServiceError,
} from '../errors';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export interface CreateCheckoutSessionInput {
  estimateId: string;
  paymentType: 'DEPOSIT' | 'FINAL' | 'MILESTONE';
  idempotencyKey?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  sessionUrl: string;
  paymentId: string;
  amount: number;
}

/**
 * Payment Service
 */
export class PaymentService {
  private log = logger.child({ service: 'payment' });

  /**
   * Create a Stripe checkout session for an estimate payment
   */
  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CreateCheckoutSessionResult> {
    const { estimateId, paymentType, idempotencyKey } = input;

    this.log.info('Creating checkout session', { estimateId, paymentType });

    // Check for existing payment with same idempotency key (prevent duplicate charges)
    if (idempotencyKey) {
      const existingPayment = await this.findPaymentByIdempotencyKey(
        estimateId,
        idempotencyKey
      );

      if (existingPayment) {
        const metadata = existingPayment.metadata as any;
        if (metadata?.sessionUrl && existingPayment.stripeCheckoutId) {
          this.log.info('Returning existing checkout session', {
            paymentId: existingPayment.id,
            idempotencyKey,
          });

          return {
            sessionId: existingPayment.stripeCheckoutId,
            sessionUrl: metadata.sessionUrl,
            paymentId: existingPayment.id,
            amount: Number(existingPayment.amount),
          };
        }
      }
    }

    // Fetch estimate with all required relations
    const estimate = await prisma.estimate.findUnique({
      where: { id: estimateId },
      include: {
        lead: true,
        contractor: true,
        payments: {
          where: { status: 'COMPLETED' },
        },
      },
    });

    if (!estimate) {
      throw new NotFoundError('Estimate');
    }

    // Validate estimate state
    this.validateEstimateForPayment(estimate);

    // Calculate payment amount
    const { amount, description } = this.calculatePaymentAmount(
      estimate,
      paymentType
    );

    // Create payment and Stripe session in a transaction
    const result = await withTransaction(async (tx) => {
      // Ensure Stripe customer exists
      const customerId = await this.ensureStripeCustomer(
        estimate.lead,
        estimate.contractor.id,
        tx
      );

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          estimateId: estimate.id,
          amount: new Prisma.Decimal(amount),
          type: paymentType,
          status: 'PENDING',
          metadata: idempotencyKey ? { idempotencyKey } : {},
        },
      });

      this.log.info('Payment record created', { paymentId: payment.id });

      // Create Stripe Checkout Session
      const session = await this.createStripeSession({
        customerId,
        amount,
        description,
        paymentId: payment.id,
        estimateId: estimate.id,
        contractorName: estimate.contractor.companyName,
        publicToken: estimate.publicToken || '',
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        metadata: {
          paymentId: payment.id,
          estimateId: estimate.id,
          contractorId: estimate.contractor.id,
          leadId: estimate.lead.id,
          type: paymentType,
        },
      });

      // Update payment with Stripe session info
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          stripeCheckoutId: session.id,
          metadata: {
            ...(idempotencyKey ? { idempotencyKey } : {}),
            sessionUrl: session.url,
          },
        },
      });

      return {
        sessionId: session.id,
        sessionUrl: session.url || '',
        paymentId: payment.id,
        amount,
      };
    });

    this.log.info('Checkout session created successfully', {
      sessionId: result.sessionId,
      paymentId: result.paymentId,
    });

    return result;
  }

  /**
   * Process a successful payment (called from webhook)
   */
  async processPaymentSuccess(paymentIntentId: string): Promise<void> {
    this.log.info('Processing payment success', { paymentIntentId });

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { stripePaymentId: paymentIntentId },
          {
            metadata: {
              path: ['paymentIntentId'],
              equals: paymentIntentId,
            },
          },
        ],
      },
      include: {
        estimate: true,
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment');
    }

    await withTransaction(async (tx) => {
      // Update payment status
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          paidAt: new Date(),
        },
      });

      // If this is the first payment (deposit), update estimate status
      if (payment.type === 'DEPOSIT' && payment.estimate.status === 'SENT') {
        await tx.estimate.update({
          where: { id: payment.estimateId },
          data: { status: 'ACCEPTED' },
        });
      }
    });

    this.log.info('Payment processed successfully', { paymentId: payment.id });
  }

  /**
   * Process a failed payment
   */
  async processPaymentFailure(paymentIntentId: string, error: string): Promise<void> {
    this.log.warn('Processing payment failure', { paymentIntentId, error });

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { stripePaymentId: paymentIntentId },
          {
            metadata: {
              path: ['paymentIntentId'],
              equals: paymentIntentId,
            },
          },
        ],
      },
    });

    if (!payment) {
      return; // Payment not found, nothing to do
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: {
          ...(payment.metadata as any),
          error,
        },
      },
    });
  }

  /**
   * Private helper: Find payment by idempotency key
   */
  private async findPaymentByIdempotencyKey(
    estimateId: string,
    idempotencyKey: string
  ) {
    return prisma.payment.findFirst({
      where: {
        estimateId,
        metadata: {
          path: ['idempotencyKey'],
          equals: idempotencyKey,
        },
      },
    });
  }

  /**
   * Private helper: Validate estimate is ready for payment
   */
  private validateEstimateForPayment(estimate: any): void {
    if (estimate.status !== 'SENT' && estimate.status !== 'ACCEPTED') {
      throw new BadRequestError('Estimate is not available for payment');
    }

    if (estimate.expiresAt && new Date() > estimate.expiresAt) {
      throw new BadRequestError('Estimate has expired');
    }
  }

  /**
   * Private helper: Calculate payment amount based on type
   */
  private calculatePaymentAmount(
    estimate: any,
    paymentType: 'DEPOSIT' | 'FINAL' | 'MILESTONE'
  ): { amount: number; description: string } {
    const total = Number(estimate.total);

    if (paymentType === 'DEPOSIT') {
      const depositPercentage = Number(estimate.contractor.depositPercentage);
      const amount = (total * depositPercentage) / 100;

      return {
        amount,
        description: `${depositPercentage}% Deposit - Project at ${estimate.lead.address}`,
      };
    } else if (paymentType === 'FINAL') {
      // Calculate remaining balance
      const totalPaid = estimate.payments.reduce(
        (sum: number, payment: any) => sum + Number(payment.amount),
        0
      );
      const amount = total - totalPaid;

      if (amount <= 0) {
        throw new BadRequestError('No remaining balance to pay');
      }

      return {
        amount,
        description: `Final Payment - Project at ${estimate.lead.address}`,
      };
    } else {
      throw new BadRequestError('MILESTONE payments not yet implemented');
    }
  }

  /**
   * Private helper: Ensure Stripe customer exists for lead
   */
  private async ensureStripeCustomer(
    lead: any,
    contractorId: string,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    if (lead.stripeCustomerId) {
      return lead.stripeCustomerId;
    }

    // Create new Stripe customer
    try {
      const customer = await stripe.customers.create({
        email: lead.homeownerEmail,
        name: lead.homeownerName,
        metadata: {
          leadId: lead.id,
          contractorId,
        },
      });

      // Save customer ID to database
      await tx.lead.update({
        where: { id: lead.id },
        data: { stripeCustomerId: customer.id },
      });

      return customer.id;
    } catch (error) {
      throw new ExternalServiceError(
        'Stripe',
        'Failed to create customer',
        error
      );
    }
  }

  /**
   * Private helper: Create Stripe checkout session
   */
  private async createStripeSession(params: {
    customerId: string;
    amount: number;
    description: string;
    paymentId: string;
    estimateId: string;
    contractorName: string;
    publicToken: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata: Record<string, string>;
  }): Promise<Stripe.Checkout.Session> {
    const amountInCents = Math.round(params.amount * 100);

    if (amountInCents <= 0) {
      throw new BadRequestError('Invalid payment amount');
    }

    try {
      const baseUrl = env.NEXT_PUBLIC_SITE_URL;
      const session = await stripe.checkout.sessions.create({
        customer: params.customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: params.contractorName,
                description: params.description,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        success_url:
          params.successUrl ||
          `${baseUrl}/e/${params.publicToken}?payment=success`,
        cancel_url:
          params.cancelUrl ||
          `${baseUrl}/e/${params.publicToken}?payment=cancelled`,
        metadata: params.metadata,
      });

      return session;
    } catch (error) {
      throw new ExternalServiceError(
        'Stripe',
        'Failed to create checkout session',
        error
      );
    }
  }
}

/**
 * Singleton instance
 */
export const paymentService = new PaymentService();
