import { Decimal } from '@prisma/client/runtime/library';

/**
 * Test fixtures for common data structures
 */

export const mockContractor = {
  id: 'contractor_123',
  slug: 'test-contractor',
  companyName: 'Test Contractor LLC',
  email: 'contractor@example.com',
  depositPercent: new Decimal(25),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

export const mockContractorUser = {
  id: 'user_123',
  contractorId: 'contractor_123',
  clerkUserId: 'user_clerk123',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
  createdAt: new Date('2024-01-01'),
};

export const mockLead = {
  id: 'lead_123',
  contractorId: 'contractor_123',
  homeownerName: 'John Doe',
  homeownerEmail: 'john@example.com',
  homeownerPhone: '555-1234',
  address: '123 Main St, City, ST 12345',
  tradeType: 'ROOFING',
  budgetCents: 1500000, // $15,000
  timeline: '2024-06-01',
  notes: 'Need roof replacement due to storm damage',
  score: 75,
  status: 'NEW' as const,
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2024-01-15'),
};

export const mockPhoto = {
  id: 'photo_123',
  leadId: 'lead_123',
  url: 'https://test-bucket.s3.amazonaws.com/photos/test.jpg',
  key: 'photos/test.jpg',
  metadata: {
    name: 'roof-damage.jpg',
    type: 'image/jpeg',
    size: 2048576,
  },
  createdAt: new Date('2024-01-15'),
};

export const mockPhotoAnalysis = {
  url: 'https://test-bucket.s3.amazonaws.com/photos/test.jpg',
  analysis: {
    tradeType: 'ROOFING',
    conditions: ['Damaged shingles', 'Missing flashing'],
    materials: ['Asphalt shingles', 'Metal flashing'],
    estimatedDamageArea: '200 sq ft',
    safetyHazards: ['Working at height'],
    confidence: 0.85,
  },
};

export const mockTakeoff = {
  id: 'takeoff_123',
  leadId: 'lead_123',
  tradeType: 'ROOFING',
  provider: 'anthropic',
  version: 'claude-3-5-sonnet-20241022',
  confidence: 0.85,
  data: {
    photoAnalyses: [mockPhotoAnalysis],
    summary: {
      overallConfidence: 0.85,
      totalWorkItems: 5,
      hasSafetyHazards: true,
    },
    scopeOfWork: {
      workItems: ['Remove damaged shingles', 'Install new shingles', 'Replace flashing'],
      estimatedDuration: '2-3 days',
      materials: ['Asphalt shingles', 'Metal flashing', 'Roofing nails'],
    },
  },
  createdAt: new Date('2024-01-15'),
};

export const mockEstimate = {
  id: 'estimate_123',
  leadId: 'lead_123',
  contractorId: 'contractor_123',
  takeoffId: 'takeoff_123',
  subtotal: new Decimal(12000),
  margin: new Decimal(18), // 18%
  contingency: new Decimal(10), // 10%
  total: new Decimal(15360), // 12000 * 1.18 * 1.10
  depositRequired: new Decimal(3840), // 25% of total
  projectOutcome: null,
  actualCost: null,
  variance: null,
  variancePercent: null,
  completedAt: null,
  feedbackNotes: null,
  createdAt: new Date('2024-01-16'),
  updatedAt: new Date('2024-01-16'),
};

export const mockEstimateWithFeedback = {
  ...mockEstimate,
  projectOutcome: 'WON' as const,
  actualCost: new Decimal(15800), // Over estimate
  variance: new Decimal(440), // 15800 - 15360
  variancePercent: new Decimal(2.86), // (440 / 15360) * 100
  completedAt: new Date('2024-02-15'),
  feedbackNotes: 'Additional materials needed',
};

export const mockLineItem = {
  id: 'lineitem_123',
  estimateId: 'estimate_123',
  description: 'Remove and dispose of old shingles',
  quantity: new Decimal(200),
  unit: 'sq ft',
  unitPrice: new Decimal(3.50),
  total: new Decimal(700),
  category: 'LABOR',
  sortOrder: 1,
};

export const mockPayment = {
  id: 'payment_123',
  estimateId: 'estimate_123',
  stripeSessionId: 'cs_test_123',
  amount: new Decimal(3840),
  status: 'PENDING' as const,
  createdAt: new Date('2024-01-16'),
  updatedAt: new Date('2024-01-16'),
};

/**
 * Factory functions for creating variations of test data
 */

export const createMockLead = (overrides: Partial<typeof mockLead> = {}) => ({
  ...mockLead,
  ...overrides,
});

export const createMockEstimate = (overrides: Partial<typeof mockEstimate> = {}) => ({
  ...mockEstimate,
  ...overrides,
});

export const createMockEstimateWithVariance = (
  estimateTotal: number,
  actualCost: number
) => {
  const total = new Decimal(estimateTotal);
  const actual = new Decimal(actualCost);
  const variance = actual.minus(total);
  const variancePercent = variance.div(total).mul(100);

  return createMockEstimate({
    total,
    actualCost: actual,
    variance,
    variancePercent,
    projectOutcome: 'WON',
    completedAt: new Date(),
  });
};

export const createMockPhotoMetadata = (overrides: any = {}) => ({
  id: 'photo_test_' + Math.random(),
  key: 'photos/test-' + Math.random() + '.jpg',
  url: `https://test-bucket.s3.amazonaws.com/photos/test-${Math.random()}.jpg`,
  name: 'test-photo.jpg',
  type: 'image/jpeg',
  size: 1024000,
  ...overrides,
});
