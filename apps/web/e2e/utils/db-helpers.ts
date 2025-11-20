import { PrismaClient, TradeType, Contractor, Lead, Estimate } from '@scopeguard/db';

const prisma = new PrismaClient();

/**
 * Clean up all test data from the database
 * Call this before each test to ensure a clean slate
 */
export async function cleanDatabase() {
  // Delete in order to respect foreign key constraints
  await prisma.payment.deleteMany();
  await prisma.aIUsage.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.takeoff.deleteMany();
  await prisma.document.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contractorUser.deleteMany();
  await prisma.contractor.deleteMany();
}

/**
 * Create a test contractor with default values
 * Also creates a ContractorUser for authentication in e2e tests
 */
export async function createTestContractor(overrides?: Partial<{
  companyName: string;
  slug: string;
  email: string;
  phone: string;
  trades: TradeType[];
  depositPercentage: number;
}>): Promise<Contractor> {
  const defaults = {
    companyName: 'Test Contractor Inc',
    slug: 'test-contractor',
    email: 'test@contractor.com',
    phone: '555-123-4567',
    trades: [TradeType.ROOFING, TradeType.PAINTING],
    depositPercentage: 25,
  };

  const contractor = await prisma.contractor.create({
    data: {
      ...defaults,
      ...overrides,
    },
  });

  // Create a ContractorUser for this contractor
  // This email MUST match the E2E_TEST_USER email in test-auth-helpers.ts
  await prisma.contractorUser.create({
    data: {
      email: 'test@contractor.com', // This matches the mock user in test-auth-helpers.ts
      role: 'OWNER',
      contractorId: contractor.id,
    },
  });

  return contractor;
}

/**
 * Create a test lead with default values
 */
export async function createTestLead(
  contractorId: string,
  overrides?: Partial<{
    homeownerName: string;
    homeownerEmail: string;
    homeownerPhone: string;
    address: string;
    tradeType: TradeType;
    budgetCents: number;
    timeline: string;
    notes: string;
    status: 'NEW' | 'QUALIFIED' | 'DECLINED' | 'ESTIMATED';
    score: number;
  }>
): Promise<Lead> {
  const defaults = {
    homeownerName: 'John Homeowner',
    homeownerEmail: 'john@example.com',
    homeownerPhone: '555-987-6543',
    address: '123 Main St, Anytown, CA 90210',
    tradeType: TradeType.ROOFING,
    budgetCents: 1000000, // $10,000
    timeline: 'Within 3 months',
    notes: 'Test lead notes',
    status: 'NEW' as const,
    score: 85,
  };

  return await prisma.lead.create({
    data: {
      contractorId,
      ...defaults,
      ...overrides,
    },
  });
}

/**
 * Create a test photo for a lead
 */
export async function createTestPhoto(leadId: string, overrides?: Partial<{
  url: string;
  key: string;
  metadata: any;
}>) {
  const defaults = {
    url: 'https://example.com/test-photo.jpg',
    key: 'test-photos/test-photo.jpg',
    metadata: {},
  };

  return await prisma.photo.create({
    data: {
      leadId,
      ...defaults,
      ...overrides,
    },
  });
}

/**
 * Create a test document for a lead
 */
export async function createTestDocument(leadId: string, overrides?: Partial<{
  url: string;
  key: string;
  fileName: string;
  fileType: 'PDF' | 'IMAGE' | 'DWG';
  metadata: any;
}>) {
  const defaults = {
    url: 'https://example.com/test-doc.pdf',
    key: 'test-docs/test-doc.pdf',
    fileName: 'test-doc.pdf',
    fileType: 'PDF' as const,
    metadata: {},
  };

  return await prisma.document.create({
    data: {
      leadId,
      ...defaults,
      ...overrides,
    },
  });
}

/**
 * Create a test takeoff (AI-analyzed scope)
 */
export async function createTestTakeoff(leadId: string, overrides?: Partial<{
  sourceType: 'PHOTO' | 'DOCUMENT' | 'HYBRID';
  tradeType: TradeType;
  data: any;
  confidence: number;
  reviewedAt: Date;
  accuracyFeedback: string;
  overallAccuracy: 'LOW' | 'MEDIUM' | 'HIGH';
}>) {
  const defaults = {
    sourceType: 'PHOTO' as const,
    tradeType: TradeType.ROOFING,
    provider: 'claude-3-5-sonnet-20241022',
    version: '1.0',
    documentIds: [],
    data: {
      scopeOfWork: 'Replace asphalt shingle roof',
      lineItems: [
        { item: 'Tear off old shingles', quantity: 2000, unit: 'sq ft' },
        { item: 'Install new shingles', quantity: 2000, unit: 'sq ft' },
      ],
      materials: ['Shingles', 'Underlayment', 'Flashing'],
      labor: { hours: 40, rate: 75 },
    },
    confidence: 0.85,
  };

  return await prisma.takeoff.create({
    data: {
      leadId,
      ...defaults,
      ...overrides,
    },
  });
}

/**
 * Create a test estimate
 */
export async function createTestEstimate(
  leadId: string,
  contractorId: string,
  overrides?: Partial<{
    lineItems: any;
    subtotal: number;
    margin: number;
    contingency: number;
    total: number;
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED';
    publicToken: string;
    expiresAt: Date;
    projectOutcome: 'WON' | 'LOST' | 'IN_PROGRESS' | 'CANCELLED';
    actualCost: number;
    variance: number;
    variancePercent: number;
  }>
): Promise<Estimate> {
  const subtotal = overrides?.subtotal || 800000; // $8,000
  const margin = overrides?.margin || 0.20; // 20%
  const contingency = overrides?.contingency || 0.10; // 10%
  const total = overrides?.total || Math.round(subtotal * (1 + margin + contingency));

  const defaults = {
    lineItems: [
      {
        description: 'Tear off and disposal',
        quantity: 2000,
        unit: 'sq ft',
        unitPrice: 1.5,
        total: 3000,
      },
      {
        description: 'New shingle installation',
        quantity: 2000,
        unit: 'sq ft',
        unitPrice: 2.5,
        total: 5000,
      },
    ],
    subtotal,
    margin,
    contingency,
    total,
    confidence: 'MEDIUM' as const,
    status: 'DRAFT' as const,
    publicToken: generatePublicToken(),
  };

  return await prisma.estimate.create({
    data: {
      leadId,
      contractorId,
      ...defaults,
      ...overrides,
    },
  });
}

/**
 * Generate a random public token for estimate sharing
 */
function generatePublicToken(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

/**
 * Disconnect Prisma client (call at end of test suite)
 */
export async function disconnectDb() {
  await prisma.$disconnect();
}

/**
 * Export the Prisma client for direct queries in tests
 */
export { prisma };
