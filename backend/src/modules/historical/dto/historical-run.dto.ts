export interface HistoricalRunSummary {
  appId: string;
  appName: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMs?: number | null;
  completed?: boolean;
}
