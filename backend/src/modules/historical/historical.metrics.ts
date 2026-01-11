import * as client from 'prom-client';

function getOrCreateHistogram(name: string, help: string, labelNames: string[], buckets: number[]) {
  const existing = client.register.getSingleMetric(name) as client.Histogram<string> | undefined;
  if (existing) return existing;
  return new client.Histogram({ name, help, labelNames, buckets });
}

export const analysisLatencyMs = getOrCreateHistogram(
  'analysis_latency_ms',
  'Latency of historical analysis requests in milliseconds',
  ['mode', 'status'],
  [250, 500, 1000, 2000, 5000, 10000, 20000],
);
