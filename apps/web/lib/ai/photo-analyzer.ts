import { getAnthropicClient, AI_MODELS } from '../ai';

/**
 * Result of analyzing a single construction photo
 */
export type PhotoAnalysis = {
  tradeType: string[];
  conditions: string[];
  dimensions?: {
    approximate: string;
    confidence: 'low' | 'medium' | 'high';
  };
  materials: string[];
  damage?: {
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
  };
  accessConstraints: string[];
  workItems: string[];
  safetyHazards?: string[];
  confidence: number; // 0-1 score
  notes: string;
};

/**
 * Analyze a construction photo using Claude Vision
 * @param imageUrl - Public URL of the image to analyze
 * @returns Structured analysis of the photo
 */
export async function analyzeConstructionPhoto(
  imageUrl: string
): Promise<PhotoAnalysis> {
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
    const response = await client.messages.create({
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
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]) as PhotoAnalysis;

    // Validate required fields
    if (!analysis.tradeType || !analysis.workItems || analysis.confidence === undefined) {
      throw new Error('Invalid analysis structure from Claude');
    }

    return analysis;
  } catch (error) {
    console.error('Photo analysis error:', error);
    throw new Error(`Failed to analyze photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
