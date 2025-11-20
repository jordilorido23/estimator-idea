import { getAnthropicClient, AI_MODELS } from '../ai';
import type { PhotoAnalysis, PlanAnalysis } from './schemas';
import { retryWithBackoff, AIError } from './retry';
import { ScopeOfWorkSchema, type ScopeOfWork } from './schemas';

/**
 * Generate a detailed scope of work from lead data and photo/plan analysis
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
  photoAnalyses?: PhotoAnalysis[];
  planAnalyses?: Array<{
    fileName: string;
    analysis: PlanAnalysis;
  }>;
}): Promise<ScopeOfWork> {
  const client = getAnthropicClient();

  // Build the photo analysis section
  const photoSection = input.photoAnalyses && input.photoAnalyses.length > 0
    ? `**Photo Analysis Results:**
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
`).join('\n')}`
    : '';

  // Build the plan analysis section
  const planSection = input.planAnalyses && input.planAnalyses.length > 0
    ? `**Construction Plan Analysis:**
${input.planAnalyses.map((plan, i) => `
Plan ${i + 1}: ${plan.fileName}
- Document Type: ${plan.analysis.documentType}
${plan.analysis.scale ? `- Scale: ${plan.analysis.scale}` : ''}
- Rooms/Spaces: ${plan.analysis.rooms.map(r => `${r.roomName} (${r.area ? r.area + ' sq ft' : 'area not specified'})`).join(', ')}
- Total Square Footage: ${plan.analysis.rooms.reduce((sum, r) => sum + (r.area || 0), 0).toFixed(0)} sq ft
- Structural Elements: ${plan.analysis.structuralElements ? `${plan.analysis.structuralElements.doors || 0} doors, ${plan.analysis.structuralElements.windows || 0} windows, ${plan.analysis.structuralElements.walls || 0} linear feet of walls` : 'Not specified'}
- Materials: ${plan.analysis.materials.join(', ')}
- Scope Items: ${plan.analysis.scopeItems.join('; ')}
- Annotations: ${plan.analysis.annotations.join('; ')}
${plan.analysis.potentialIssues.length > 0 ? `- Plan Issues: ${plan.analysis.potentialIssues.join('; ')}` : ''}
${plan.analysis.missingInformation.length > 0 ? `- Missing from Plan: ${plan.analysis.missingInformation.join('; ')}` : ''}
- Confidence: ${(plan.analysis.confidence * 100).toFixed(0)}%
- Notes: ${plan.analysis.notes}
`).join('\n')}`
    : '';

  const prompt = `You are a construction project manager creating a preliminary scope of work for a residential remodeling estimate.

**Project Information:**
- Homeowner: ${input.leadData.homeownerName}
- Address: ${input.leadData.address}
- Requested Trade Type: ${input.leadData.tradeType}
${input.leadData.budget ? `- Budget: $${input.leadData.budget}` : ''}
${input.leadData.timeline ? `- Timeline: ${input.leadData.timeline}` : ''}
${input.leadData.notes ? `- Homeowner Notes: ${input.leadData.notes}` : ''}

${photoSection}

${planSection}

Based on this information, create a comprehensive scope of work for the contractor.

**Important Guidelines:**
${input.planAnalyses && input.planAnalyses.length > 0 ? '- PRIORITIZE measurements and quantities from construction plans over photo estimates' : ''}
${input.photoAnalyses && input.photoAnalyses.length > 0 ? '- Use photo analysis for current conditions, damage assessment, and access constraints' : ''}
- Combine insights from both photos and plans for the most accurate scope
- Be specific about quantities when plans provide exact measurements
- Flag discrepancies between photos and plans

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
        timeoutMs: 60000, // Scope generation can be complex
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

    // Validate with Zod schema
    const validationResult = ScopeOfWorkSchema.safeParse(parsedData);
    if (!validationResult.success) {
      console.error('Scope generation validation failed:', {
        errors: validationResult.error.flatten(),
        rawResponse: textContent.text,
      });
      throw new AIError(
        `Invalid scope structure from Claude: ${validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        'INVALID_STRUCTURE',
        false
      );
    }

    return validationResult.data;
  } catch (error) {
    if (error instanceof AIError) {
      console.error('Scope generation failed:', {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      });
      throw error;
    }

    console.error('Scope generation error:', error);
    throw new AIError(
      `Failed to generate scope: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SCOPE_GENERATION_FAILED',
      false,
      error
    );
  }
}
