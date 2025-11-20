import { TradeType } from '@scopeguard/db';

/**
 * Test data factories for creating consistent test data
 */

export const testContractors = {
  roofingContractor: {
    companyName: 'Elite Roofing Co',
    slug: 'elite-roofing',
    email: 'contact@eliteroofing.com',
    phone: '555-100-0001',
    trades: [TradeType.ROOFING],
    depositPercentage: 25,
  },
  multiTradeContractor: {
    companyName: 'Complete Home Solutions',
    slug: 'complete-home',
    email: 'info@completehome.com',
    phone: '555-100-0002',
    trades: [TradeType.KITCHEN, TradeType.BATH, TradeType.FLOORING, TradeType.PAINTING],
    depositPercentage: 30,
  },
};

export const testLeads = {
  roofingLead: {
    homeownerName: 'Alice Johnson',
    homeownerEmail: 'alice@example.com',
    homeownerPhone: '555-200-0001',
    address: '456 Oak Avenue, Springfield, IL 62701',
    tradeType: TradeType.ROOFING,
    budgetCents: 1500000, // $15,000
    timeline: 'Within 2 months',
    notes: 'Roof is 20 years old, showing signs of wear. Some shingles are missing.',
    status: 'NEW' as const,
    score: 90,
  },
  kitchenLead: {
    homeownerName: 'Bob Smith',
    homeownerEmail: 'bob@example.com',
    homeownerPhone: '555-200-0002',
    address: '789 Pine Street, Austin, TX 78701',
    tradeType: TradeType.KITCHEN,
    budgetCents: 5000000, // $50,000
    timeline: 'Flexible, within 6 months',
    notes: 'Full kitchen remodel. Want modern cabinets, new appliances, and quartz countertops.',
    status: 'NEW' as const,
    score: 95,
  },
  incompleteLead: {
    homeownerName: 'Charlie Davis',
    homeownerEmail: 'charlie@example.com',
    homeownerPhone: '555-200-0003',
    address: '321 Elm Drive, Seattle, WA 98101',
    tradeType: TradeType.PAINTING,
    budgetCents: 500000, // $5,000
    timeline: 'ASAP',
    notes: 'Need interior painting',
    status: 'NEW' as const,
    score: 45, // Lower score due to vague details
  },
};

export const testPhotos = {
  roofDamage: {
    url: 'https://test-bucket.s3.amazonaws.com/roof-damage.jpg',
    key: 'test/roof-damage.jpg',
    metadata: { width: 1920, height: 1080, fileSize: 2048000 },
  },
  roofOverview: {
    url: 'https://test-bucket.s3.amazonaws.com/roof-overview.jpg',
    key: 'test/roof-overview.jpg',
    metadata: { width: 1920, height: 1080, fileSize: 1536000 },
  },
  kitchenBefore: {
    url: 'https://test-bucket.s3.amazonaws.com/kitchen-before.jpg',
    key: 'test/kitchen-before.jpg',
    metadata: { width: 1920, height: 1080, fileSize: 1792000 },
  },
};

export const testDocuments = {
  floorPlan: {
    url: 'https://test-bucket.s3.amazonaws.com/floor-plan.pdf',
    key: 'test/floor-plan.pdf',
    fileName: 'floor-plan.pdf',
    fileType: 'PDF' as const,
    metadata: { pages: 2, fileSize: 512000 },
  },
  blueprint: {
    url: 'https://test-bucket.s3.amazonaws.com/blueprint.dwg',
    key: 'test/blueprint.dwg',
    fileName: 'blueprint.dwg',
    fileType: 'DWG' as const,
    metadata: { fileSize: 1024000 },
  },
};

export const testTakeoffs = {
  roofingTakeoff: {
    sourceType: 'PHOTO' as const,
    tradeType: TradeType.ROOFING,
    provider: 'claude-3-5-sonnet-20241022',
    version: '1.0',
    documentIds: [],
    data: {
      scopeOfWork: 'Complete roof replacement on single-story residential home',
      lineItems: [
        {
          item: 'Tear off existing asphalt shingles',
          quantity: 2200,
          unit: 'sq ft',
          notes: 'Single layer removal',
        },
        {
          item: 'Install synthetic underlayment',
          quantity: 2200,
          unit: 'sq ft',
        },
        {
          item: 'Install architectural shingles',
          quantity: 2200,
          unit: 'sq ft',
          notes: '30-year warranty',
        },
        {
          item: 'Replace ridge cap',
          quantity: 60,
          unit: 'linear ft',
        },
        {
          item: 'Install new roof vents',
          quantity: 4,
          unit: 'each',
        },
      ],
      materials: [
        'Architectural shingles (CertainTeed Landmark)',
        'Synthetic underlayment',
        'Ice & water shield',
        'Ridge cap shingles',
        'Roof vents',
        'Starter strips',
        'Roofing nails',
      ],
      labor: {
        hours: 48,
        rate: 75,
        crew: 3,
        days: 2,
      },
      measurements: {
        totalArea: 2200,
        pitch: '6/12',
        stories: 1,
        complexity: 'Medium',
      },
    },
    confidence: 0.88,
  },
  kitchenTakeoff: {
    sourceType: 'HYBRID' as const,
    tradeType: TradeType.KITCHEN,
    provider: 'claude-3-5-sonnet-20241022',
    version: '1.0',
    documentIds: [],
    data: {
      scopeOfWork: 'Full kitchen remodel with new cabinets, countertops, and appliances',
      lineItems: [
        { item: 'Demo existing cabinets and countertops', quantity: 1, unit: 'kitchen' },
        { item: 'Install base cabinets', quantity: 18, unit: 'linear ft' },
        { item: 'Install upper cabinets', quantity: 12, unit: 'linear ft' },
        { item: 'Install quartz countertops', quantity: 45, unit: 'sq ft' },
        { item: 'Install tile backsplash', quantity: 30, unit: 'sq ft' },
        { item: 'Install sink and faucet', quantity: 1, unit: 'set' },
        { item: 'Install dishwasher', quantity: 1, unit: 'each' },
      ],
      materials: ['Cabinets', 'Quartz countertops', 'Tile', 'Sink', 'Faucet', 'Appliances'],
      labor: { hours: 120, rate: 85, crew: 2, days: 8 },
    },
    confidence: 0.92,
  },
};

export const testEstimates = {
  roofingEstimate: {
    lineItems: [
      {
        description: 'Tear off and disposal of existing roof',
        quantity: 2200,
        unit: 'sq ft',
        unitPrice: 1.25,
        total: 2750,
      },
      {
        description: 'Install synthetic underlayment',
        quantity: 2200,
        unit: 'sq ft',
        unitPrice: 0.50,
        total: 1100,
      },
      {
        description: 'Install architectural shingles',
        quantity: 2200,
        unit: 'sq ft',
        unitPrice: 3.75,
        total: 8250,
      },
      {
        description: 'Ridge cap installation',
        quantity: 60,
        unit: 'linear ft',
        unitPrice: 8.00,
        total: 480,
      },
      {
        description: 'Roof vent installation',
        quantity: 4,
        unit: 'each',
        unitPrice: 125,
        total: 500,
      },
    ],
    subtotal: 13080,
    margin: 0.18, // 18%
    contingency: 0.08, // 8%
    total: 16481, // $13,080 * 1.26
    confidence: 'MEDIUM' as const,
    status: 'DRAFT' as const,
  },
  kitchenEstimate: {
    lineItems: [
      { description: 'Demolition and disposal', quantity: 1, unit: 'kitchen', unitPrice: 2500, total: 2500 },
      { description: 'Base cabinets (installed)', quantity: 18, unit: 'linear ft', unitPrice: 350, total: 6300 },
      { description: 'Upper cabinets (installed)', quantity: 12, unit: 'linear ft', unitPrice: 300, total: 3600 },
      { description: 'Quartz countertops (installed)', quantity: 45, unit: 'sq ft', unitPrice: 125, total: 5625 },
      { description: 'Tile backsplash (installed)', quantity: 30, unit: 'sq ft', unitPrice: 45, total: 1350 },
      { description: 'Sink and faucet (installed)', quantity: 1, unit: 'set', unitPrice: 1200, total: 1200 },
      { description: 'Dishwasher (installed)', quantity: 1, unit: 'each', unitPrice: 1500, total: 1500 },
    ],
    subtotal: 22075,
    margin: 0.22, // 22%
    contingency: 0.10, // 10%
    total: 29139, // $22,075 * 1.32
    confidence: 'HIGH' as const,
    status: 'DRAFT' as const,
  },
};

/**
 * Form data for intake form submissions
 */
export const intakeFormData = {
  roofingProject: {
    homeownerName: testLeads.roofingLead.homeownerName,
    homeownerEmail: testLeads.roofingLead.homeownerEmail,
    homeownerPhone: testLeads.roofingLead.homeownerPhone,
    address: testLeads.roofingLead.address,
    tradeType: TradeType.ROOFING,
    budget: '$10,000 - $20,000',
    timeline: testLeads.roofingLead.timeline,
    notes: testLeads.roofingLead.notes,
  },
  kitchenProject: {
    homeownerName: testLeads.kitchenLead.homeownerName,
    homeownerEmail: testLeads.kitchenLead.homeownerEmail,
    homeownerPhone: testLeads.kitchenLead.homeownerPhone,
    address: testLeads.kitchenLead.address,
    tradeType: TradeType.KITCHEN,
    budget: '$40,000 - $60,000',
    timeline: testLeads.kitchenLead.timeline,
    notes: testLeads.kitchenLead.notes,
  },
};
