import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@scopeguard/db/client';
import { env } from '@/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { type = 'DEPOSIT' } = body;

    // Fetch estimate with related data
    const estimate = await prisma.estimate.findUnique({
      where: { id: params.id },
      include: {
        lead: true,
        contractor: true,
      },
    });

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    // Check if estimate is in valid state for payment
    if (estimate.status !== 'SENT' && estimate.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Estimate is not available for payment' },
        { status: 400 }
      );
    }

    // Check if estimate is expired
    if (estimate.expiresAt && new Date() > estimate.expiresAt) {
      return NextResponse.json(
        { error: 'Estimate has expired' },
        { status: 400 }
      );
    }

    // Calculate payment amount based on type
    let amount: number;
    let description: string;

    if (type === 'DEPOSIT') {
      const depositPercentage = Number(estimate.contractor.depositPercentage);
      amount = (Number(estimate.total) * depositPercentage) / 100;
      description = `${depositPercentage}% Deposit - Project at ${estimate.lead.address}`;
    } else {
      // For FINAL payment, calculate remaining balance
      const totalPaid = await prisma.payment.aggregate({
        where: {
          estimateId: estimate.id,
          status: 'COMPLETED',
        },
        _sum: {
          amount: true,
        },
      });
      const paidAmount = Number(totalPaid._sum.amount || 0);
      amount = Number(estimate.total) - paidAmount;
      description = `Final Payment - Project at ${estimate.lead.address}`;
    }

    // Convert to cents for Stripe
    const amountInCents = Math.round(amount * 100);

    // Create or get Stripe customer
    let customerId = estimate.lead.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: estimate.lead.homeownerEmail,
        name: estimate.lead.homeownerName,
        metadata: {
          leadId: estimate.lead.id,
          contractorId: estimate.contractor.id,
        },
      });
      customerId = customer.id;

      // Save customer ID to database
      await prisma.lead.update({
        where: { id: estimate.lead.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        estimateId: estimate.id,
        amount: amount,
        type: type,
        status: 'PENDING',
      },
    });

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
              name: estimate.contractor.companyName,
              description: description,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${env.NEXT_PUBLIC_SITE_URL}/e/${estimate.publicToken}?payment=success`,
      cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/e/${estimate.publicToken}?payment=cancelled`,
      metadata: {
        paymentId: payment.id,
        estimateId: estimate.id,
        contractorId: estimate.contractor.id,
        leadId: estimate.lead.id,
        type: type,
      },
    });

    // Update payment with Stripe checkout ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeCheckoutId: session.id,
        metadata: {
          sessionUrl: session.url,
        },
      },
    });

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
