import { getAnthropicClient, AI_MODELS } from '../ai';

export type TakeoffReviewAnalysis = {
  overallAccuracy: number; // 0-100 score
  feedback: {
    category: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    suggestion: string;
  }[];
  strengths: string[];
  areasForImprovement: string[];
  summary: string;
};

/**
 * Analyze a takeoff for accuracy and completeness using AI
 */
export async function analyzeTakeoffAccuracy(input: {
  takeoffData: any; // The takeoff data from the database
  photos?: Array<{ url: string; description?: string }>;
  tradeType: string;
  actualOutcome?: {
    actualCost?: number;
    estimatedTotal?: number;
    variance?: number;
    feedbackNotes?: string;
  };
}): Promise<TakeoffReviewAnalysis> {
  const client = getAnthropicClient();

  // Build context about the takeoff
  const scopeOfWork = input.takeoffData?.scopeOfWork;
  const lineItems = scopeOfWork?.lineItems || [];

  // Build the prompt with context
  let prompt = `You are an experienced construction estimator reviewing a takeoff for accuracy and completeness.

**Trade Type:** ${input.tradeType}

**Scope of Work Summary:**
${scopeOfWork?.summary || 'Not provided'}

**Line Items Identified:**
${lineItems.map((item: any, i: number) => `${i + 1}. ${item.category}: ${item.description}${item.notes ? ` (${item.notes})` : ''}`).join('\n')}

**Assumptions Made:**
${scopeOfWork?.assumptions?.join('\n') || 'None listed'}

**Exclusions:**
${scopeOfWork?.exclusions?.join('\n') || 'None listed'}
`;

  // Add actual outcome data if available
  if (input.actualOutcome) {
    prompt += `\n**Actual Project Outcome:**`;
    if (input.actualOutcome.estimatedTotal && input.actualOutcome.actualCost) {
      prompt += `
- Estimated Total: $${input.actualOutcome.estimatedTotal.toLocaleString()}
- Actual Cost: $${input.actualOutcome.actualCost.toLocaleString()}
- Variance: ${input.actualOutcome.variance !== undefined ? `$${input.actualOutcome.variance.toLocaleString()}` : 'N/A'}`;
    }
    if (input.actualOutcome.feedbackNotes) {
      prompt += `\n- Feedback Notes: ${input.actualOutcome.feedbackNotes}`;
    }
  }

  prompt += `

**Your Task:**
Analyze this takeoff for accuracy, completeness, and quality. Provide:

1. **Overall Accuracy Score** (0-100): Based on completeness, detail level, and realistic assumptions
2. **Feedback Items**: Specific issues found, categorized by area (e.g., "Measurements", "Materials", "Labor", "Scope")
   - For each issue: describe it, rate severity (low/medium/high), and provide a suggestion
3. **Strengths**: What was done well in this takeoff
4. **Areas for Improvement**: General recommendations for better accuracy
5. **Summary**: Brief overall assessment

**Evaluation Criteria:**
- Are measurements and quantities realistic?
- Are all necessary materials and labor items included?
- Are the assumptions reasonable?
- Are there obvious gaps or missing items?
- Is the scope clearly defined?
${input.actualOutcome ? '- How does the estimate compare to actual costs?' : ''}

Respond ONLY with valid JSON:
{
  "overallAccuracy": number (0-100),
  "feedback": [
    {
      "category": "string (e.g., Measurements, Materials, Labor, Scope)",
      "issue": "string (describe the issue)",
      "severity": "low" | "medium" | "high",
      "suggestion": "string (actionable improvement)"
    }
  ],
  "strengths": ["string"],
  "areasForImprovement": ["string"],
  "summary": "string (2-3 sentences)"
}`;

  try {
    // Build messages array with text content
    const messages: Array<{
      role: 'user';
      content: Array<{ type: string; text?: string; source?: any }>;
    }> = [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      },
    ];

    // Add photos if available (up to 5 for context)
    if (input.photos && input.photos.length > 0) {
      const photoMessages = input.photos.slice(0, 5).map((photo) => ({
        type: 'text',
        text: `[Photo ${photo.description ? `- ${photo.description}` : 'from project'}]`,
      }));

      messages[0].content.push(...photoMessages);
    }

    const response = await client.messages.create({
      model: AI_MODELS.SONNET,
      max_tokens: 4096,
      messages: messages as any,
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

    const analysis = JSON.parse(jsonMatch[0]) as TakeoffReviewAnalysis;

    // Validate the response structure
    if (
      typeof analysis.overallAccuracy !== 'number' ||
      !Array.isArray(analysis.feedback) ||
      !Array.isArray(analysis.strengths) ||
      !Array.isArray(analysis.areasForImprovement) ||
      typeof analysis.summary !== 'string'
    ) {
      throw new Error('Invalid response structure from AI');
    }

    return analysis;
  } catch (error) {
    console.error('Takeoff review analysis error:', error);
    throw new Error(
      `Failed to analyze takeoff: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate improvement suggestions based on multiple takeoffs
 */
export async function generateImprovementSuggestions(input: {
  takeoffReviews: Array<{
    overallAccuracy: number;
    feedback: TakeoffReviewAnalysis['feedback'];
    variance?: number;
    variancePercent?: number;
  }>;
  tradeType: string;
}): Promise<{
  commonIssues: Array<{ issue: string; frequency: number; suggestion: string }>;
  overallTrend: string;
  recommendations: string[];
}> {
  const client = getAnthropicClient();

  const prompt = `You are analyzing patterns across multiple construction takeoffs to identify improvement opportunities.

**Trade Type:** ${input.tradeType}

**Review History:**
${input.takeoffReviews
  .map(
    (review, i) => `
Review ${i + 1}:
- Accuracy Score: ${review.overallAccuracy}/100
${review.variance !== undefined ? `- Variance: $${review.variance.toLocaleString()} (${review.variancePercent?.toFixed(1)}%)` : ''}
- Issues Found: ${review.feedback.length}
  ${review.feedback.map((f) => `  - ${f.category}: ${f.issue}`).join('\n  ')}
`
  )
  .join('\n')}

**Your Task:**
Analyze these reviews to identify:
1. **Common Issues**: Patterns that appear across multiple takeoffs (with frequency count)
2. **Overall Trend**: Is accuracy improving, declining, or stable?
3. **Recommendations**: Specific, actionable steps to improve future takeoffs

Respond ONLY with valid JSON:
{
  "commonIssues": [
    {
      "issue": "string (pattern description)",
      "frequency": number (how many takeoffs had this),
      "suggestion": "string (how to fix it)"
    }
  ],
  "overallTrend": "string (2-3 sentences about the trend)",
  "recommendations": ["string (specific actionable recommendation)"]
}`;

  try {
    const response = await client.messages.create({
      model: AI_MODELS.SONNET,
      max_tokens: 2048,
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

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Improvement suggestions error:', error);
    throw new Error(
      `Failed to generate suggestions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
