import { getAnthropicClient, AI_MODELS } from '../ai';
import type { ScopeOfWork } from './schemas';
import { retryWithBackoff, AIError } from './retry';
import { GeneratedEstimateSchema, type GeneratedEstimate, type EstimateLineItem } from './schemas';

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
    // Wrap API call with retry logic
    const response = await retryWithBackoff(
      () =>
        client.messages.create({
          model: AI_MODELS.SONNET,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      {
        maxAttempts: 3,
        timeoutMs: 60000, // Estimate generation can be complex
        initialDelayMs: 1000,
      }
    );

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AIError('No text response from Claude', 'NO_TEXT_RESPONSE', false);
    }

    // Extract JSON from the response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new AIError('No JSON found in Claude response', 'NO_JSON_RESPONSE', false);
    }

    // Parse JSON
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      throw new AIError(
        'Invalid JSON in Claude response',
        'INVALID_JSON',
        false,
        parseError
      );
    }

    // Build the complete estimate object with calculated totals
    const parsed = parsedData as {
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

    // Validate complete estimate with Zod schema
    const validationResult = GeneratedEstimateSchema.safeParse(estimate);
    if (!validationResult.success) {
      console.error('Estimate generation validation failed:', {
        errors: validationResult.error.flatten(),
        rawResponse: textContent.text,
      });
      throw new AIError(
        `Invalid estimate structure from Claude: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'INVALID_STRUCTURE',
        false
      );
    }

    return validationResult.data;
  } catch (error) {
    if (error instanceof AIError) {
      console.error('Estimate generation failed:', {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      });
      throw error;
    }

    console.error('Estimate generation error:', error);
    throw new AIError(
      `Failed to generate estimate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ESTIMATE_GENERATION_FAILED',
      false,
      error
    );
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
