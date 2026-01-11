import * as client from 'prom-client';

function getOrCreateHistogram(name: string, help: string, labelNames: string[], buckets: number[]) {
  const existing = client.register.getSingleMetric(name) as client.Histogram<string> | undefined;
  if (existing) return existing;
  return new client.Histogram({ name, help, labelNames, buckets });
}

function getOrCreateCounter(name: string, help: string, labelNames: string[]) {
  const existing = client.register.getSingleMetric(name) as client.Counter<string> | undefined;
  if (existing) return existing;
  return new client.Counter({ name, help, labelNames });
}

export const mcpCallLatencyMs = getOrCreateHistogram(
  'mcp_call_latency_ms',
  'Latency of MCP tool calls in milliseconds',
  ['tool', 'status'],
  [50, 100, 250, 500, 1000, 2000, 5000, 10000],
);

export const mcpErrorsTotal = getOrCreateCounter(
  'mcp_errors_total',
  'Total MCP errors',
  ['tool', 'code'],
);
