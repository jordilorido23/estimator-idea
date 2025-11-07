import Link from 'next/link';

import { Button } from '@scopeguard/ui';

export default function ContractorNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-6 text-center">
      <div className="max-w-md space-y-4 rounded-2xl border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Contractor not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find an intake portal for this contractor. Double-check the link you received or contact the contractor directly.
        </p>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
