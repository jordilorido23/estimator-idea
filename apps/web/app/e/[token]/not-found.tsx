import Link from 'next/link';

export default function EstimateNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Estimate Not Found
          </h1>
          <p className="text-gray-600">
            The estimate you're looking for doesn't exist or the link may have expired.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-700">
            This could happen if:
          </p>
          <ul className="space-y-2 text-left text-sm text-gray-600">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>The estimate link is incorrect or incomplete</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>The estimate has been deleted</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>You've been given an invalid link</span>
            </li>
          </ul>
          <div className="mt-6 border-t pt-4">
            <p className="text-sm text-gray-700">
              Please contact the contractor who sent you this estimate for assistance.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
