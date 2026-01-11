export interface StageSummary {
  stageId: number;
  name: string;
  durationMs: number;
  shuffleReadBytes: number;
  shuffleWriteBytes: number;
  memorySpilledBytes: number;
  diskSpilledBytes: number;
  failedTasks: number;
}

export interface SkewSuspicion {
  stageId: number;
  name: string;
  p95ToP50Ratio: number;
  medianMs: number;
  p95Ms: number;
}

export function getTopSlowStages(stages: any[], count = 3): StageSummary[] {
  const summaries = stages.map((stage) => {
    const durationMs = getStageDurationMs(stage);
    return {
      stageId: getStageId(stage),
      name: stage?.name || stage?.description || 'Stage',
      durationMs,
      shuffleReadBytes: getNumber(stage, ['shuffle_read_bytes', 'shuffleReadBytes', 'shuffleRead']) || 0,
      shuffleWriteBytes: getNumber(stage, ['shuffle_write_bytes', 'shuffleWriteBytes', 'shuffleWrite']) || 0,
      memorySpilledBytes: getNumber(stage, ['memory_bytes_spilled', 'memoryBytesSpilled']) || 0,
      diskSpilledBytes: getNumber(stage, ['disk_bytes_spilled', 'diskBytesSpilled']) || 0,
      failedTasks: getNumber(stage, ['num_failed_tasks', 'numFailedTasks']) || 0,
    };
  });

  return summaries
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, count);
}

export function getShuffleHeavyStages(stages: any[], count = 3, minBytes = 256 * 1024 * 1024): StageSummary[] {
  const summaries = stages.map((stage) => {
    const shuffleRead = getNumber(stage, ['shuffle_read_bytes', 'shuffleReadBytes', 'shuffleRead']) || 0;
    const shuffleWrite = getNumber(stage, ['shuffle_write_bytes', 'shuffleWriteBytes', 'shuffleWrite']) || 0;
    return {
      stageId: getStageId(stage),
      name: stage?.name || stage?.description || 'Stage',
      durationMs: getStageDurationMs(stage),
      shuffleReadBytes: shuffleRead,
      shuffleWriteBytes: shuffleWrite,
      memorySpilledBytes: getNumber(stage, ['memory_bytes_spilled', 'memoryBytesSpilled']) || 0,
      diskSpilledBytes: getNumber(stage, ['disk_bytes_spilled', 'diskBytesSpilled']) || 0,
      failedTasks: getNumber(stage, ['num_failed_tasks', 'numFailedTasks']) || 0,
    };
  });

  return summaries
    .filter((stage) => stage.shuffleReadBytes + stage.shuffleWriteBytes >= minBytes)
    .sort((a, b) => (b.shuffleReadBytes + b.shuffleWriteBytes) - (a.shuffleReadBytes + a.shuffleWriteBytes))
    .slice(0, count);
}

export function getSpillAnomalies(stages: any[], count = 3, minBytes = 128 * 1024 * 1024): StageSummary[] {
  const summaries = stages.map((stage) => {
    return {
      stageId: getStageId(stage),
      name: stage?.name || stage?.description || 'Stage',
      durationMs: getStageDurationMs(stage),
      shuffleReadBytes: getNumber(stage, ['shuffle_read_bytes', 'shuffleReadBytes', 'shuffleRead']) || 0,
      shuffleWriteBytes: getNumber(stage, ['shuffle_write_bytes', 'shuffleWriteBytes', 'shuffleWrite']) || 0,
      memorySpilledBytes: getNumber(stage, ['memory_bytes_spilled', 'memoryBytesSpilled']) || 0,
      diskSpilledBytes: getNumber(stage, ['disk_bytes_spilled', 'diskBytesSpilled']) || 0,
      failedTasks: getNumber(stage, ['num_failed_tasks', 'numFailedTasks']) || 0,
    };
  });

  return summaries
    .filter((stage) => stage.memorySpilledBytes + stage.diskSpilledBytes >= minBytes)
    .sort((a, b) => (b.memorySpilledBytes + b.diskSpilledBytes) - (a.memorySpilledBytes + a.diskSpilledBytes))
    .slice(0, count);
}

export function getGcAnomaly(executorSummary: any): { ratio: number; totalGcTimeMs: number } | null {
  if (!executorSummary) return null;
  const totalGcTimeMs = getNumber(executorSummary, ['total_gc_time', 'totalGcTime']) || 0;
  const totalDurationMs = getNumber(executorSummary, ['total_duration', 'totalDuration']) || 0;
  if (!totalDurationMs || !totalGcTimeMs) return null;
  const ratio = totalGcTimeMs / totalDurationMs;
  return { ratio, totalGcTimeMs };
}

export function getSkewSuspicions(stages: any[], count = 3): SkewSuspicion[] {
  const suspicions: SkewSuspicion[] = [];

  for (const stage of stages) {
    const metrics = stage?.task_metrics_distributions || stage?.taskMetricsDistributions;
    if (!metrics) continue;

    const dist = metrics?.task_duration || metrics?.executor_run_time || metrics?.executorRunTime;
    const quantiles = dist?.quantiles || dist?.quantile || dist?.quantileValues;
    if (!quantiles) continue;

    const p50 = getQuantile(quantiles, ['0.5', '0.50', '0.5', '50', 'p50']);
    const p95 = getQuantile(quantiles, ['0.95', '0.950', '95', 'p95']);

    if (!p50 || !p95) continue;

    const ratio = p95 / p50;
    if (ratio >= 3) {
      suspicions.push({
        stageId: getStageId(stage),
        name: stage?.name || stage?.description || 'Stage',
        p95ToP50Ratio: ratio,
        medianMs: p50,
        p95Ms: p95,
      });
    }
  }

  return suspicions.sort((a, b) => b.p95ToP50Ratio - a.p95ToP50Ratio).slice(0, count);
}

export function getFailedTaskSummary(jobs: any[], stages: any[]) {
  const failedTasks = stages.reduce((sum, stage) => sum + (getNumber(stage, ['num_failed_tasks', 'numFailedTasks']) || 0), 0);
  const failedStages = stages.filter((stage) => (getNumber(stage, ['num_failed_tasks', 'numFailedTasks']) || 0) > 0).length;
  const failedJobs = jobs.filter((job) => {
    const status = job?.status || job?.jobStatus;
    return status === 'FAILED' || (getNumber(job, ['num_failed_tasks', 'numFailedTasks']) || 0) > 0;
  }).length;

  return {
    failedTasks,
    failedStages,
    failedJobs,
  };
}

export function getStageDurationMs(stage: any): number {
  const start = parseDate(stage?.submission_time || stage?.submissionTime || stage?.first_task_launched_time || stage?.firstTaskLaunchedTime);
  const end = parseDate(stage?.completion_time || stage?.completionTime);
  if (start && end) {
    return end - start;
  }
  return 0;
}

export function getStageId(stage: any): number {
  return stage?.stage_id ?? stage?.stageId ?? 0;
}

function parseDate(value: any): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
}

function getNumber(obj: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === 'number') return value;
  }
  return null;
}

function getQuantile(quantiles: any, keys: string[]): number | null {
  for (const key of keys) {
    const value = quantiles?.[key];
    if (typeof value === 'number') return value;
  }
  return null;
}
