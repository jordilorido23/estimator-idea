import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@scopeguard/db/client';
import { env } from '@/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// Disable body parsing for webhooks
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleChargeRefunded(charge);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.paymentId;
  const estimateId = session.metadata?.estimateId;

  if (!paymentId || !estimateId) {
    console.error('Missing payment or estimate ID in session metadata');
    return;
  }

  // Update payment status
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'PROCESSING',
      stripeCheckoutId: session.id,
      metadata: {
        checkoutSessionId: session.id,
        paymentIntentId: session.payment_intent,
        amountTotal: session.amount_total,
        currency: session.currency,
      },
    },
  });

  // If this is the first payment (deposit), update estimate status to ACCEPTED
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      payments: {
        where: {
          status: 'COMPLETED',
        },
      },
    },
  });

  if (estimate && estimate.payments.length === 0 && estimate.status === 'SENT') {
    await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        status: 'ACCEPTED',
      },
    });
  }

  console.log(`Checkout completed for payment ${paymentId}`);
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.paymentId;

  if (!paymentId) {
    return;
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'FAILED',
      metadata: {
        error: 'Checkout session expired',
        checkoutSessionId: session.id,
      },
    },
  });

  console.log(`Checkout expired for payment ${paymentId}`);
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Find payment by payment intent ID
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { stripePaymentId: paymentIntent.id },
        {
          metadata: {
            path: ['paymentIntentId'],
            equals: paymentIntent.id,
          },
        },
      ],
    },
  });

  if (!payment) {
    console.error(`Payment not found for payment intent ${paymentIntent.id}`);
    return;
  }

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'COMPLETED',
      stripePaymentId: paymentIntent.id,
      paidAt: new Date(),
      metadata: {
        ...(payment.metadata as any),
        paymentIntentId: paymentIntent.id,
        amountReceived: paymentIntent.amount_received,
        charges: paymentIntent.charges.data.map((charge) => ({
          id: charge.id,
          amount: charge.amount,
          receipt_url: charge.receipt_url,
        })),
      },
    },
  });

  console.log(`Payment succeeded: ${payment.id}`);
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { stripePaymentId: paymentIntent.id },
        {
          metadata: {
            path: ['paymentIntentId'],
            equals: paymentIntent.id,
          },
        },
      ],
    },
  });

  if (!payment) {
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      metadata: {
        ...(payment.metadata as any),
        error: paymentIntent.last_payment_error?.message || 'Payment failed',
        paymentIntentId: paymentIntent.id,
      },
    },
  });

  console.log(`Payment failed: ${payment.id}`);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const payment = await prisma.payment.findFirst({
    where: {
      metadata: {
        path: ['charges', '0', 'id'],
        equals: charge.id,
      },
    },
  });

  if (!payment) {
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'REFUNDED',
      metadata: {
        ...(payment.metadata as any),
        refunded: true,
        refundAmount: charge.amount_refunded,
        refundedAt: new Date().toISOString(),
      },
    },
  });

  console.log(`Charge refunded: ${payment.id}`);
}
