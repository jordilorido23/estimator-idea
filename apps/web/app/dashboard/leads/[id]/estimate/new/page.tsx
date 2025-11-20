'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewEstimatePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${params.id}/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pricingGuidelines: {
            marginPercentage: 20,
            contingencyPercentage: 10,
            laborRatePerHour: 75,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate estimate');
      }

      // Redirect to the estimate view
      router.push(`/dashboard/leads/${params.id}/estimate/${data.estimateId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Generate AI Estimate</h2>
        <p className="mt-2 text-muted-foreground">
          Create a detailed cost estimate based on the photo analysis and scope of work.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Pricing Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Margin Percentage</label>
            <input
              data-testid="margin"
              name="margin"
              type="number"
              defaultValue={20}
              className="mt-1 w-full rounded-md border px-3 py-2"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your profit margin (default: 20%)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium">Contingency Percentage</label>
            <input
              data-testid="contingency"
              name="contingency"
              type="number"
              defaultValue={10}
              className="mt-1 w-full rounded-md border px-3 py-2"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Buffer for unknowns (default: 10%)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium">Labor Rate ($/hour)</label>
            <input
              data-testid="labor-rate"
              name="laborRate"
              type="number"
              defaultValue={75}
              className="mt-1 w-full rounded-md border px-3 py-2"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your hourly labor rate (default: $75/hr)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          disabled={loading}
          data-testid="cancel-button"
        >
          Cancel
        </button>
        <button
          onClick={handleGenerate}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={loading}
          data-testid="generate-estimate-button"
        >
          {loading ? 'Generating...' : 'Generate Estimate'}
        </button>
      </div>
    </div>
  );
}
