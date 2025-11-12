import { getAnthropicClient, AI_MODELS } from '../ai';
import type { ScopeOfWork } from './scope-generator';

export type EstimateLineItem = {
  category: string;
  description: string;
  quantity: number;
  unit: string; // e.g., 'sq ft', 'linear ft', 'each', 'hour'
  unitCost: number;
  totalCost: number;
  notes?: string;
};

export type GeneratedEstimate = {
  lineItems: EstimateLineItem[];
  subtotal: number;
  marginPercentage: number;
  marginAmount: number;
  contingencyPercentage: number;
  contingencyAmount: number;
  total: number;
  assumptions: string[];
  exclusions: string[];
};

/**
 * Generate a detailed estimate from scope of work and pricing preferences
 */
export async function generateEstimate(input: {
  scopeOfWork: ScopeOfWork;
  tradeType: string;
  region?: string;
  pricingGuidelines?: {
    marginPercentage?: number; // default 20%
    contingencyPercentage?: number; // default 10%
    laborRatePerHour?: number;
  };
}): Promise<GeneratedEstimate> {
  const client = getAnthropicClient();

  const marginPercentage = input.pricingGuidelines?.marginPercentage ?? 20;
  const contingencyPercentage = input.pricingGuidelines?.contingencyPercentage ?? 10;
  const laborRate = input.pricingGuidelines?.laborRatePerHour ?? 75;

  const prompt = `You are a construction estimator creating a detailed cost estimate.

**Trade Type:** ${input.tradeType}
${input.region ? `**Region:** ${input.region}` : ''}

**Scope of Work:**
${input.scopeOfWork.summary}

**Line Items:**
${input.scopeOfWork.lineItems.map((item) => `- ${item.category}: ${item.description}${item.notes ? ` (${item.notes})` : ''}`).join('\n')}

**Pricing Guidelines:**
- Target margin: ${marginPercentage}%
- Contingency: ${contingencyPercentage}%
- Labor rate: $${laborRate}/hour

**Your task:**
Create detailed line items with realistic quantities, units, and costs for this ${input.tradeType} project.

For each line item, provide:
1. Category (e.g., "Demolition", "Materials", "Labor", "Installation")
2. Description (specific task or material)
3. Quantity (numeric)
4. Unit (e.g., "sq ft", "linear ft", "each", "hour")
5. Unit cost (realistic market rate)
6. Total cost (quantity × unit cost)
7. Optional notes

Also provide:
- List of assumptions made in this estimate
- List of exclusions (what's NOT included)

**Important:**
- Use realistic market rates for the trade type and region
- Break down labor and materials separately where applicable
- Be conservative with quantities (better to overestimate slightly)
- Consider common hidden costs (permits, disposal, prep work)
- The subtotal should be the sum of all line item totals

Respond ONLY with valid JSON:
{
  "lineItems": [
    {
      "category": "string",
      "description": "string",
      "quantity": number,
      "unit": "string",
      "unitCost": number,
      "totalCost": number,
      "notes": "optional string"
    }
  ],
  "assumptions": ["string"],
  "exclusions": ["string"]
}`;

  try {
    const response = await client.messages.create({
      model: AI_MODELS.SONNET,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from the response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      lineItems: EstimateLineItem[];
      assumptions: string[];
      exclusions: string[];
    };

    // Calculate totals
    const subtotal = parsed.lineItems.reduce((sum, item) => sum + item.totalCost, 0);
    const marginAmount = subtotal * (marginPercentage / 100);
    const contingencyAmount = subtotal * (contingencyPercentage / 100);
    const total = subtotal + marginAmount + contingencyAmount;

    const estimate: GeneratedEstimate = {
      lineItems: parsed.lineItems,
      subtotal,
      marginPercentage,
      marginAmount,
      contingencyPercentage,
      contingencyAmount,
      total,
      assumptions: parsed.assumptions,
      exclusions: parsed.exclusions,
    };

    return estimate;
  } catch (error) {
    console.error('Estimate generation error:', error);
    throw new Error(`Failed to generate estimate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate estimate totals after manual edits
 */
export function recalculateEstimate(
  lineItems: EstimateLineItem[],
  marginPercentage: number,
  contingencyPercentage: number
): Pick<GeneratedEstimate, 'subtotal' | 'marginAmount' | 'contingencyAmount' | 'total'> {
  const subtotal = lineItems.reduce((sum, item) => sum + item.totalCost, 0);
  const marginAmount = subtotal * (marginPercentage / 100);
  const contingencyAmount = subtotal * (contingencyPercentage / 100);
  const total = subtotal + marginAmount + contingencyAmount;

  return {
    subtotal,
    marginAmount,
    contingencyAmount,
    total,
  };
}
