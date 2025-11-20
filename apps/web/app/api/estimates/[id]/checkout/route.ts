import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@scopeguard/db/client';
import { env } from '@/env';
import { verifyEstimateOwnership } from '@/lib/auth-helpers';
import { checkRateLimit, ratelimit } from '@/lib/rate-limit';
import { asyncHandler, BadRequestError, NotFoundError } from '@/lib/errors';
import { createRequestLogger } from '@/lib/logger';
import { withTransaction } from '@/lib/db-transactions';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export const POST = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const log = createRequestLogger(request);
  log.info('Checkout session creation started', { estimateId: params.id });

  const body = await request.json();
  const { type = 'DEPOSIT', idempotencyKey } = body;

  // Check authorization - verify user owns this estimate
  const { estimate, contractorUser } = await verifyEstimateOwnership(params.id);
  log.info('Authorization verified', {
    estimateId: params.id,
    contractorId: contractorUser.contractorId,
  });

  // Rate limiting - prevent Stripe API abuse
  const identifier = `checkout:${contractorUser.contractorId}`;
  const rateLimitResult = await checkRateLimit(ratelimit.strict, identifier);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: rateLimitResult.reset,
      },
      {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.reset.toString(),
        },
      }
    );
  }

  // Check for existing payment with same idempotency key (prevent duplicate charges)
  if (idempotencyKey) {
    const existingPayment = await prisma.payment.findFirst({
      where: {
        estimateId: params.id,
        metadata: {
          path: ['idempotencyKey'],
          equals: idempotencyKey,
        },
      },
      include: {
        estimate: true,
      },
    });

    if (existingPayment && existingPayment.metadata) {
      const metadata = existingPayment.metadata as any;
      if (metadata.sessionUrl) {
        log.info('Returning existing checkout session', {
          paymentId: existingPayment.id,
          idempotencyKey,
        });
        return NextResponse.json({
          url: metadata.sessionUrl,
          sessionId: existingPayment.stripeCheckoutId,
        });
      }
    }
  }

  // Fetch estimate with related data (need to refetch to get lead and contractor)
  const estimateWithRelations = await prisma.estimate.findUnique({
    where: { id: params.id },
    include: {
      lead: true,
      contractor: true,
    },
  });

  if (!estimateWithRelations) {
    throw new NotFoundError('Estimate');
  }

  // Check if estimate is in valid state for payment
  if (estimateWithRelations.status !== 'SENT' && estimateWithRelations.status !== 'ACCEPTED') {
    throw new BadRequestError('Estimate is not available for payment');
  }

  // Check if estimate is expired
  if (estimateWithRelations.expiresAt && new Date() > estimateWithRelations.expiresAt) {
    throw new BadRequestError('Estimate has expired');
  }

  // Calculate payment amount based on type
  let amount: number;
  let description: string;

  if (type === 'DEPOSIT') {
    const depositPercentage = Number(estimateWithRelations.contractor.depositPercentage);
    amount = (Number(estimateWithRelations.total) * depositPercentage) / 100;
    description = `${depositPercentage}% Deposit - Project at ${estimateWithRelations.lead.address}`;
  } else {
    // For FINAL payment, calculate remaining balance
    const totalPaid = await prisma.payment.aggregate({
      where: {
        estimateId: estimateWithRelations.id,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
    });
    const paidAmount = Number(totalPaid._sum.amount || 0);
    amount = Number(estimateWithRelations.total) - paidAmount;
    description = `Final Payment - Project at ${estimateWithRelations.lead.address}`;
  }

  // Convert to cents for Stripe
  const amountInCents = Math.round(amount * 100);

  if (amountInCents <= 0) {
    throw new BadRequestError('Invalid payment amount');
  }

  log.info('Payment amount calculated', { amount, amountInCents, type });

  // Use transaction to ensure atomicity of payment creation and Stripe session
  const { payment, session, customerId } = await withTransaction(async (tx) => {
    // Create or get Stripe customer
    let customerId = estimateWithRelations.lead.stripeCustomerId;

    if (!customerId) {
      log.info('Creating new Stripe customer');
      const customer = await stripe.customers.create({
        email: estimateWithRelations.lead.homeownerEmail,
        name: estimateWithRelations.lead.homeownerName,
        metadata: {
          leadId: estimateWithRelations.lead.id,
          contractorId: estimateWithRelations.contractor.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await tx.lead.update({
        where: { id: estimateWithRelations.lead.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create payment record
    const payment = await tx.payment.create({
      data: {
        estimateId: estimateWithRelations.id,
        amount: amount,
        type: type,
        status: 'PENDING',
        metadata: idempotencyKey ? { idempotencyKey } : {},
      },
    });

    log.info('Payment record created', { paymentId: payment.id });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: estimateWithRelations.contractor.companyName,
              description: description,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/e/${estimateWithRelations.publicToken}?payment=success`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/e/${estimateWithRelations.publicToken}?payment=cancelled`,
      metadata: {
        paymentId: payment.id,
        estimateId: estimateWithRelations.id,
        contractorId: estimateWithRelations.contractor.id,
        leadId: estimateWithRelations.lead.id,
        type: type,
      },
    });

    log.info('Stripe checkout session created', { sessionId: session.id });

    // Update payment with Stripe checkout ID
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

    return { payment, session, customerId };
  });

  log.info('Checkout session creation completed', {
    paymentId: payment.id,
    sessionId: session.id,
  });

  return NextResponse.json({
    url: session.url,
    sessionId: session.id,
  });
});
