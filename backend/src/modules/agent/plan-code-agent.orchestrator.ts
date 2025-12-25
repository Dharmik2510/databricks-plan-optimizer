/**
 * Plan-to-Code Agent Orchestrator
 * Main service that coordinates the entire mapping workflow
 */
import { Injectable } from '@nestjs/common';
import {
    AgentJob,
    AgentConfig,
    AgentJobStatus,
    AgentProgress,
    AgentResult,
    AgentError,
    AgentLog,
    CreateAgentJobRequest,
    RepositoryConfig,
    ExecutionPlan,
    PlanCodeMapping,
    RepositorySummary,
    MappingStatistics,
    AnalyzedFile,
    AgentWebSocketEvent,
    DependencyInfo,
} from './agent-types';
import { PlanParserService } from './plan-parser.service';
import { RepositoryCrawlerService } from './repository-crawler.service';
import { PlanCodeMappingEngine } from './plan-code-mapping.engine';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CONFIG: AgentConfig = {
    maxConcurrentFiles: 50,
    confidenceThreshold: 40,
    enableSemanticAnalysis: true,
    enableCallGraphAnalysis: true,
    enableAIInference: false, // Disabled by default to avoid API costs
    timeout: 300000, // 5 minutes
    retryCount: 3,
};

@Injectable()
export class PlanCodeAgentOrchestrator {
    private jobs: Map<string, AgentJob> = new Map();
    private eventEmitter?: (event: AgentWebSocketEvent) => void;

    private planParser: PlanParserService;

    constructor() {
        this.planParser = new PlanParserService();
    }

    /**
     * Set event emitter for WebSocket updates
     */
    setEventEmitter(emitter: (event: AgentWebSocketEvent) => void): void {
        this.eventEmitter = emitter;
    }

    /**
     * Create and start a new agent job
     */
    async createJob(request: CreateAgentJobRequest): Promise<AgentJob> {
        const jobId = uuidv4();
        const config: AgentConfig = { ...DEFAULT_CONFIG, ...request.options };

        const repoConfig: RepositoryConfig = {
            url: request.repositoryUrl,
            branch: request.branch || 'main',
            token: request.token,
            maxFiles: config.maxConcurrentFiles,
        };

        const job: AgentJob = {
            id: jobId,
            planId: '', // Will be set after parsing
            repoConfig,
            agentConfig: config,
            status: 'queued',
            progress: {
                currentPhase: 'Initializing',
                filesProcessed: 0,
                totalFiles: 0,
                stagesMapped: 0,
                totalStages: 0,
                percentage: 0,
                logs: [],
            },
            createdAt: new Date(),
        };

        this.jobs.set(jobId, job);

        // Start processing asynchronously
        this.processJob(job, request.planContent, request.planName, request.dagStages).catch(error => {
            this.handleJobError(job, error);
        });

        return job;
    }

    /**
     * Get job status
     */
    getJob(jobId: string): AgentJob | undefined {
        return this.jobs.get(jobId);
    }

    /**
     * Cancel a running job
     */
    cancelJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) {
            return false;
        }

        job.status = 'cancelled';
        job.completedAt = new Date();
        return true;
    }

    /**
     * Main job processing workflow
     */
    private async processJob(
        job: AgentJob,
        planContent: string,
        planName?: string,
        dagStages?: any[]
    ): Promise<void> {
        const startTime = Date.now();

        try {
            // Phase 1: Parse Execution Plan
            this.updateJobStatus(job, 'fetching_repo', 'Initializing AI agent...');
            this.addLog(job, 'info', '🤖 AI Agent initialized and ready');
            this.addLog(job, 'info', '📋 Loading execution plan...');

            let plan: ExecutionPlan;
            if (dagStages && dagStages.length > 0) {
                plan = this.planParser.createPlanFromDag(dagStages, planName, planContent);
                this.addLog(job, 'info', `✓ Using ${dagStages.length} generated DAG stages for intelligent mapping`);
            } else {
                plan = this.planParser.parsePlan(planContent, planName);
                this.addLog(job, 'info', `✓ Successfully parsed ${plan.parsedStages.length} execution stages`);
            }

            job.planId = plan.id;
            job.progress.totalStages = plan.parsedStages.length;

            this.addLog(job, 'info', `🎯 Target: Map ${plan.parsedStages.length} stages to codebase`);
            this.emitEvent({ type: 'progress', data: job.progress });

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 2: Crawl Repository
            this.updateJobStatus(job, 'fetching_repo', 'Connecting to repository...');
            this.addLog(job, 'info', `🔗 Connecting to repository: ${job.repoConfig.url}`);
            this.addLog(job, 'info', `📦 Cloning branch: ${job.repoConfig.branch}`);

            const crawler = new RepositoryCrawlerService((log) => {
                this.addLog(job, log.level, log.message, log.details);
                this.emitEvent({ type: 'log', data: log });
            });

            this.addLog(job, 'info', '🔍 Scanning directory structure...');
            const analyzedFiles = await crawler.crawlRepository(job.repoConfig);
            job.progress.totalFiles = analyzedFiles.length;
            job.progress.filesProcessed = analyzedFiles.length;

            this.addLog(job, 'info', `✓ Discovered ${analyzedFiles.length} code files`);
            const languages = [...new Set(analyzedFiles.map(f => f.language))];
            this.addLog(job, 'info', `📚 Languages detected: ${languages.join(', ')}`);
            this.emitEvent({ type: 'progress', data: job.progress });

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 3: Analyze Files
            this.updateJobStatus(job, 'analyzing_files', 'Analyzing code structure...');
            this.addLog(job, 'info', '🔬 Analyzing code structure and patterns...');

            // Count analysis results
            let totalFunctions = 0;
            let totalClasses = 0;
            let totalOperations = 0;

            // Files are already analyzed by crawler, emit individual file events
            for (const file of analyzedFiles) {
                totalFunctions += file.analysis.functions.length;
                totalClasses += file.analysis.classes.length;
                totalOperations += file.analysis.dataOperations.length;

                this.emitEvent({
                    type: 'file_analyzed',
                    data: {
                        filePath: file.path,
                        operationsFound: file.analysis.dataOperations.length,
                    },
                });
            }

            this.addLog(job, 'info', `✓ Extracted ${totalFunctions} functions across ${analyzedFiles.length} files`);
            this.addLog(job, 'info', `✓ Identified ${totalClasses} classes and ${totalOperations} data operations`);
            this.addLog(job, 'info', '🧠 Building dependency graph...');

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 4: Map Stages to Code
            this.updateJobStatus(job, 'mapping_stages', 'Mapping plan stages to code...');
            this.addLog(job, 'info', '🎯 Starting intelligent stage-to-code mapping...');
            this.addLog(job, 'info', '🔍 Analyzing semantic relationships...');

            const mappingEngine = new PlanCodeMappingEngine(job.agentConfig, (log) => {
                this.addLog(job, log.level, log.message, log.details);
                this.emitEvent({ type: 'log', data: log });
            });

            const mappings = await mappingEngine.mapPlanToCode(plan, analyzedFiles);

            // Emit individual stage mapping events
            let confirmedCount = 0;
            let probableCount = 0;

            for (const mapping of mappings) {
                job.progress.stagesMapped++;
                job.progress.percentage = Math.round(
                    ((job.progress.filesProcessed + job.progress.stagesMapped) /
                        (job.progress.totalFiles + job.progress.totalStages)) * 100
                );

                if (mapping.status === 'confirmed') confirmedCount++;
                if (mapping.status === 'probable') probableCount++;

                this.addLog(job, 'debug', `✓ Mapped stage: ${mapping.stageName} (${mapping.confidence}% confidence)`);

                this.emitEvent({
                    type: 'stage_mapped',
                    data: { stageId: mapping.stageId, mapping },
                });
                this.emitEvent({ type: 'progress', data: job.progress });
            }

            this.addLog(job, 'info', `✓ Mapping complete: ${confirmedCount} confirmed, ${probableCount} probable`);

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 5: Finalize
            this.updateJobStatus(job, 'finalizing', 'Generating results...');
            this.addLog(job, 'info', '📊 Generating final report...');
            this.addLog(job, 'info', '🔢 Calculating statistics...');

            const result = this.buildResult(
                plan,
                job.repoConfig,
                mappings,
                analyzedFiles,
                Date.now() - startTime
            );

            this.addLog(job, 'info', '📝 Building repository summary...');

            // Complete job
            job.status = 'completed';
            job.result = result;
            job.completedAt = new Date();
            job.progress.percentage = 100;
            job.progress.currentPhase = 'Complete';

            const duration = (result.executionTime / 1000).toFixed(2);
            this.addLog(job, 'info', `✅ Analysis complete in ${duration}s!`);
            this.addLog(job, 'info', `🎉 Successfully mapped ${result.statistics.mappedStages}/${result.statistics.totalStages} stages`);
            this.addLog(job, 'info', `📈 Coverage: ${result.statistics.coveragePercentage}% | Avg confidence: ${result.statistics.averageConfidence}%`);
            this.emitEvent({ type: 'completed', data: result });

        } catch (error) {
            this.handleJobError(job, error);
        }
    }

    /**
     * Build the final result object
     */
    private buildResult(
        plan: ExecutionPlan,
        repoConfig: RepositoryConfig,
        mappings: PlanCodeMapping[],
        analyzedFiles: AnalyzedFile[],
        executionTime: number
    ): AgentResult {
        return {
            planId: plan.id,
            repositoryUrl: repoConfig.url,
            branch: repoConfig.branch,
            mappings,
            repositoryAnalysis: this.buildRepositorySummary(analyzedFiles),
            statistics: this.buildStatistics(mappings),
            executionTime,
        };
    }

    /**
     * Build repository summary
     */
    private buildRepositorySummary(files: AnalyzedFile[]): RepositorySummary {
        const languages: Record<string, number> = {};
        let totalFunctions = 0;
        let totalClasses = 0;
        let totalDataOperations = 0;
        const entryPoints: string[] = [];
        const dependencyMap = new Map<string, Set<string>>();

        for (const file of files) {
            // Count languages
            languages[file.language] = (languages[file.language] || 0) + 1;

            // Count structures
            totalFunctions += file.analysis.functions.length;
            totalClasses += file.analysis.classes.length;
            totalDataOperations += file.analysis.dataOperations.length;

            // Detect entry points
            const fileName = file.path.split('/').pop() || '';
            if (fileName === 'main.py' || fileName === 'app.py' ||
                fileName.includes('__main__') || fileName === 'Main.scala' ||
                file.analysis.functions.some(f => f.name === 'main')) {
                entryPoints.push(file.path);
            }

            // Collect external dependencies
            for (const imp of file.analysis.imports) {
                if (!imp.isRelative && imp.module) {
                    const basePkg = imp.module.split('.')[0];
                    const usedIn = dependencyMap.get(basePkg) || new Set();
                    usedIn.add(file.path);
                    dependencyMap.set(basePkg, usedIn);
                }
            }
        }

        // Convert dependencies
        const dependencies = Array.from(dependencyMap.entries())
            .filter(([pkg]) => !['os', 'sys', 'json', 'datetime', 'typing', 're'].includes(pkg))
            .map(([name, usedIn]) => ({
                name,
                type: this.guessDependencyType(name) as any,
                usedIn: Array.from(usedIn),
            }));

        return {
            totalFiles: files.length,
            analyzedFiles: files.length,
            languages: languages as any,
            totalFunctions,
            totalClasses,
            totalDataOperations,
            entryPoints,
            dependencies,
        };
    }

    /**
     * Guess dependency type from name
     */
    private guessDependencyType(name: string): string {
        const pyPackages = ['pyspark', 'pandas', 'numpy', 'requests', 'boto3', 'sqlalchemy'];
        const jvmPackages = ['org', 'com', 'io', 'scala', 'java'];

        if (pyPackages.includes(name.toLowerCase())) return 'pip';
        if (jvmPackages.some(p => name.startsWith(p))) return 'maven';
        return 'pip';
    }

    /**
     * Build mapping statistics
     */
    private buildStatistics(mappings: PlanCodeMapping[]): MappingStatistics {
        const totalStages = mappings.length;
        const mappedStages = mappings.filter(m => m.status !== 'unmapped').length;
        const confirmedMappings = mappings.filter(m => m.status === 'confirmed').length;
        const probableMappings = mappings.filter(m => m.status === 'probable').length;
        const uncertainMappings = mappings.filter(m => m.status === 'uncertain').length;
        const unmappedStages = mappings.filter(m => m.status === 'unmapped').length;

        const confidences = mappings
            .filter(m => m.confidence > 0)
            .map(m => m.confidence);
        const averageConfidence = confidences.length > 0
            ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
            : 0;

        const suggestionsGenerated = mappings.reduce(
            (sum, m) => sum + (m.suggestions?.length || 0),
            0
        );

        return {
            totalStages,
            mappedStages,
            confirmedMappings,
            probableMappings,
            uncertainMappings,
            unmappedStages,
            averageConfidence,
            suggestionsGenerated,
            coveragePercentage: Math.round((mappedStages / totalStages) * 100),
        };
    }

    /**
     * Handle job error
     */
    private handleJobError(job: AgentJob, error: unknown): void {
        const errorMessage = error instanceof Error ? error.message : String(error);

        job.status = 'failed';
        job.completedAt = new Date();
        job.error = {
            code: 'PROCESSING_ERROR',
            message: errorMessage,
            recoverable: true,
            suggestion: 'Check repository access and try again.',
        };

        console.error('Job Error:', error); // Log to server console
        this.addLog(job, 'error', `Job failed: ${errorMessage}`);
        this.emitEvent({ type: 'error', data: job.error });
    }

    /**
     * Update job status
     */
    private updateJobStatus(
        job: AgentJob,
        status: AgentJobStatus,
        phase: string
    ): void {
        job.status = status;
        job.progress.currentPhase = phase;

        if (status !== 'queued' && !job.startedAt) {
            job.startedAt = new Date();
        }
    }

    /**
     * Add log entry
     */
    private addLog(
        job: AgentJob,
        level: AgentLog['level'],
        message: string,
        details?: Record<string, any>
    ): void {
        const log: AgentLog = {
            timestamp: new Date(),
            level,
            message,
            details,
        };
        job.progress.logs.push(log);

        // Keep only last 100 logs
        if (job.progress.logs.length > 100) {
            job.progress.logs = job.progress.logs.slice(-100);
        }
    }

    /**
     * Emit WebSocket event
     */
    private emitEvent(event: AgentWebSocketEvent): void {
        this.eventEmitter?.(event);
    }
}
