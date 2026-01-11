import {
  getFailedTaskSummary,
  getGcAnomaly,
  getShuffleHeavyStages,
  getSkewSuspicions,
  getSpillAnomalies,
  getTopSlowStages,
} from './historical.heuristics';

describe('historical heuristics', () => {
  it('orders slow stages by duration', () => {
    const stages = [
      {
        stage_id: 1,
        name: 'Stage A',
        submission_time: '2024-01-01T00:00:00Z',
        completion_time: '2024-01-01T00:00:05Z',
      },
      {
        stage_id: 2,
        name: 'Stage B',
        submission_time: '2024-01-01T00:00:00Z',
        completion_time: '2024-01-01T00:00:15Z',
      },
    ];

    const result = getTopSlowStages(stages, 1);
    expect(result[0].stageId).toBe(2);
    expect(result[0].durationMs).toBeGreaterThan(0);
  });

  it('detects shuffle heavy and spill anomalies', () => {
    const stages = [
      {
        stage_id: 3,
        name: 'Shuffle Stage',
        submission_time: '2024-01-01T00:00:00Z',
        completion_time: '2024-01-01T00:00:10Z',
        shuffle_read_bytes: 512 * 1024 * 1024,
        shuffle_write_bytes: 128 * 1024 * 1024,
        memory_bytes_spilled: 256 * 1024 * 1024,
        disk_bytes_spilled: 64 * 1024 * 1024,
      },
    ];

    const shuffleHeavy = getShuffleHeavyStages(stages, 1);
    expect(shuffleHeavy).toHaveLength(1);

    const spill = getSpillAnomalies(stages, 1);
    expect(spill).toHaveLength(1);
  });

  it('flags GC anomaly when GC time is significant', () => {
    const anomaly = getGcAnomaly({ total_gc_time: 5000, total_duration: 20000 });
    expect(anomaly?.ratio).toBeCloseTo(0.25);
  });

  it('detects skew suspicions using quantiles', () => {
    const stages = [
      {
        stage_id: 4,
        name: 'Skewed Stage',
        task_metrics_distributions: {
          task_duration: {
            quantiles: {
              '0.5': 1000,
              '0.95': 4000,
            },
          },
        },
      },
    ];

    const skew = getSkewSuspicions(stages, 1);
    expect(skew).toHaveLength(1);
    expect(skew[0].p95ToP50Ratio).toBeGreaterThanOrEqual(3);
  });

  it('summarizes failed tasks across jobs and stages', () => {
    const jobs = [{ status: 'FAILED', num_failed_tasks: 2 }];
    const stages = [{ num_failed_tasks: 1 }, { num_failed_tasks: 0 }];

    const summary = getFailedTaskSummary(jobs, stages);
    expect(summary.failedTasks).toBe(1);
    expect(summary.failedStages).toBe(1);
    expect(summary.failedJobs).toBe(1);
  });
});
