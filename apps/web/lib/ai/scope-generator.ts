import { getAnthropicClient, AI_MODELS } from '../ai';
import type { PhotoAnalysis } from './photo-analyzer';

export type ScopeOfWork = {
  summary: string;
  lineItems: Array<{
    category: string;
    description: string;
    notes?: string;
  }>;
  potentialIssues: string[];
  missingInformation: string[];
  recommendations: string[];
};

/**
 * Generate a detailed scope of work from lead data and photo analysis
 */
export async function generateScopeOfWork(input: {
  leadData: {
    homeownerName: string;
    address: string;
    tradeType: string;
    budget?: number;
    timeline?: string;
    notes?: string;
  };
  photoAnalyses: PhotoAnalysis[];
}): Promise<ScopeOfWork> {
  const client = getAnthropicClient();

  const prompt = `You are a construction project manager creating a preliminary scope of work for an estimate.

**Project Information:**
- Homeowner: ${input.leadData.homeownerName}
- Address: ${input.leadData.address}
- Requested Trade Type: ${input.leadData.tradeType}
${input.leadData.budget ? `- Budget: $${input.leadData.budget}` : ''}
${input.leadData.timeline ? `- Timeline: ${input.leadData.timeline}` : ''}
${input.leadData.notes ? `- Homeowner Notes: ${input.leadData.notes}` : ''}

**Photo Analysis Results:**
${input.photoAnalyses.map((analysis, i) => `
Photo ${i + 1}:
- Trades: ${analysis.tradeType.join(', ')}
- Conditions: ${analysis.conditions.join(', ')}
- Materials: ${analysis.materials.join(', ')}
${analysis.dimensions ? `- Dimensions: ${analysis.dimensions.approximate} (confidence: ${analysis.dimensions.confidence})` : ''}
${analysis.damage ? `- Damage: ${analysis.damage.severity} - ${analysis.damage.description}` : ''}
- Access Constraints: ${analysis.accessConstraints.join(', ') || 'None noted'}
- Work Items: ${analysis.workItems.join('; ')}
${analysis.safetyHazards?.length ? `- Safety Hazards: ${analysis.safetyHazards.join(', ')}` : ''}
- Notes: ${analysis.notes}
`).join('\n')}

Based on this information, create a comprehensive scope of work for the contractor.

**Your task:**
1. Write a brief summary (2-3 sentences) of the project
2. Create detailed line items organized by category (e.g., Demolition, Installation, Finishing)
3. Identify potential issues or complications
4. Flag any missing information that would be needed for an accurate estimate
5. Provide recommendations for the contractor

Respond ONLY with valid JSON:
{
  "summary": "string",
  "lineItems": [
    {
      "category": "string",
      "description": "string",
      "notes": "optional string"
    }
  ],
  "potentialIssues": ["string"],
  "missingInformation": ["string"],
  "recommendations": ["string"]
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

    const scope = JSON.parse(jsonMatch[0]) as ScopeOfWork;

    // Validate structure
    if (!scope.summary || !Array.isArray(scope.lineItems)) {
      throw new Error('Invalid scope structure from Claude');
    }

    return scope;
  } catch (error) {
    console.error('Scope generation error:', error);
    throw new Error(`Failed to generate scope: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
