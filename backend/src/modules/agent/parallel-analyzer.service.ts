/**
 * Parallel Analyzer Service - PRODUCTION READY
 *
 * Processes files in parallel using p-limit for controlled concurrency.
 * Optimized for performance with batching, chunking, and progress tracking.
 *
 * @production
 * @version 2.0.0
 */

import { Injectable, Logger } from '@nestjs/common';
import pLimit from 'p-limit';
import * as os from 'os';
import { AnalyzedFile, AgentLog } from './agent-types';
import { ASTParserService } from './ast-parser.service';

export interface AnalysisConfig {
    maxConcurrency?: number; // Default: CPU count
    chunkSize?: number;  // Files per chunk (default: 50)
    timeout?: number; // Timeout per file in ms (default: 30000)
    skipOnError?: boolean; // Continue on individual file errors (default: true)
}

export interface AnalysisProgress {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    percentage: number;
    currentFile?: string;
    estimatedTimeRemaining?: number; // seconds
}

export interface AnalysisResult {
    analyzedFiles: AnalyzedFile[];
    stats: AnalysisStats;
    errors: AnalysisError[];
}

export interface AnalysisStats {
    totalFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalDataOperations: number;
    processingTime: number; // milliseconds
    throughput: number; // files per second
}

export interface AnalysisError {
    filePath: string;
    error: string;
    timestamp: Date;
}

@Injectable()
export class ParallelAnalyzerService {
    private readonly logger = new Logger(ParallelAnalyzerService.name);
    private readonly defaultConcurrency = Math.max(2, os.cpus().length - 1); // Leave 1 CPU free
    private astParser: ASTParserService;
    private onProgressCallback?: (progress: AnalysisProgress) => void;

    constructor() {
        this.astParser = new ASTParserService();
    }

    /**
     * Set progress callback for real-time updates
     */
    setProgressCallback(callback: (progress: AnalysisProgress) => void): void {
        this.onProgressCallback = callback;
    }

    /**
     * Analyze files in parallel with controlled concurrency - PRODUCTION READY
     */
    async analyzeFilesInParallel(
        files: Array<{ path: string; content: string; language: any }>,
        config: AnalysisConfig = {}
    ): Promise<AnalysisResult> {
        const startTime = Date.now();
        const concurrency = config.maxConcurrency || this.defaultConcurrency;
        const chunkSize = config.chunkSize || 50;
        const timeout = config.timeout || 30000;
        const skipOnError = config.skipOnError !== false; // Default true

        this.logger.log(
            `🚀 Starting parallel analysis: ${files.length} files, ` +
            `concurrency: ${concurrency}, chunk size: ${chunkSize}`
        );

        const analyzedFiles: AnalyzedFile[] = [];
        const errors: AnalysisError[] = [];
        let successful = 0;
        let failed = 0;

        try {
            // Create rate limiter
            const limit = pLimit(concurrency);

            // Track progress
            const progress: AnalysisProgress = {
                total: files.length,
                processed: 0,
                successful: 0,
                failed: 0,
                percentage: 0
            };

            // Process files with concurrency limit
            const promises = files.map((file, index) =>
                limit(async () => {
                    try {
                        const result = await this.analyzeFileWithTimeout(file, timeout);

                        if (result) {
                            analyzedFiles.push(result);
                            successful++;
                            progress.successful++;
                        } else {
                            failed++;
                            progress.failed++;
                            errors.push({
                                filePath: file.path,
                                error: 'Analysis returned null',
                                timestamp: new Date()
                            });
                        }

                    } catch (error) {
                        failed++;
                        progress.failed++;
                        errors.push({
                            filePath: file.path,
                            error: error instanceof Error ? error.message : String(error),
                            timestamp: new Date()
                        });

                        if (!skipOnError) {
                            throw error;
                        }

                        this.logger.warn(`Failed to analyze ${file.path}: ${error}`);

                    } finally {
                        progress.processed++;
                        progress.percentage = Math.round((progress.processed / progress.total) * 100);
                        progress.currentFile = file.path;

                        // Calculate ETA
                        const elapsed = Date.now() - startTime;
                        const avgTimePerFile = elapsed / progress.processed;
                        const remaining = progress.total - progress.processed;
                        progress.estimatedTimeRemaining = Math.round((avgTimePerFile * remaining) / 1000);

                        // Emit progress
                        if (this.onProgressCallback && progress.processed % 10 === 0) {
                            this.onProgressCallback({ ...progress });
                        }
                    }
                })
            );

            // Wait for all files to complete
            await Promise.all(promises);

            // Calculate stats
            const processingTime = Date.now() - startTime;
            const throughput = (successful / processingTime) * 1000; // files per second

            let totalFunctions = 0;
            let totalClasses = 0;
            let totalDataOperations = 0;

            for (const file of analyzedFiles) {
                totalFunctions += file.analysis.functions.length;
                totalClasses += file.analysis.classes.length;
                totalDataOperations += file.analysis.dataOperations.length;
            }

            const stats: AnalysisStats = {
                totalFiles: files.length,
                successfulFiles: successful,
                failedFiles: failed,
                totalFunctions,
                totalClasses,
                totalDataOperations,
                processingTime,
                throughput: parseFloat(throughput.toFixed(2))
            };

            this.logger.log(
                `✅ Parallel analysis complete: ${successful}/${files.length} files ` +
                `(${(processingTime / 1000).toFixed(2)}s, ${throughput.toFixed(2)} files/s)`
            );

            if (errors.length > 0) {
                this.logger.warn(`⚠️  ${errors.length} files failed to analyze`);
            }

            return {
                analyzedFiles,
                stats,
                errors
            };

        } catch (error) {
            this.logger.error('❌ Parallel analysis failed:', error);
            throw error;
        }
    }

    /**
     * Analyze single file with timeout
     */
    private async analyzeFileWithTimeout(
        file: { path: string; content: string; language: any },
        timeoutMs: number
    ): Promise<AnalyzedFile | null> {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.logger.warn(`Analysis timeout for ${file.path} after ${timeoutMs}ms`);
                resolve(null);
            }, timeoutMs);

            try {
                const analysis = this.astParser.parseFile(file.content, file.language, file.path);

                const analyzedFile: AnalyzedFile = {
                    path: file.path,
                    content: file.content,
                    language: file.language,
                    size: Buffer.byteLength(file.content, 'utf8'),
                    lastModified: new Date(),
                    analysis: {
                        functions: analysis.functions,
                        classes: analysis.classes,
                        imports: analysis.imports,
                        dataOperations: analysis.dataOperations,
                        tableReferences: analysis.tableReferences,
                        configReferences: [],
                        annotations: [],
                        complexity: analysis.complexity
                    }
                };

                clearTimeout(timer);
                resolve(analyzedFile);

            } catch (error) {
                clearTimeout(timer);
                this.logger.debug(`Error analyzing ${file.path}:`, error);
                resolve(null);
            }
        });
    }

    /**
     * Process files in batches for better memory management
     */
    async analyzeInBatches(
        files: Array<{ path: string; content: string; language: any }>,
        batchSize: number = 100,
        config: AnalysisConfig = {}
    ): Promise<AnalysisResult> {
        this.logger.log(`Processing ${files.length} files in batches of ${batchSize}`);

        const allAnalyzedFiles: AnalyzedFile[] = [];
        const allErrors: AnalysisError[] = [];
        const startTime = Date.now();

        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, Math.min(i + batchSize, files.length));
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(files.length / batchSize);

            this.logger.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} files)`);

            const result = await this.analyzeFilesInParallel(batch, config);

            allAnalyzedFiles.push(...result.analyzedFiles);
            allErrors.push(...result.errors);

            // Log batch progress
            this.logger.log(
                `✓ Batch ${batchNum}/${totalBatches} complete: ` +
                `${result.stats.successfulFiles}/${result.stats.totalFiles} successful`
            );
        }

        const processingTime = Date.now() - startTime;
        const throughput = (allAnalyzedFiles.length / processingTime) * 1000;

        let totalFunctions = 0;
        let totalClasses = 0;
        let totalDataOperations = 0;

        for (const file of allAnalyzedFiles) {
            totalFunctions += file.analysis.functions.length;
            totalClasses += file.analysis.classes.length;
            totalDataOperations += file.analysis.dataOperations.length;
        }

        return {
            analyzedFiles: allAnalyzedFiles,
            stats: {
                totalFiles: files.length,
                successfulFiles: allAnalyzedFiles.length,
                failedFiles: allErrors.length,
                totalFunctions,
                totalClasses,
                totalDataOperations,
                processingTime,
                throughput: parseFloat(throughput.toFixed(2))
            },
            errors: allErrors
        };
    }

    /**
     * Estimate analysis time
     */
    estimateAnalysisTime(fileCount: number, avgFileSizeKb: number = 10): number {
        // Empirical estimates (adjust based on benchmarks)
        const baseTimePerFile = 50; // ms
        const sizeMultiplier = avgFileSizeKb / 10;
        const concurrency = this.defaultConcurrency;

        const serialTime = fileCount * baseTimePerFile * sizeMultiplier;
        const parallelTime = serialTime / concurrency;

        return Math.round(parallelTime);
    }

    /**
     * Get optimal batch size based on file count and memory
     */
    getOptimalBatchSize(fileCount: number, avgFileSizeMb: number = 0.01): number {
        const availableMemoryMb = os.freemem() / (1024 * 1024);
        const maxMemoryUsageMb = availableMemoryMb * 0.5; // Use max 50% of free memory
        const maxFilesInMemory = Math.floor(maxMemoryUsageMb / avgFileSizeMb);

        // Clamp between 50 and 500
        return Math.max(50, Math.min(500, maxFilesInMemory));
    }
}
