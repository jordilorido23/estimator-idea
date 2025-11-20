'use client';

import { useState } from 'react';
import { Button } from '@scopeguard/ui';

interface PaymentButtonProps {
  estimateId: string;
  amount: number;
  contractorName: string;
}

export function PaymentButton({ estimateId, amount, contractorName }: PaymentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      // Create Stripe Checkout session
      const response = await fetch(`/api/estimates/${estimateId}/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'DEPOSIT',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start payment process. Please try again or contact the contractor.');
      setIsLoading(false);
    }
  };

  return (
    <Button
      data-testid="accept-button"
      onClick={handlePayment}
      disabled={isLoading}
      className="w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      size="lg"
    >
      {isLoading ? 'Processing...' : `Accept & Pay $${amount.toFixed(2)} Deposit`}
    </Button>
  );
}
