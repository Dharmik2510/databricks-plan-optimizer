/**
 * Mapping Metrics Service - PRODUCTION READY
 *
 * Comprehensive monitoring and metrics for code mapping operations.
 * Integrates with Prometheus for production observability.
 *
 * @production
 * @version 2.0.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { PlanCodeMapping, ExecutionStageType } from './agent-types';

export interface MappingMetrics {
    totalMappings: number;
    confirmedMappings: number;
    probableMappings: number;
    uncertainMappings: number;
    unmappedStages: number;
    averageConfidence: number;
    averageDuration: number;
    successRate: number;
}

export interface PerformanceMetrics {
    filesProcessed: number;
    averageFileProcessingTime: number;
    averageMappingTime: number;
    totalDuration: number;
    throughput: number; // files per second
}

@Injectable()
export class MappingMetricsService {
    private readonly logger = new Logger(MappingMetricsService.name);
    private readonly register: Registry;

    // Prometheus metrics
    private readonly mappingDuration: Histogram<string>;
    private readonly mappingAccuracy: Counter<string>;
    private readonly filesProcessed: Gauge<string>;
    private readonly mappingConfidence: Histogram<string>;
    private readonly stageTypeCounts: Counter<string>;
    private readonly errorCounter: Counter<string>;
    private readonly activeJobs: Gauge<string>;

    // Internal tracking
    private mappingStats: Map<string, number[]> = new Map();
    private performanceData: {
        startTime?: number;
        filesProcessed: number;
        totalMappingTime: number;
    } = {
        filesProcessed: 0,
        totalMappingTime: 0
    };

    constructor() {
        this.register = new Registry();

        // Initialize Prometheus metrics
        this.mappingDuration = new Histogram({
            name: 'code_mapping_duration_seconds',
            help: 'Duration of code mapping operations',
            labelNames: ['stage_type', 'status'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
            registers: [this.register]
        });

        this.mappingAccuracy = new Counter({
            name: 'code_mapping_accuracy_total',
            help: 'Code mapping accuracy by status',
            labelNames: ['status', 'stage_type'],
            registers: [this.register]
        });

        this.filesProcessed = new Gauge({
            name: 'files_processed_total',
            help: 'Total number of files processed',
            registers: [this.register]
        });

        this.mappingConfidence = new Histogram({
            name: 'code_mapping_confidence',
            help: 'Confidence score distribution of code mappings',
            labelNames: ['status', 'stage_type'],
            buckets: [0, 20, 40, 60, 80, 100],
            registers: [this.register]
        });

        this.stageTypeCounts = new Counter({
            name: 'stage_type_total',
            help: 'Count of stages by type',
            labelNames: ['stage_type'],
            registers: [this.register]
        });

        this.errorCounter = new Counter({
            name: 'mapping_errors_total',
            help: 'Total mapping errors',
            labelNames: ['error_type'],
            registers: [this.register]
        });

        this.activeJobs = new Gauge({
            name: 'active_mapping_jobs',
            help: 'Number of currently active mapping jobs',
            registers: [this.register]
        });

        this.logger.log('✅ Mapping metrics service initialized');
    }

    /**
     * Record a mapping operation
     */
    recordMapping(mapping: PlanCodeMapping, duration: number): void {
        try {
            const durationSeconds = duration / 1000;

            // Record duration
            this.mappingDuration
                .labels(mapping.stageType, mapping.status)
                .observe(durationSeconds);

            // Record accuracy
            this.mappingAccuracy
                .labels(mapping.status, mapping.stageType)
                .inc();

            // Record confidence
            this.mappingConfidence
                .labels(mapping.status, mapping.stageType)
                .observe(mapping.confidence);

            // Record stage type
            this.stageTypeCounts
                .labels(mapping.stageType)
                .inc();

            // Internal tracking for stats
            const key = `${mapping.stageType}_${mapping.status}`;
            if (!this.mappingStats.has(key)) {
                this.mappingStats.set(key, []);
            }
            this.mappingStats.get(key)!.push(mapping.confidence);

            // Update performance data
            this.performanceData.totalMappingTime += duration;

        } catch (error) {
            this.logger.error('Error recording mapping metrics:', error);
        }
    }

    /**
     * Record file processing
     */
    recordFileProcessed(count: number = 1): void {
        this.filesProcessed.inc(count);
        this.performanceData.filesProcessed += count;
    }

    /**
     * Record error
     */
    recordError(errorType: string): void {
        this.errorCounter.labels(errorType).inc();
    }

    /**
     * Track active job
     */
    incrementActiveJobs(): void {
        this.activeJobs.inc();
    }

    /**
     * Decrement active job
     */
    decrementActiveJobs(): void {
        this.activeJobs.dec();
    }

    /**
     * Start performance tracking
     */
    startPerformanceTracking(): void {
        this.performanceData.startTime = Date.now();
    }

    /**
     * Get comprehensive mapping metrics
     */
    getMappingMetrics(): MappingMetrics {
        let totalMappings = 0;
        let confirmedMappings = 0;
        let probableMappings = 0;
        let uncertainMappings = 0;
        let unmappedStages = 0;
        let totalConfidence = 0;

        for (const [key, confidences] of this.mappingStats.entries()) {
            const [_, status] = key.split('_');

            totalMappings += confidences.length;
            totalConfidence += confidences.reduce((sum, c) => sum + c, 0);

            if (status === 'confirmed') {
                confirmedMappings += confidences.length;
            } else if (status === 'probable') {
                probableMappings += confidences.length;
            } else if (status === 'uncertain') {
                uncertainMappings += confidences.length;
            } else if (status === 'unmapped') {
                unmappedStages += confidences.length;
            }
        }

        const averageConfidence = totalMappings > 0 ? totalConfidence / totalMappings : 0;
        const successRate = totalMappings > 0
            ? ((confirmedMappings + probableMappings) / totalMappings) * 100
            : 0;

        return {
            totalMappings,
            confirmedMappings,
            probableMappings,
            uncertainMappings,
            unmappedStages,
            averageConfidence: Math.round(averageConfidence),
            averageDuration: this.performanceData.totalMappingTime / totalMappings,
            successRate: parseFloat(successRate.toFixed(2))
        };
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        const totalDuration = this.performanceData.startTime
            ? Date.now() - this.performanceData.startTime
            : 0;

        const throughput = totalDuration > 0
            ? (this.performanceData.filesProcessed / totalDuration) * 1000
            : 0;

        return {
            filesProcessed: this.performanceData.filesProcessed,
            averageFileProcessingTime: this.performanceData.filesProcessed > 0
                ? totalDuration / this.performanceData.filesProcessed
                : 0,
            averageMappingTime: this.performanceData.totalMappingTime / this.performanceData.filesProcessed,
            totalDuration,
            throughput: parseFloat(throughput.toFixed(2))
        };
    }

    /**
     * Get Prometheus metrics (for /metrics endpoint)
     */
    async getPrometheusMetrics(): Promise<string> {
        return this.register.metrics();
    }

    /**
     * Reset all metrics
     */
    reset(): void {
        this.register.resetMetrics();
        this.mappingStats.clear();
        this.performanceData = {
            filesProcessed: 0,
            totalMappingTime: 0
        };
        this.logger.log('Metrics reset');
    }

    /**
     * Get detailed stats by stage type
     */
    getStatsByStageType(stageType: ExecutionStageType): {
        total: number;
        confirmed: number;
        probable: number;
        uncertain: number;
        unmapped: number;
        averageConfidence: number;
    } {
        const statuses = ['confirmed', 'probable', 'uncertain', 'unmapped'];
        let total = 0;
        let totalConfidence = 0;
        const counts: Record<string, number> = {
            confirmed: 0,
            probable: 0,
            uncertain: 0,
            unmapped: 0
        };

        for (const status of statuses) {
            const key = `${stageType}_${status}`;
            const confidences = this.mappingStats.get(key) || [];

            counts[status] = confidences.length;
            total += confidences.length;
            totalConfidence += confidences.reduce((sum, c) => sum + c, 0);
        }

        return {
            total,
            confirmed: counts.confirmed,
            probable: counts.probable,
            uncertain: counts.uncertain,
            unmapped: counts.unmapped,
            averageConfidence: total > 0 ? Math.round(totalConfidence / total) : 0
        };
    }
}
