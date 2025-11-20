import { getAnthropicClient, AI_MODELS } from '../ai';
import { retryWithBackoff, AIError } from './retry';
import { PhotoAnalysisSchema, type PhotoAnalysis } from './schemas';

/**
 * Analyze a construction photo using Claude Vision
 * @param imageUrl - Public URL of the image to analyze
 * @param returnResponse - If true, returns both analysis and raw API response for usage tracking
 * @returns Structured analysis of the photo (and optionally the raw response)
 */
export async function analyzeConstructionPhoto(
  imageUrl: string
): Promise<PhotoAnalysis>;
export async function analyzeConstructionPhoto(
  imageUrl: string,
  returnResponse: true
): Promise<{ analysis: PhotoAnalysis; response: any }>;
export async function analyzeConstructionPhoto(
  imageUrl: string,
  returnResponse?: boolean
): Promise<PhotoAnalysis | { analysis: PhotoAnalysis; response: any }> {
  const client = getAnthropicClient();

  const prompt = `You are a construction expert analyzing a photo for an estimate.
Carefully examine this construction/property photo and extract the following information:

1. **Trade Type(s)**: What trades are relevant? (e.g., electrical, plumbing, HVAC, roofing, flooring, painting, drywall, framing, etc.)
2. **Conditions**: Current state of the area (e.g., age, wear, damage level)
3. **Dimensions**: Approximate dimensions if visible (with confidence level: low/medium/high)
4. **Materials**: What materials are present? (e.g., wood siding, asphalt shingles, copper pipes, ceramic tile)
5. **Damage**: If present, describe severity (minor/moderate/severe) and what's damaged
6. **Access Constraints**: Any factors that make this job harder? (e.g., high ceiling, tight space, furniture in way, second story)
7. **Work Items**: What specific tasks would need to be done? (e.g., "remove and replace drywall", "install new fixtures")
8. **Safety Hazards**: Any safety concerns visible? (e.g., mold, asbestos, electrical hazards, structural issues)
9. **Overall Confidence**: How confident are you in this analysis? (0.0 to 1.0)
10. **Notes**: Any other relevant observations for the contractor

Respond ONLY with valid JSON matching this structure:
{
  "tradeType": ["string"],
  "conditions": ["string"],
  "dimensions": {
    "approximate": "string",
    "confidence": "low" | "medium" | "high"
  },
  "materials": ["string"],
  "damage": {
    "severity": "minor" | "moderate" | "severe",
    "description": "string"
  },
  "accessConstraints": ["string"],
  "workItems": ["string"],
  "safetyHazards": ["string"],
  "confidence": 0.85,
  "notes": "string"
}

If information is not visible or applicable, omit that field (except tradeType, conditions, materials, accessConstraints, workItems, confidence, and notes which are required).`;

  try {
    // Wrap API call with retry logic and timeout
    // Vision API can take longer, so use 45s timeout instead of default 30s
    const response = await retryWithBackoff(
      () =>
        client.messages.create({
          model: AI_MODELS.SONNET,
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'url',
                    url: imageUrl,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        }),
      {
        maxAttempts: 3,
        timeoutMs: 45000, // Vision API can be slower
        initialDelayMs: 1000,
      }
    );

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new AIError('No text response from Claude', 'NO_TEXT_RESPONSE', false);
    }

    // Extract JSON from the response (may be wrapped in markdown code blocks)
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

    // Validate with Zod schema
    const validationResult = PhotoAnalysisSchema.safeParse(parsedData);
    if (!validationResult.success) {
      console.error('Photo analysis validation failed:', {
        errors: validationResult.error.flatten(),
        rawResponse: textContent.text,
      });
      throw new AIError(
        `Invalid analysis structure from Claude: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'INVALID_STRUCTURE',
        false
      );
    }

    const analysis = validationResult.data;

    // Return both analysis and response if requested (for usage tracking)
    if (returnResponse) {
      return { analysis, response };
    }

    return analysis;
  } catch (error) {
    // If it's already an AIError, just rethrow it
    if (error instanceof AIError) {
      console.error('Photo analysis failed:', {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      });
      throw error;
    }

    // Wrap other errors
    console.error('Photo analysis error:', error);
    throw new AIError(
      `Failed to analyze photo: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ANALYSIS_FAILED',
      false,
      error
    );
  }
}

/**
 * Analyze multiple photos and combine insights
 */
export async function analyzeMultiplePhotos(
  imageUrls: string[]
): Promise<{
  photos: Array<{ url: string; analysis: PhotoAnalysis }>;
  summary: {
    primaryTrades: string[];
    overallConfidence: number;
    totalWorkItems: number;
    hasSafetyHazards: boolean;
  };
}> {
  const analyses = await Promise.all(
    imageUrls.map(async (url) => ({
      url,
      analysis: await analyzeConstructionPhoto(url),
    }))
  );

  // Aggregate insights
  const allTrades = new Set<string>();
  let totalConfidence = 0;
  let totalWorkItems = 0;
  let hasSafetyHazards = false;

  for (const { analysis } of analyses) {
    analysis.tradeType.forEach((trade) => allTrades.add(trade));
    totalConfidence += analysis.confidence;
    totalWorkItems += analysis.workItems.length;
    if (analysis.safetyHazards && analysis.safetyHazards.length > 0) {
      hasSafetyHazards = true;
    }
  }

  return {
    photos: analyses,
    summary: {
      primaryTrades: Array.from(allTrades),
      overallConfidence: analyses.length > 0 ? totalConfidence / analyses.length : 0,
      totalWorkItems,
      hasSafetyHazards,
    },
  };
}
