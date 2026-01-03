import apiClient from '../api/client';
import { educationCache, generateSignatureHash } from '../utils/educationCache';

// Types matching backend DTOs
export interface LearnMoreLink {
    label: string;
    url: string;
}

export interface AIInsightsResponse {
    title: string;
    explanation: string;
    whyItShowsUpHere: string | null;
    whatToCheck: string[];
    learnMore: LearnMoreLink[];
    disclaimer: string | null;
}

export interface NodeEducationInput {
    nodeId: string;
    operatorType?: string;
    nodeLabel: string;
    upstreamLabels: string[];
    downstreamLabels: string[];
    metrics?: Record<string, string | number>;
    evidenceSnippets?: string[];
    confidence?: number;
}

export interface FetchResult {
    data: AIInsightsResponse;
    fromCache: boolean;
}

/**
 * Fetch AI-powered educational insights for a DAG node.
 * Uses read-through caching to minimize API calls.
 */
export async function fetchNodeEducation(input: NodeEducationInput): Promise<FetchResult> {
    // Generate cache key
    const signatureHash = generateSignatureHash({
        operatorType: input.operatorType,
        nodeLabel: input.nodeLabel,
        upstreamLabels: input.upstreamLabels,
        downstreamLabels: input.downstreamLabels,
        metrics: input.metrics,
        evidenceSnippets: input.evidenceSnippets,
    });

    const cacheKey = `${input.nodeId}:${signatureHash}`;

    // Check cache first
    const cached = educationCache.get(cacheKey);
    if (cached) {
        return { data: cached as AIInsightsResponse, fromCache: true };
    }

    // Call backend API
    const response = await apiClient.post<AIInsightsResponse>('/education/node-insights', {
        operatorType: input.operatorType,
        nodeLabel: input.nodeLabel,
        upstreamLabels: input.upstreamLabels,
        downstreamLabels: input.downstreamLabels,
        metrics: input.metrics,
        evidenceSnippets: input.evidenceSnippets,
        confidence: input.confidence,
    });

    // Cache the result
    educationCache.set(cacheKey, response);

    return { data: response, fromCache: false };
}
