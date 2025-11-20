'use client';

import { useState, useEffect } from 'react';
import { Button, Card, Badge } from '@scopeguard/ui';
import type { TakeoffReviewAnalysis } from '@/lib/ai/review-analyzer';

interface AIReviewPanelProps {
  takeoffId: string;
}

interface ReviewData {
  hasReview: boolean;
  reviewedAt: string | null;
  overallAccuracy: number | null;
  feedback: TakeoffReviewAnalysis['feedback'] | null;
  summary: string | null;
}

export function AIReviewPanel({ takeoffId }: AIReviewPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  // Fetch existing review on mount
  useEffect(() => {
    fetchReview();
  }, [takeoffId]);

  const fetchReview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/takeoffs/${takeoffId}/review`);

      if (!response.ok) {
        throw new Error('Failed to fetch review');
      }

      const result = await response.json();
      setReviewData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review');
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`/api/takeoffs/${takeoffId}/review`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze takeoff');
      }

      const result = await response.json();

      // Update review data with new analysis
      setReviewData({
        hasReview: true,
        reviewedAt: new Date().toISOString(),
        overallAccuracy: result.data.analysis.overallAccuracy,
        feedback: result.data.analysis.feedback,
        summary: result.data.analysis.summary,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAccuracyColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          Loading review data...
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">AI Takeoff Review</h3>
            <p className="text-sm text-muted-foreground">
              Get AI-powered feedback on this takeoff's accuracy
            </p>
          </div>
          <Button
            onClick={runAnalysis}
            disabled={isAnalyzing}
            variant={reviewData?.hasReview ? 'outline' : 'default'}
          >
            {isAnalyzing
              ? 'Analyzing...'
              : reviewData?.hasReview
                ? 'Re-analyze'
                : 'Run AI Review'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {reviewData?.hasReview && (
          <>
            {/* Overall Score */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Accuracy Score
                </p>
                <p
                  className={`text-4xl font-bold ${getAccuracyColor(reviewData.overallAccuracy || 0)}`}
                >
                  {reviewData.overallAccuracy}/100
                </p>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Last Reviewed
                </p>
                <p className="text-sm">
                  {reviewData.reviewedAt
                    ? new Date(reviewData.reviewedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not reviewed'}
                </p>
              </div>
            </div>

            {/* Summary */}
            {reviewData.summary && (
              <div className="rounded-lg border bg-card p-4">
                <h4 className="text-sm font-semibold mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">{reviewData.summary}</p>
              </div>
            )}

            {/* Feedback Items */}
            {reviewData.feedback && reviewData.feedback.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Feedback & Suggestions</h4>
                <div className="space-y-3">
                  {reviewData.feedback.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-lg border bg-card p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {item.category}
                            </Badge>
                            <span
                              className={`text-xs px-2 py-0.5 rounded border ${getSeverityColor(item.severity)}`}
                            >
                              {item.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm font-medium">{item.issue}</p>
                        </div>
                      </div>
                      <div className="pl-4 border-l-2 border-blue-200">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-blue-600">Suggestion:</span>{' '}
                          {item.suggestion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviewData.feedback && reviewData.feedback.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No issues found - excellent work!</p>
              </div>
            )}
          </>
        )}

        {!reviewData?.hasReview && !isAnalyzing && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm mb-4">
              No AI review yet. Click the button above to analyze this takeoff.
            </p>
            <p className="text-xs">
              The AI will review measurements, materials, scope, and provide
              improvement suggestions.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
