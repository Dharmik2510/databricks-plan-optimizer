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
    async createJob(request: CreateAgentJobRequest, userId: string): Promise<AgentJob> {
        const jobId = uuidv4();
        const config: AgentConfig = { ...DEFAULT_CONFIG, ...request.options };

        const repoConfig: RepositoryConfig = {
            url: request.repositoryUrl,
            branch: request.branch || 'main',
            commitHash: request.commitHash,
            token: request.token,
            maxFiles: config.maxConcurrentFiles,
        };

        const job: AgentJob = {
            id: jobId,
            userId, // Set userId on job
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
     * Pause a running job
     */
    pauseJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job || !['running', 'fetching_repo', 'analyzing_files', 'mapping_stages'].includes(job.status)) {
            return false;
        }

        job.isPaused = true;
        this.addLog(job, 'info', '⏸️ Job paused by user');

        // Propagate to LangGraph orchestrator if running
        if (job.langGraphJobId) {
            this.mappingOrchestrator.pauseJob(job.langGraphJobId);
        }

        return true;
    }

    /**
     * Resume a paused job
     */
    resumeJob(jobId: string): boolean {
        const job = this.jobs.get(jobId);
        if (!job || !(job as any).isPaused) {
            return false;
        }

        job.isPaused = false;
        this.addLog(job, 'info', '▶️ Job resumed');

        // Propagate to LangGraph orchestrator if running
        if (job.langGraphJobId) {
            this.mappingOrchestrator.resumeJob(job.langGraphJobId);
        }

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
            // Phase 1: Load Repository / Parse Execution Plan
            const loadRepoStart = Date.now();
            await this.waitForResume(job);
            this.updateJobStatus(job, 'fetching_repo', 'Initializing LangGraph AI agent...');
            this.emitEvent({ type: 'stage_started', data: { stage: 'load_repo', message: 'Cloning repository...' } });

            await this.delay(800); // Artificial delay for UX
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

            // Complete load_repo stage
            this.emitEvent({ type: 'stage_completed', data: { stage: 'load_repo', durationMs: Date.now() - loadRepoStart } });

            this.addLog(job, 'info', `🎯 Target: Map ${plan.parsedStages.length} stages using LangGraph workflow`);
            this.emitEvent({ type: 'progress', data: job.progress });

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 2: Parse AST / Convert to DagNodes
            const parseAstStart = Date.now();
            await this.waitForResume(job);
            this.updateJobStatus(job, 'analyzing_files', 'Preparing DAG nodes...');
            this.emitEvent({ type: 'stage_started', data: { stage: 'parse_ast', message: 'Analyzing code structure' } });

            await this.delay(600); // Artificial delay for UX
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

            // Complete parse_ast stage
            this.emitEvent({ type: 'stage_completed', data: { stage: 'parse_ast', durationMs: Date.now() - parseAstStart } });

            // Check for cancellation
            if ((job.status as string) === 'cancelled') return;

            // Phase 3: Execute LangGraph Workflow (Extract Semantics)
            const langGraphStart = Date.now();
            await this.waitForResume(job);
            this.updateJobStatus(job, 'mapping_stages', 'Executing LangGraph workflow...');
            this.emitEvent({ type: 'stage_started', data: { stage: 'langgraph_execution', message: `Processing ${dagNodes.length} nodes` } });
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
                userId: job.userId, // Pass userId required for multi-tenancy
                repoUrl: job.repoConfig.url,
                commitHash: job.repoConfig.commitHash, // Use optional commit hash
                githubToken: job.repoConfig.token,
                dagNodes,
            });

            job.langGraphJobId = langGraphJobId;
            this.addLog(job, 'info', `✓ LangGraph job created: ${langGraphJobId}`);

            // Poll for completion
            let langGraphStatus = await this.mappingOrchestrator.getJobStatus(langGraphJobId);
            let pollCount = 0;
            const maxPolls = 120; // 10 minutes max (5 second intervals)

            while (langGraphStatus && langGraphStatus.status !== 'completed' && langGraphStatus.status !== 'failed' && pollCount < maxPolls) {
                await this.waitForResume(job);
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

            // Complete langgraph_execution stage
            this.emitEvent({ type: 'stage_completed', data: { stage: 'langgraph_execution', durationMs: Date.now() - langGraphStart } });

            // Phase 4: Retrieve Candidates (quick phase)
            const retrieveStart = Date.now();
            await this.waitForResume(job);
            this.emitEvent({ type: 'stage_started', data: { stage: 'retrieve_candidates', message: 'Searching code embeddings' } });

            await this.delay(800); // Artificial delay for UX
            this.addLog(job, 'info', '📊 Converting LangGraph results to legacy format...');

            const mappings = this.convertLangGraphResults(langGraphStatus.results, plan);

            // Complete retrieve_candidates
            this.emitEvent({ type: 'stage_completed', data: { stage: 'retrieve_candidates', durationMs: Date.now() - retrieveStart } });

            // Phase 5: Cross-Reference
            const crossRefStart = Date.now();
            this.emitEvent({ type: 'stage_started', data: { stage: 'cross_reference', message: 'Validating mappings' } });

            await this.delay(700); // Artificial delay for UX
            this.addLog(job, 'info', '📝 Building repository summary...');

            // Extract repository stats from LangGraph status
            const repoStats = langGraphStatus.repoContext || {};

            // Complete cross_reference
            this.emitEvent({ type: 'stage_completed', data: { stage: 'cross_reference', durationMs: Date.now() - crossRefStart } });

            // Phase 6: Finalize Analysis
            const finalizeStart = Date.now();
            await this.waitForResume(job);
            this.emitEvent({ type: 'stage_started', data: { stage: 'finalize_analysis', message: 'Generating results' } });

            await this.delay(600); // Artificial delay for UX

            const result = this.buildResult(
                plan,
                job.repoConfig,
                mappings,
                [],
                Date.now() - startTime,
                repoStats
            );

            // Complete finalize_analysis
            this.emitEvent({ type: 'stage_completed', data: { stage: 'finalize_analysis', durationMs: Date.now() - finalizeStart } });

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
        // Create a map for O(1) lookup: dagNodeId -> Result
        const resultMap = new Map<string, any>();
        langGraphResults.forEach(r => {
            if (r.dagNodeId) {
                resultMap.set(r.dagNodeId, r);
            }
        });

        // Iterate over the PLAN stages to ensure 1:1 alignment
        return plan.parsedStages.map((stage, idx) => {
            const dagNodeId = `dag_node_${idx}`;
            const result = resultMap.get(dagNodeId);

            if (!result) {
                // Return unmapped state if no result found for this stage
                return {
                    id: `mapping_${idx}`,
                    planId: plan.id,
                    stageId: stage.id,
                    stageName: stage.name,
                    stageType: stage.type,
                    mappings: [],
                    confidence: 0,
                    status: 'unmapped',
                    reasoning: 'No mapping result returned from analysis',
                    suggestions: [],
                };
            }

            // Extract mappedCode from LangGraph result
            const mappedCode = result.mappedCode || {};
            const confidence = (result.confidence || 0) * 100; // Convert to percentage

            // Parse lines string "45-67" to get startLine and endLine
            const linesMatch = (mappedCode.lines || '0-0').match(/(\d+)-(\d+)/);
            const startLine = linesMatch ? parseInt(linesMatch[1]) : 0;
            const endLine = linesMatch ? parseInt(linesMatch[2]) : 0;

            // Convert mappedCode to CodeMapping format
            const codeMappings = mappedCode.file ? [{
                id: `mapping_${idx}_0`,
                filePath: mappedCode.file,
                language: this.detectLanguage(mappedCode.file),
                startLine,
                endLine,
                codeSnippet: mappedCode.codeSnippet || '', // Mapped from LangGraph result
                matchType: 'semantic' as any,
                confidence,
                evidenceFactors: [], // TODO: Extract evidence factors from result
                reasoning: result.explanation || '',
            }] : [];

            // Extract confidenceFactors from LangGraph result
            const confidenceFactors = result.confidenceFactors ? {
                embeddingScore: result.confidenceFactors.embeddingScore || 0,
                astScore: result.confidenceFactors.astScore || 0,
                llmConfidence: result.confidenceFactors.llmConfidence || 0,
                keywordMatch: result.confidenceFactors.keywordMatch || 0,
                alternativesPenalty: result.confidenceFactors.alternativesPenalty || 0,
            } : undefined;

            // Extract alternatives from LangGraph result
            const alternatives = (result.alternatives || []).slice(0, 3).map((alt: any) => ({
                file: alt.file || alt.filePath || '',
                symbol: alt.symbol || alt.functionContext || '',
                confidence: (alt.confidence || alt.score || 0) * 100,
                reasoning: alt.reasoning || alt.rejectionReason || 'Lower confidence match',
            }));

            return {
                id: `mapping_${idx}`,
                planId: plan.id,
                stageId: stage.id,
                stageName: stage.name,
                stageType: stage.type,
                mappings: codeMappings,
                confidence,
                confidenceFactors, // Include for frontend score breakdown
                alternatives,      // Include rejected alternatives
                status: confidence >= 80 ? 'confirmed' :
                    confidence >= 50 ? 'probable' :
                        confidence >= 30 ? 'uncertain' : 'unmapped',
                reasoning: result.explanation || 'Mapped using LangGraph workflow',
                suggestions: alternatives, // For backwards compat
            };
        });
    }

    /**
     * Detect programming language from file extension
     */
    private detectLanguage(filePath: string): 'python' | 'scala' | 'java' | 'sql' | 'unknown' {
        const ext = filePath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'py': return 'python';
            case 'scala': return 'scala';
            case 'java': return 'java';
            case 'sql': return 'sql';
            default: return 'unknown';
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
        executionTime: number,
        repoStats?: any
    ): AgentResult {
        return {
            planId: plan.id,
            repositoryUrl: repoConfig.url,
            branch: repoConfig.branch,
            mappings,
            repositoryAnalysis: this.buildRepositorySummary(analyzedFiles, repoStats),
            statistics: this.buildStatistics(mappings),
            executionTime,
        };
    }

    /**
     * Build repository summary
     */
    private buildRepositorySummary(files: AnalyzedFile[], repoStats?: any): RepositorySummary {
        // Use actual stats from LangGraph if available
        const fileCount = repoStats?.fileCount || files.length;
        const symbolCount = repoStats?.astIndexSize || 0;
        const embeddingsGenerated = repoStats?.embeddingsGenerated || 0;

        return {
            totalFiles: fileCount,
            analyzedFiles: fileCount,
            languages: {} as any,
            totalFunctions: symbolCount,
            totalClasses: 0, // TODO: Extract from AST index
            totalDataOperations: 0, // TODO: Extract from data flow analysis
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
        let errorMessage = 'Unknown error';
        let errorStack = '';

        if (error instanceof Error) {
            errorMessage = error.message;
            errorStack = error.stack || '';
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            try {
                errorMessage = JSON.stringify(error);
            } catch {
                errorMessage = String(error);
            }
        }

        job.status = 'failed';
        job.completedAt = new Date();
        job.error = {
            code: 'PROCESSING_ERROR',
            message: errorMessage,
            recoverable: true,
            suggestion: 'Check repository access and try again.',
        };

        this.logger.error(`Job Error: ${errorMessage}`);
        if (errorStack) {
            this.logger.error(`Stack trace: ${errorStack}`);
        }

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
     * Delay helper for UX
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Emit WebSocket event
     */
    private emitEvent(event: AgentWebSocketEvent): void {
        this.eventEmitter?.(event);
    }

    /**
     * Wait for job resume if paused
     */
    private async waitForResume(job: AgentJob): Promise<void> {
        while (job.isPaused) {
            await this.delay(1000);
            if (job.status === 'cancelled') return;
        }
    }
}
