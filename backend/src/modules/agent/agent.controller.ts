import { Controller, Post, Body, Get, Param, NotFoundException, InternalServerErrorException, UseGuards, Sse, MessageEvent, Query } from '@nestjs/common';
import { Observable, interval, map, takeWhile, switchMap, startWith } from 'rxjs';
import { PlanCodeAgentOrchestrator } from './plan-code-agent.orchestrator';
import { CreateAgentJobRequest } from './agent-types';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, CurrentUserData } from '../../common/decorators';

@Controller('agent')
export class AgentController {
    constructor(private readonly orchestrator: PlanCodeAgentOrchestrator) { }

    @Post('jobs')
    @UseGuards(JwtAuthGuard)
    async createJob(
        @CurrentUser() user: CurrentUserData,
        @Body() request: CreateAgentJobRequest
    ) {
        try {
            // Basic validation handled by DTO/Interfaces, but can add more
            // Pass authenticated user ID to the orchestrator
            const job = await this.orchestrator.createJob(request, user.id);
            return job;
        } catch (e: any) {
            throw new InternalServerErrorException(e.message);
        }
    }

    @Get('jobs/:id')
    @UseGuards(JwtAuthGuard)
    async getJob(@Param('id') id: string) {
        const job = this.orchestrator.getJob(id);
        if (!job) {
            throw new NotFoundException(`Job ${id} not found`);
        }
        return job;
    }

    @Post('jobs/:id/cancel')
    @UseGuards(JwtAuthGuard)
    async cancelJob(@Param('id') id: string) {
        const success = this.orchestrator.cancelJob(id);
        if (!success) {
            throw new NotFoundException(`Job ${id} not found or cannot be cancelled`);
        }
        return { success: true };
    }

    @Post('jobs/:id/pause')
    @UseGuards(JwtAuthGuard)
    async pauseJob(@Param('id') id: string) {
        const success = this.orchestrator.pauseJob(id);
        if (!success) {
            throw new NotFoundException(`Job ${id} not found or cannot be paused`);
        }
        return { success: true, status: 'paused' };
    }

    @Post('jobs/:id/resume')
    @UseGuards(JwtAuthGuard)
    async resumeJob(@Param('id') id: string) {
        const success = this.orchestrator.resumeJob(id);
        if (!success) {
            throw new NotFoundException(`Job ${id} not found or cannot be resumed`);
        }
        return { success: true, status: 'running' };
    }

    /**
     * SSE endpoint for streaming job progress
     * GET /api/v1/agent/jobs/:id/stream
     * 
     * Note: No auth guard since EventSource API cannot send Authorization headers.
     * Authentication is done via query parameter token.
     */
    @Sse('jobs/:id/stream')
    streamJobProgress(
        @Param('id') jobId: string,
        @Query('token') token?: string
    ): Observable<MessageEvent> {
        let lastProgress = '';
        let sentJobStarted = false;

        return interval(1000).pipe(
            startWith(0), // Emit immediately
            switchMap(async () => {
                const job = this.orchestrator.getJob(jobId);
                if (!job) {
                    return {
                        type: 'error',
                        timestamp: new Date().toISOString(),
                        data: {
                            error: {
                                code: 'JOB_NOT_FOUND',
                                message: `Job ${jobId} not found`,
                                retryable: false,
                            },
                        },
                    };
                }

                // Send job_started event first time
                if (!sentJobStarted) {
                    sentJobStarted = true;
                    return {
                        type: 'job_started',
                        timestamp: new Date().toISOString(),
                        data: {
                            jobId: job.id,
                            totalNodes: job.progress.totalStages,
                            repoUrl: job.repoConfig.url,
                            commitHash: job.repoConfig.commitHash,
                        },
                    };
                }

                // Emit job status as SSE event when completed/failed
                if (job.status === 'completed' || job.status === 'failed') {
                    return {
                        type: job.status === 'completed' ? 'job_completed' : 'error',
                        timestamp: new Date().toISOString(),
                        data: {
                            jobId: job.id,
                            status: job.status,
                            result: job.result,
                            statistics: job.result ? {
                                totalNodes: job.result.mappings?.length || 0,
                                mappedNodes: job.result.mappings?.filter(m => m.confidence > 0).length || 0,
                                confirmedMappings: job.result.mappings?.filter(m => m.confidence >= 75).length || 0,
                                probableMappings: job.result.mappings?.filter(m => m.confidence >= 50 && m.confidence < 75).length || 0,
                                unmappedNodes: job.result.mappings?.filter(m => m.confidence < 50).length || 0,
                                filesScanned: job.result.repositoryAnalysis?.totalFiles || 0,
                                symbolsIndexed: job.result.repositoryAnalysis?.totalFunctions || 0,
                            } : null,
                        },
                    };
                }

                // Generate stage_started event when phase changes
                const currentProgress = JSON.stringify({
                    phase: job.progress.currentPhase,
                    stagesMapped: job.progress.stagesMapped,
                    percentage: job.progress.percentage,
                });

                if (currentProgress !== lastProgress) {
                    lastProgress = currentProgress;

                    // Send stage_started event for current phase
                    return {
                        type: 'stage_started',
                        timestamp: new Date().toISOString(),
                        data: {
                            stage: this.getStageIdFromPhase(job.progress.currentPhase),
                            message: job.progress.currentPhase,
                            progress: {
                                stagesMapped: job.progress.stagesMapped,
                                totalStages: job.progress.totalStages,
                                percentage: job.progress.percentage,
                            },
                        },
                    };
                }

                // Emit regular progress event
                return {
                    type: 'stage_progress',
                    timestamp: new Date().toISOString(),
                    data: {
                        jobId: job.id,
                        status: job.status,
                        stage: this.getStageIdFromPhase(job.progress.currentPhase),
                        message: job.progress.currentPhase,
                        progress: {
                            stagesMapped: job.progress.stagesMapped,
                            totalStages: job.progress.totalStages,
                            percentage: job.progress.percentage,
                            currentFile: job.progress.currentFile,
                        },
                    },
                };
            }),
            map((event) => ({ data: event } as MessageEvent)),
            takeWhile((event) => {
                const data = (event.data as any);
                return data.type !== 'job_completed' && data.type !== 'error';
            }, true),
        );
    }

    private getStageIdFromPhase(phase: string): string {
        const phaseMap: Record<string, string> = {
            'Initializing LangGraph AI agent...': 'initialization',
            'Preparing DAG nodes...': 'prepare_nodes',
            'Executing LangGraph workflow...': 'langgraph_execution',
            'Generating results...': 'generate_results',
        };
        return phaseMap[phase] || 'processing';
    }
}
