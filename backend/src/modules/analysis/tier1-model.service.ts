import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedEventLog, StageMetrics } from './event-log.parser';

export interface TimeSavings {
    estimatedSecondsSaved: number | null;
    estimatedPercentSaved: number | null;
    estimateBasis: 'measured_baseline' | null;
    confidence: number | null;
    evidenceStageIds: number[];
}

export interface Optimization {
    title: string;
    description: string;
    impactLevel: string;
    affectedStageIds?: string[];
    timeSavings?: TimeSavings;
}

interface Tier1Config {
    bottleneckRules: {
        dominantStagePercent: number;
        dominantStageMinSeconds: number;
        shuffleHeavyBytesThreshold: number;
        spillHeavyDiskBytesThreshold: number;
        spillHeavyMemoryBytesThreshold: number;
        skewMinTasks: number;
        skewRatioThreshold: number;
        skewP95MinMs: number;
    };
    savingsModel: {
        stageSelection: {
            preferDominantStagesFirst: boolean;
            maxEvidenceStagesPerOptimization: number;
        };
        reductionFactors: {
            [key: string]: { min: number; max: number };
        };
        caps: {
            maxPerStagePercent: number;
            maxOverallPercent: number;
        };
        confidence: {
            measuredBaselineBoost: number;
            approxBaselinePenalty: number;
            perEvidenceStageBoost: number;
            maxConfidence: number;
            minConfidenceWhenQuantified: number;
        };
    };
    keywordMapping: {
        [key: string]: string[];
    };
}

@Injectable()
export class Tier1ModelService {
    private readonly logger = new Logger(Tier1ModelService.name);
    private config: Tier1Config;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'config', 'tier1-thresholds.json');
            const configFile = fs.readFileSync(configPath, 'utf8');
            this.config = JSON.parse(configFile);
            console.log('[Tier1ModelService] Config loaded successfully');
        } catch (error) {
            console.error('[Tier1ModelService] Failed to load tier1-thresholds.json, using defaults:', error.message);
            this.config = this.getDefaultConfig();
        }
    }

    private getDefaultConfig(): Tier1Config {
        return {
            bottleneckRules: {
                dominantStagePercent: 0.3, dominantStageMinSeconds: 60,
                shuffleHeavyBytesThreshold: 268435456, spillHeavyDiskBytesThreshold: 104857600,
                spillHeavyMemoryBytesThreshold: 268435456, skewMinTasks: 10,
                skewRatioThreshold: 5, skewP95MinMs: 10000
            },
            savingsModel: {
                stageSelection: { preferDominantStagesFirst: true, maxEvidenceStagesPerOptimization: 5 },
                reductionFactors: { shuffle: { min: 0.1, max: 0.35 }, spill: { min: 0.1, max: 0.30 }, skew: { min: 0.15, max: 0.40 }, scan: { min: 0.05, max: 0.25 } },
                caps: { maxPerStagePercent: 0.5, maxOverallPercent: 0.6 },
                confidence: { measuredBaselineBoost: 15, approxBaselinePenalty: 15, perEvidenceStageBoost: 8, maxConfidence: 90, minConfidenceWhenQuantified: 40 }
            },
            keywordMapping: {}
        } as any;
    }

    calculateTimeSavings(
        baseline: ParsedEventLog,
        optimizations: Optimization[],
        baselineConfidence: 'measured' | 'approximate' | 'insufficient'
    ): Optimization[] {
        if (baselineConfidence === 'insufficient' || !baseline.totalRuntimeSeconds) {
            // Tier 0 fallback - strip any savings
            return optimizations.map(opt => ({
                ...opt,
                timeSavings: this.getNullSavings()
            }));
        }

        const classifiedStages = this.classifyStages(baseline.stages, baseline.totalRuntimeSeconds);
        let totalEstimatedSavings = 0;

        const processedOptimizations = optimizations.map(opt => {
            const driverType = this.mapOptimizationToDriver(opt);

            if (!driverType) {
                return {
                    ...opt,
                    timeSavings: this.getNullSavings() // Cannot model confidently
                };
            }

            // Select evidence stages
            const evidenceStages = this.selectEvidenceStages(classifiedStages, driverType);

            if (evidenceStages.length === 0) {
                return {
                    ...opt,
                    timeSavings: this.getNullSavings() // No evidence found in runtime data
                };
            }

            // Calculate savings
            const savings = this.computeSavingsForOptimization(
                evidenceStages,
                driverType,
                baselineConfidence,
                baseline.totalRuntimeSeconds
            );

            if (savings.estimatedSecondsSaved) {
                totalEstimatedSavings += savings.estimatedSecondsSaved;
            }

            return {
                ...opt,
                timeSavings: savings
            };
        });

        // Apply global cap (defense in depth against over-promising)
        const maxTotalSavings = baseline.totalRuntimeSeconds * this.config.savingsModel.caps.maxOverallPercent;

        if (totalEstimatedSavings > maxTotalSavings) {
            const scaleFactor = maxTotalSavings / totalEstimatedSavings;
            processedOptimizations.forEach(opt => {
                if (opt.timeSavings && opt.timeSavings.estimatedSecondsSaved) {
                    opt.timeSavings.estimatedSecondsSaved *= scaleFactor;
                    opt.timeSavings.estimatedPercentSaved = opt.timeSavings.estimatedSecondsSaved / baseline.totalRuntimeSeconds;
                }
            });
        }

        return processedOptimizations;
    }

    private getNullSavings(): TimeSavings {
        return {
            estimatedSecondsSaved: null,
            estimatedPercentSaved: null,
            estimateBasis: null,
            confidence: null,
            evidenceStageIds: []
        };
    }

    private classifyStages(stages: StageMetrics[], totalRuntime: number): any[] {
        return stages.map(stage => {
            const isDominant = (stage.durationSeconds / totalRuntime) >= this.config.bottleneckRules.dominantStagePercent &&
                stage.durationSeconds >= this.config.bottleneckRules.dominantStageMinSeconds;

            const isShuffleHeavy = (stage.shuffleReadBytes + stage.shuffleWriteBytes) >= this.config.bottleneckRules.shuffleHeavyBytesThreshold;

            const isSpillHeavy = stage.diskBytesSpilled > this.config.bottleneckRules.spillHeavyDiskBytesThreshold ||
                stage.memoryBytesSpilled > this.config.bottleneckRules.spillHeavyMemoryBytesThreshold;

            // Skew calculation
            let isSkewed = false;
            if (stage.taskDurations && stage.taskDurations.length >= this.config.bottleneckRules.skewMinTasks) {
                const sorted = [...stage.taskDurations].sort((a, b) => a - b);
                const p95 = sorted[Math.floor(sorted.length * 0.95)];
                const median = sorted[Math.floor(sorted.length * 0.5)];
                const skewRatio = median > 0 ? p95 / median : 0;

                isSkewed = skewRatio >= this.config.bottleneckRules.skewRatioThreshold &&
                    p95 >= this.config.bottleneckRules.skewP95MinMs;
            }

            return {
                ...stage,
                flags: {
                    dominant: isDominant,
                    shuffle: isShuffleHeavy,
                    spill: isSpillHeavy,
                    skew: isSkewed,
                    scan: false
                }
            };
        });
    }

    private mapOptimizationToDriver(opt: Optimization): string | null {
        const text = (opt.title + ' ' + opt.description).toLowerCase();

        for (const [driver, keywords] of Object.entries(this.config.keywordMapping)) {
            if (keywords.some(k => text.includes(k))) {
                return driver;
            }
        }
        return null;
    }

    private selectEvidenceStages(stages: any[], driverType: string): any[] {
        const matching = stages.filter(s => s.flags[driverType] === true || (driverType === 'scan' && s.flags.dominant));

        return matching.sort((a, b) => {
            if (a.flags.dominant && !b.flags.dominant) return -1;
            if (!a.flags.dominant && b.flags.dominant) return 1;
            return b.durationSeconds - a.durationSeconds;
        }).slice(0, this.config.savingsModel.stageSelection.maxEvidenceStagesPerOptimization);
    }

    private computeSavingsForOptimization(
        evidenceStages: any[],
        driverType: string,
        baselineConfidence: 'measured' | 'approximate',
        totalRuntime: number
    ): TimeSavings {
        const factors = this.config.savingsModel.reductionFactors[driverType];
        if (!factors) return this.getNullSavings();

        const factor = baselineConfidence === 'measured'
            ? (factors.min + factors.max) / 2
            : factors.min;

        let totalSecondsSaved = 0;
        const evidenceIds = [];

        for (const stage of evidenceStages) {
            const maxStageSaved = stage.durationSeconds * this.config.savingsModel.caps.maxPerStagePercent;
            const savings = Math.min(stage.durationSeconds * factor, maxStageSaved);
            totalSecondsSaved += savings;
            evidenceIds.push(stage.stageId);
        }

        let confidenceScore = 50;
        if (baselineConfidence === 'measured') confidenceScore += this.config.savingsModel.confidence.measuredBaselineBoost;
        else confidenceScore -= this.config.savingsModel.confidence.approxBaselinePenalty;

        confidenceScore += (evidenceIds.length * this.config.savingsModel.confidence.perEvidenceStageBoost);
        confidenceScore = Math.min(confidenceScore, this.config.savingsModel.confidence.maxConfidence);

        if (confidenceScore < this.config.savingsModel.confidence.minConfidenceWhenQuantified) {
            return this.getNullSavings();
        }

        return {
            estimatedSecondsSaved: totalSecondsSaved,
            estimatedPercentSaved: totalSecondsSaved / totalRuntime,
            estimateBasis: 'measured_baseline',
            confidence: Math.round(confidenceScore),
            evidenceStageIds: evidenceIds
        };
    }
}
