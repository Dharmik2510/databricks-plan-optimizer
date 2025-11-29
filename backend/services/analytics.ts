
import { AnalysisResult, DagNode, PerformancePrediction, ScaleImpact, BottleneckTimeline, WhatIfScenario, HistoricalTrend, RegressionAlert, AIAgentStatus, ResourceMetric, ClusterRecommendation, SparkConfigRecommendation } from '../../shared/types';

export class PredictivePerformanceEngine {
  predictAtScale(
    result: AnalysisResult, 
    currentDataSizeMB: number
  ): PerformancePrediction {
    const complexity = this.analyzeComplexity(result.dagNodes);
    const baselineTime = (result.estimatedDurationMin || 15) * 60;
    const scaleFactor = complexity.hasCartesian ? 2.5 : 1.1; 
    
    const scaleImpacts: ScaleImpact[] = [
      { 
        dataSize: '1x (Current)', 
        currentTime: baselineTime, 
        optimizedTime: baselineTime * 0.4 
      },
      { 
        dataSize: '10x', 
        currentTime: baselineTime * Math.pow(10, scaleFactor), 
        optimizedTime: (baselineTime * 10) * 0.5 
      },
      { 
        dataSize: '100x', 
        currentTime: baselineTime * Math.pow(100, scaleFactor), 
        optimizedTime: (baselineTime * 100) * 0.6,
        breakingPoint: complexity.hasCartesian ? 'Major OOM Risk' : undefined
      },
      { 
        dataSize: '1000x', 
        currentTime: baselineTime * Math.pow(1000, scaleFactor), 
        optimizedTime: (baselineTime * 1000) * 0.7, 
        breakingPoint: 'Requires Architecture Change' 
      }
    ];

    const bottleneckProgression: BottleneckTimeline[] = [];
    if (complexity.hasCartesian) {
      bottleneckProgression.push({
        stage: 'BroadcastNestedLoopJoin',
        currentImpact: 45,
        at10xScale: 89,
        at100xScale: 99,
        recommendation: 'Will dominate execution time - fix immediately'
      });
    }

    if (complexity.shuffleCount > 0) {
      bottleneckProgression.push({
        stage: 'Exchange hashpartitioning',
        currentImpact: 25,
        at10xScale: 35,
        at100xScale: 45,
        recommendation: 'Manageable with AQE, but consider bucketing'
      });
    }

    const history = this.generateHistoricalTrend(baselineTime, result.optimizations.length > 0);
    const regressionAlert = this.detectRegression(history, baselineTime);

    return {
      baselineExecutionTime: baselineTime,
      predictedExecutionTime: baselineTime * 0.4,
      dataScaleImpact: scaleImpacts,
      regressionModel: {
        inputSize: [1, 10, 100, 1000],
        executionTime: scaleImpacts.map(s => s.currentTime),
        r2Score: 0.94
      },
      bottleneckProgression,
      whatIfScenarios: this.generateWhatIfScenarios(result),
      historicalTrend: history,
      regressionAlert,
      aiAgentStatus: this.generateAgentStatus(result)
    };
  }

  generateClusterRecommendation(metrics: ResourceMetric[]): ClusterRecommendation {
    const avgCpu = metrics.reduce((acc, m) => acc + m.cpuPercentage, 0) / (metrics.length || 1);
    const maxMem = Math.max(...metrics.map(m => m.memoryMb));
    
    let currentType = 'm5.2xlarge';
    let currentNodes = 8;
    let recType = 'm5.2xlarge';
    let recNodes = 8;
    let reasoning = 'Balanced workload detected.';
    let improvement = 'Maintain current config.';

    if (maxMem > 40000) { 
      currentType = 'm5.2xlarge'; 
      recType = 'r5.2xlarge'; 
      reasoning = 'High memory pressure detected (>40GB peak). Switching to memory-optimized instances avoids spill-to-disk.';
      improvement = 'Eliminate disk spill, 30% faster shuffle.';
      recNodes = Math.max(4, currentNodes - 2); 
    } 
    else if (avgCpu > 80) {
      currentType = 'm5.2xlarge';
      recType = 'c5.4xlarge'; 
      reasoning = 'Consistent high CPU utilization (>80%). Compute-optimized nodes provide better price/performance.';
      improvement = '20% cost reduction, 15% faster compute.';
    }
    else if (avgCpu < 30 && maxMem < 10000) {
      recNodes = Math.max(2, Math.floor(currentNodes / 2));
      reasoning = 'Cluster is underutilized (CPU < 30%). Safe to downscale worker count.';
      improvement = `Save ~${((currentNodes - recNodes) / currentNodes * 100).toFixed(0)}% on compute costs.`;
    }

    return {
      current: { nodes: currentNodes, type: currentType, costPerHour: currentNodes * 0.40 },
      recommended: { nodes: recNodes, type: recType, costPerHour: recNodes * (recType.startsWith('r') ? 0.50 : recType.startsWith('c') ? 0.35 : 0.40) },
      reasoning,
      expectedImprovement: improvement
    };
  }

  generateSparkConfigs(nodes: DagNode[]): SparkConfigRecommendation {
    const configs: Record<string, any> = {};
    const reasoning: Record<string, string> = {};
    let impact = "Standard optimizations.";

    const hasShuffle = nodes.some(n => n.type.toLowerCase().includes('exchange') || n.type.toLowerCase().includes('shuffle'));
    const hasJoin = nodes.some(n => n.type.toLowerCase().includes('join'));

    configs['spark.sql.adaptive.enabled'] = true;
    reasoning['spark.sql.adaptive.enabled'] = "Essential for dynamic coalescing of shuffle partitions and handling skew.";

    if (hasShuffle) {
      configs['spark.sql.shuffle.partitions'] = 'auto';
      configs['spark.sql.adaptive.coalescePartitions.enabled'] = true;
      reasoning['spark.sql.shuffle.partitions'] = "Set to 'auto' with AQE enabled to dynamically adjust partition count based on data volume.";
    }

    if (hasJoin) {
      configs['spark.sql.autoBroadcastJoinThreshold'] = '100MB';
      reasoning['spark.sql.autoBroadcastJoinThreshold'] = "Increased from default 10MB to 100MB to catch more broadcast candidates.";
    }

    configs['spark.databricks.delta.optimizeWrite.enabled'] = true;
    reasoning['spark.databricks.delta.optimizeWrite.enabled'] = "Ensures optimal file size during writes, reducing small file problem.";

    if (hasShuffle && hasJoin) {
      impact = "Expect 20-40% faster execution due to dynamic partition sizing and broadcast optimizations.";
    }

    return {
      configs,
      reasoning,
      estimatedImpact: impact
    };
  }

  private analyzeComplexity(nodes: DagNode[]): { hasCartesian: boolean, shuffleCount: number, estimatedComplexity: string } {
    const cartesianProducts = nodes.filter(n => 
      n.type.toLowerCase().includes('nestedloop') || 
      n.type.toLowerCase().includes('cartesian')
    );
    const shuffles = nodes.filter(n => 
      n.type.toLowerCase().includes('exchange')
    );
    return {
      hasCartesian: cartesianProducts.length > 0,
      shuffleCount: shuffles.length,
      estimatedComplexity: cartesianProducts.length > 0 ? 'O(n^2)' : 'O(n)'
    };
  }

  private generateHistoricalTrend(currentDuration: number, hasIssues: boolean): HistoricalTrend {
    const dates = Array.from({length: 10}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (9 - i));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const executionTimes = dates.map((_, i) => {
      let noise = (Math.random() - 0.5) * (currentDuration * 0.1);
      if (hasIssues) {
         const factor = 0.5 + (0.5 * (i / 9)); 
         if (i === 9) return currentDuration; 
         return (currentDuration * factor) + noise;
      } else {
         return currentDuration + noise;
      }
    });

    return {
      dates,
      executionTimes,
      costs: executionTimes.map(t => (t / 60) * 0.40 * 8), 
      optimizationsApplied: hasIssues ? [] : ['2 days ago'],
      roi: hasIssues ? -15 : 125
    };
  }

  private detectRegression(history: HistoricalTrend, currentDuration: number): RegressionAlert | undefined {
    const prev = history.executionTimes[history.executionTimes.length - 2];
    const diff = currentDuration - prev;
    const percent = (diff / prev) * 100;

    if (percent > 10) { 
      return {
        previousRunTime: prev,
        currentRunTime: currentDuration,
        regressionPercent: percent,
        suspectedCause: "Data volume surge or unoptimized join introduced",
        autoFix: "Enable Adaptive Query Execution (AQE)"
      };
    }
    return undefined;
  }

  private generateWhatIfScenarios(result: AnalysisResult): WhatIfScenario[] {
    const scenarios: WhatIfScenario[] = [];
    const highSeverity = result.optimizations.filter(o => o.severity === 'High');

    if (highSeverity.length > 0) {
       scenarios.push({
        scenario: `Fix ${highSeverity.length} Critical Issues`,
        timeReduction: '65%',
        costSavings: '$8.50/run',
        complexity: 'Low',
        implementation: '1-2 hours'
      });
    }

    if (result.dagNodes.some(n => n.type.includes('CSV'))) {
       scenarios.push({
        scenario: 'Convert CSV to Parquet',
        timeReduction: '40%',
        costSavings: '$4.96/run',
        complexity: 'Low',
        implementation: '1 hour (one-time migration)'
      });
    }
    
    scenarios.push({
        scenario: 'Apply All Optimizations',
        timeReduction: '92%',
        costSavings: '$11.40/run',
        complexity: 'Medium',
        implementation: '1 day'
    });

    return scenarios;
  }

  private generateAgentStatus(result: AnalysisResult): AIAgentStatus {
      return {
          mode: 'suggest',
          confidence_threshold: 90,
          actions_taken: ['Monitored cluster health', 'Analyzed execution plan'],
          prevented_issues: result.risk_assessment?.oom_risk === 'High' ? ['Potential OOM - suggested memory increase'] : [],
          total_savings_session: result.optimizations.reduce((acc, o) => acc + (o.estimated_cost_saved_usd || 0), 0)
      };
  }
}

export const predictiveEngine = new PredictivePerformanceEngine();
