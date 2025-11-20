/**
 * Authorization Helper Functions
 *
 * Provides utilities for verifying contractor ownership and access control
 * across API routes that mutate or access sensitive resources.
 */

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@scopeguard/db';
import { NextResponse } from 'next/server';

/**
 * Custom error class for authorization failures
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND',
    public readonly statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Get the authenticated contractor user from Clerk session
 *
 * @returns The contractor user object with contractor relation
 * @throws AuthorizationError if not authenticated or user not found
 */
export async function getAuthenticatedContractorUser() {
  const { userId } = await auth();

  if (!userId) {
    throw new AuthorizationError(
      'Authentication required',
      'UNAUTHORIZED',
      401
    );
  }

  // Get user email from Clerk
  const clerkUser = await auth();
  const userEmail = clerkUser.sessionClaims?.email as string | undefined;

  if (!userEmail) {
    throw new AuthorizationError(
      'User email not found in session',
      'UNAUTHORIZED',
      401
    );
  }

  // Fetch contractor user from database
  const contractorUser = await prisma.contractorUser.findUnique({
    where: { email: userEmail },
    include: {
      contractor: true,
    },
  });

  if (!contractorUser) {
    throw new AuthorizationError(
      'Contractor user not found',
      'FORBIDDEN',
      403
    );
  }

  return contractorUser;
}

/**
 * Verify that the authenticated user owns the specified lead
 *
 * @param leadId - The ID of the lead to verify ownership for
 * @returns The lead object with contractor relation
 * @throws AuthorizationError if not authorized or lead not found
 */
export async function verifyLeadOwnership(leadId: string) {
  const contractorUser = await getAuthenticatedContractorUser();

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      contractor: true,
      photos: true,
    },
  });

  if (!lead) {
    throw new AuthorizationError(
      'Lead not found',
      'NOT_FOUND',
      404
    );
  }

  if (lead.contractorId !== contractorUser.contractorId) {
    throw new AuthorizationError(
      'You do not have permission to access this lead',
      'FORBIDDEN',
      403
    );
  }

  return { lead, contractorUser };
}

/**
 * Verify that the authenticated user owns the specified estimate
 *
 * @param estimateId - The ID of the estimate to verify ownership for
 * @returns The estimate object with lead and contractor relations
 * @throws AuthorizationError if not authorized or estimate not found
 */
export async function verifyEstimateOwnership(estimateId: string) {
  const contractorUser = await getAuthenticatedContractorUser();

  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    include: {
      lead: true,
      contractor: true,
    },
  });

  if (!estimate) {
    throw new AuthorizationError(
      'Estimate not found',
      'NOT_FOUND',
      404
    );
  }

  if (estimate.contractorId !== contractorUser.contractorId) {
    throw new AuthorizationError(
      'You do not have permission to access this estimate',
      'FORBIDDEN',
      403
    );
  }

  return { estimate, contractorUser };
}

/**
 * Handle authorization errors and return appropriate HTTP responses
 *
 * @param error - The error to handle
 * @returns NextResponse with appropriate status code and error message
 */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.statusCode }
    );
  }

  // Log unexpected errors
  console.error('Unexpected authorization error:', error);

  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

/**
 * Verify public estimate token access (for public estimate links)
 *
 * @param publicToken - The public token from the URL
 * @returns The estimate object if token is valid
 * @throws AuthorizationError if token is invalid or estimate not found
 */
export async function verifyPublicEstimateToken(publicToken: string) {
  const estimate = await prisma.estimate.findUnique({
    where: { publicToken },
    include: {
      lead: true,
      contractor: true,
    },
  });

  if (!estimate) {
    throw new AuthorizationError(
      'Invalid or expired estimate link',
      'NOT_FOUND',
      404
    );
  }

  // Note: Currently public tokens never expire
  // TODO: Add expiresAt field and check if token has expired
  // if (estimate.expiresAt && estimate.expiresAt < new Date()) {
  //   throw new AuthorizationError('Estimate link has expired', 'FORBIDDEN', 403);
  // }

  return estimate;
}
