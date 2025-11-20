import { getAnthropicClient, AI_MODELS } from '../ai';
import { retryWithBackoff, AIError } from './retry';
import { PlanAnalysisSchema, type PlanAnalysis } from './schemas';

/**
 * Analyze a construction plan/document using Claude's PDF vision capability
 * @param documentUrl - Public URL of the document (PDF or image)
 * @param fileName - Name of the file for context
 * @param fileType - Type of document (PDF, IMAGE, DWG, etc.)
 * @param returnResponse - If true, returns both analysis and raw API response for usage tracking
 * @returns Structured analysis of the plan
 */
export async function analyzePlanDocument(
  documentUrl: string,
  fileName: string,
  fileType: string
): Promise<PlanAnalysis>;
export async function analyzePlanDocument(
  documentUrl: string,
  fileName: string,
  fileType: string,
  returnResponse: true
): Promise<{ analysis: PlanAnalysis; response: any }>;
export async function analyzePlanDocument(
  documentUrl: string,
  fileName: string,
  fileType: string,
  returnResponse?: boolean
): Promise<PlanAnalysis | { analysis: PlanAnalysis; response: any }> {
  const client = getAnthropicClient();

  const prompt = `You are a construction estimator analyzing architectural plans and drawings for a residential remodeling project.

**Document Information:**
- File Name: ${fileName}
- File Type: ${fileType}

Carefully examine this construction plan/drawing and extract the following information:

1. **Document Type**: What type of drawing is this? (floor plan, elevation, section, detail, etc.)
2. **Scale**: What is the drawing scale if indicated? (e.g., "1/4\" = 1'0\"")
3. **Room Dimensions**: For each room/space:
   - Room name
   - Length and width (if visible)
   - Area in square feet
   - Height/ceiling height if indicated
   - Confidence level (low/medium/high) for each measurement
4. **Quantities**: Count and measure:
   - Doors (count and types)
   - Windows (count and types)
   - Walls (linear feet if measurable)
   - Stairs/steps
   - Other significant elements
5. **Materials**: What materials are specified or indicated?
   - Flooring materials
   - Wall finishes
   - Ceiling materials
   - Trim/millwork
   - Fixtures
6. **Annotations**: Any text notes, callouts, or specifications on the plan
7. **Scope Items**: Based on the plan, what work needs to be done?
8. **Potential Issues**: Flag any concerns:
   - Unclear dimensions
   - Missing information
   - Design elements that may be expensive or complex
   - Code compliance concerns (if evident)
9. **Missing Information**: What information would you need for an accurate estimate?
10. **Overall Confidence**: How confident are you in this analysis? (0.0 to 1.0)
11. **Notes**: Any other relevant observations for the contractor

**Important**:
- If dimensions are shown with specific measurements, use those exact values
- If you need to estimate dimensions based on scale, note the confidence as "low" or "medium"
- For residential remodeling, focus on scope that matters for estimates (demo, framing, finishes, fixtures)
- Be conservative with measurements when uncertain

Respond ONLY with valid JSON matching this structure:
{
  "documentType": "floor_plan" | "elevation" | "section" | "detail" | "site_plan" | "other",
  "scale": "optional string",
  "rooms": [
    {
      "roomName": "string",
      "length": 12.5,
      "width": 10.0,
      "height": 8.0,
      "area": 125.0,
      "unit": "feet",
      "confidence": "low" | "medium" | "high",
      "notes": "optional string"
    }
  ],
  "quantities": [
    {
      "item": "string",
      "quantity": 5,
      "unit": "each" | "linear feet" | "square feet",
      "category": "doors" | "windows" | "walls" | "other",
      "notes": "optional string"
    }
  ],
  "structuralElements": {
    "walls": 45,
    "doors": 8,
    "windows": 12,
    "stairs": 1
  },
  "materials": ["string"],
  "annotations": ["string"],
  "scopeItems": ["string"],
  "potentialIssues": ["string"],
  "missingInformation": ["string"],
  "confidence": 0.85,
  "notes": "string"
}`;

  try {
    // PDF analysis can take longer, so use 90s timeout
    const response = await retryWithBackoff(
      () =>
        client.messages.create({
          model: AI_MODELS.SONNET,
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'url',
                    url: documentUrl,
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
        timeoutMs: 90000, // 90 seconds for PDF processing
        initialDelayMs: 2000,
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

    const parsedJSON = JSON.parse(jsonMatch[0]);

    // Validate response structure
    const validationResult = PlanAnalysisSchema.safeParse(parsedJSON);
    if (!validationResult.success) {
      throw new AIError(
        `Invalid plan analysis structure from Claude: ${JSON.stringify(validationResult.error.flatten())}`,
        'INVALID_SCHEMA',
        false
      );
    }

    if (returnResponse) {
      return {
        analysis: validationResult.data,
        response,
      };
    }

    return validationResult.data;
  } catch (error) {
    if (error instanceof AIError) {
      throw error;
    }
    throw new AIError(
      `Failed to analyze plan document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'ANALYSIS_ERROR',
      true // Retryable
    );
  }
}

/**
 * Analyze multiple plan documents in parallel
 * @param documents - Array of document info to analyze
 * @returns Array of plan analyses
 */
export async function analyzeMultiplePlans(
  documents: Array<{
    url: string;
    fileName: string;
    fileType: string;
    documentId: string;
  }>
): Promise<
  Array<{
    documentId: string;
    fileName: string;
    analysis: PlanAnalysis;
    response?: any;
  }>
> {
  const analyses = await Promise.all(
    documents.map(async (doc) => {
      const result = await analyzePlanDocument(doc.url, doc.fileName, doc.fileType, true);
      return {
        documentId: doc.documentId,
        fileName: doc.fileName,
        analysis: result.analysis,
        response: result.response,
      };
    })
  );

  return analyses;
}
