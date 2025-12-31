/**
 * Plan-to-Code Agent Orchestrator (LangGraph Integration)
 *
 * This orchestrator now uses the LangGraph workflow for intelligent DAG → code mapping.
 * It wraps the MappingOrchestrator and provides compatibility with the existing API.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
    AgentJob,
    AgentConfig,
    AgentJobStatus,
    AgentProgress,
    AgentResult,
    AgentLog,
    CreateAgentJobRequest,
    RepositoryConfig,
    ExecutionPlan,
    PlanCodeMapping,
    RepositorySummary,
    MappingStatistics,
    AnalyzedFile,
    AgentWebSocketEvent,
} from './agent-types';
import { PlanParserService } from './plan-parser.service';
import { MappingOrchestrator } from './langgraph/orchestrator/mapping.orchestrator';
import { DagNode } from './langgraph/state/mapping-state.schema';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CONFIG: AgentConfig = {
    maxConcurrentFiles: 50,
    confidenceThreshold: 40,
    enableSemanticAnalysis: true,
    enableCallGraphAnalysis: true,
    enableAIInference: true,
    timeout: 300000,
    retryCount: 3,
};

@Injectable()
export class PlanCodeAgentOrchestrator {
    private readonly logger = new Logger(PlanCodeAgentOrchestrator.name);
    private jobs: Map<string, AgentJob> = new Map();
    private eventEmitter?: (event: AgentWebSocketEvent) => void;
    private planParser: PlanParserService;

    constructor(
        private readonly mappingOrchestrator: MappingOrchestrator
    ) {
        this.planParser = new PlanParserService();
        this.logger.log('✅ Plan-Code Agent Orchestrator initialized with LangGraph workflow');
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
            planId: '',
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
        this.processJobWithLangGraph(job, request.planContent, request.planName, request.dagStages).catch(error => {
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
     * Main job processing workflow using LangGraph
     */
    private async processJobWithLangGraph(
        job: AgentJob,
        planContent: string,
        planName?: string,
        dagStages?: any[]
    ): Promise<void> {
        const startTime = Date.now();

        try {
            // Phase 1: Parse Execution Plan
            this.updateJobStatus(job, 'fetching_repo', 'Initializing LangGraph AI agent...');
            this.addLog(job, 'info', '🤖 LangGraph AI Agent initialized with 7-node workflow');
            this.addLog(job, 'info', '📋 Loading execution plan...');

            let plan: ExecutionPlan;
            if (dagStages && dagStages.length > 0) {
                plan = this.planParser.createPlanFromDag(dagStages, planName, planContent);
                this.addLog(job, 'info', `✓ Using ${dagStages.length} DAG stages for LangGraph mapping`);
            } else {
                plan = this.planParser.parsePlan(planContent, planName);
                this.addLog(job, 'info', `✓ Successfully parsed ${plan.parsedStages.length} execution stages`);
            }

            job.planId = plan.id;
            job.progress.totalStages = plan.parsedStages.length;

            this.addLog(job, 'info', `🎯 Target: Map ${plan.parsedStages.length} stages using LangGraph workflow`);
            this.emitEvent({ type: 'progress', data: job.progress });

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 2: Convert to DagNodes
            this.updateJobStatus(job, 'analyzing_files', 'Preparing DAG nodes...');
            this.addLog(job, 'info', '🔄 Converting plan stages to DAG nodes for parallel processing...');

            const dagNodes: DagNode[] = plan.parsedStages.map((stage, idx) => ({
                id: `dag_node_${idx}`,
                operator: String(stage.type || 'Unknown'),
                physicalPlanFragment: stage.description || stage.name,
                metadata: {
                    stageId: stage.id,
                    stageName: stage.name,
                    description: stage.description || '',
                },
            }));

            this.addLog(job, 'info', `✓ Created ${dagNodes.length} DAG nodes for processing`);

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 3: Execute LangGraph Workflow
            this.updateJobStatus(job, 'mapping_stages', 'Executing LangGraph workflow...');
            this.addLog(job, 'info', '🚀 Starting LangGraph mapping workflow:');
            this.addLog(job, 'info', '   ├─ Node 1: Loading repository context...');
            this.addLog(job, 'info', '   ├─ Node 2: Extracting plan semantics...');
            this.addLog(job, 'info', '   ├─ Node 3: Embedding retrieval (ChromaDB Cloud)...');
            this.addLog(job, 'info', '   ├─ Node 4: AST filtering...');
            this.addLog(job, 'info', '   ├─ Node 5: AI reasoning (GPT-4o)...');
            this.addLog(job, 'info', '   ├─ Node 6: Confidence gating...');
            this.addLog(job, 'info', '   └─ Node 7: Final mapping...');

            const { jobId: langGraphJobId } = await this.mappingOrchestrator.createJob({
                analysisId: job.planId,
                repoUrl: job.repoConfig.url,
                commitHash: undefined,
                githubToken: job.repoConfig.token,
                dagNodes,
            });

            this.addLog(job, 'info', `✓ LangGraph job created: ${langGraphJobId}`);

            // Poll for completion
            let langGraphStatus = await this.mappingOrchestrator.getJobStatus(langGraphJobId);
            let pollCount = 0;
            const maxPolls = 120; // 10 minutes max (5 second intervals)

            while (langGraphStatus && langGraphStatus.status !== 'completed' && langGraphStatus.status !== 'failed' && pollCount < maxPolls) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                langGraphStatus = await this.mappingOrchestrator.getJobStatus(langGraphJobId);
                pollCount++;

                if (langGraphStatus) {
                    const progress = langGraphStatus.progress;
                    job.progress.stagesMapped = progress.completedNodes;
                    job.progress.percentage = Math.round((progress.completedNodes / progress.totalNodes) * 100);

                    if (progress.currentNode) {
                        this.addLog(job, 'debug', `  Processing: ${progress.currentNode}`);
                    }

                    this.emitEvent({ type: 'progress', data: job.progress });
                }

                // Check for cancellation
                if ((job.status as string) === 'cancelled') return;
            }

            if (!langGraphStatus) {
                throw new Error('LangGraph job status not found');
            }

            if (langGraphStatus.status === 'failed') {
                throw new Error(langGraphStatus.error || 'LangGraph job failed');
            }

            this.addLog(job, 'info', `✅ LangGraph workflow completed: ${langGraphStatus.results.length} mappings`);
            this.addLog(job, 'info', `💰 Total cost: $${langGraphStatus.costTracking.totalCostUSD.toFixed(4)}`);

            // Phase 4: Convert results back to legacy format
            this.updateJobStatus(job, 'finalizing', 'Generating results...');
            this.addLog(job, 'info', '📊 Converting LangGraph results to legacy format...');

            const mappings = this.convertLangGraphResults(langGraphStatus.results, plan);

            this.addLog(job, 'info', '📝 Building repository summary...');

            const result = this.buildResult(
                plan,
                job.repoConfig,
                mappings,
                [],
                Date.now() - startTime
            );

            // Complete job
            job.status = 'completed';
            job.result = result;
            job.completedAt = new Date();
            job.progress.percentage = 100;
            job.progress.currentPhase = 'Complete';

            const duration = (result.executionTime / 1000).toFixed(2);
            this.addLog(job, 'info', `✅ LangGraph analysis complete in ${duration}s!`);
            this.addLog(job, 'info', `🎉 Successfully mapped ${result.statistics.mappedStages}/${result.statistics.totalStages} stages`);
            this.addLog(job, 'info', `📈 Coverage: ${result.statistics.coveragePercentage}% | Avg confidence: ${result.statistics.averageConfidence}%`);
            this.emitEvent({ type: 'completed', data: result });

        } catch (error) {
            this.handleJobError(job, error);
        }
    }

    /**
     * Extract operator type from operation string
     */
    private extractOperator(operation: string): string {
        // Try to extract Spark operator from plan text
        const operatorMatch = operation.match(/^(\w+)/);
        return operatorMatch ? operatorMatch[1] : 'Unknown';
    }

    /**
     * Convert LangGraph MappingOutput to legacy PlanCodeMapping format
     */
    private convertLangGraphResults(
        langGraphResults: any[],
        plan: ExecutionPlan
    ): PlanCodeMapping[] {
        return langGraphResults.map((result, idx) => {
            const stage = plan.parsedStages[idx] || {
                id: `stage_${idx}`,
                name: `Stage ${idx}`,
                type: 'unknown' as any,
                description: '',
                dependencies: [],
            };

            // Convert mappedFiles to CodeMapping format
            const codeMappings = (result.mappedFiles || []).map((file: any, fileIdx: number) => ({
                id: `mapping_${idx}_${fileIdx}`,
                filePath: file.file || file.filePath || 'unknown',
                language: 'python' as any, // Default to python
                startLine: file.startLine || 0,
                endLine: file.endLine || 0,
                codeSnippet: file.snippet || '',
                matchType: 'semantic' as any,
                confidence: file.confidence || result.confidence || 0,
                reasoning: file.reasoning || '',
            }));

            return {
                id: `mapping_${idx}`,
                planId: plan.id,
                stageId: stage.id,
                stageName: stage.name,
                stageType: stage.type,
                mappings: codeMappings,
                confidence: result.confidence || 0,
                status: result.confidence >= 80 ? 'confirmed' :
                        result.confidence >= 50 ? 'probable' :
                        result.confidence >= 30 ? 'uncertain' : 'unmapped',
                reasoning: result.reasoning || 'Mapped using LangGraph workflow',
                suggestions: result.alternatives || [],
            };
        });
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
        return {
            totalFiles: files.length,
            analyzedFiles: files.length,
            languages: {} as any,
            totalFunctions: 0,
            totalClasses: 0,
            totalDataOperations: 0,
            entryPoints: [],
            dependencies: [],
        };
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

        this.logger.error('Job Error:', error);
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
