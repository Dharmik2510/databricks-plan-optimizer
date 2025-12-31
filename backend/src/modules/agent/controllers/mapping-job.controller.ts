/**
 * API Controller for DAG → Code Mapping Jobs
 *
 * Endpoints:
 * - POST /api/agent/map-to-code - Create mapping job
 * - GET /api/agent/jobs/:jobId - Get job status
 * - DELETE /api/agent/jobs/:jobId - Cancel job
 * - GET /api/agent/jobs/:jobId/stream - Stream job results (SSE)
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, interval, map, switchMap, takeWhile } from 'rxjs';
import { MappingOrchestrator, CreateMappingJobRequest } from '../langgraph/orchestrator/mapping.orchestrator';
import { Logger } from '@nestjs/common';

// ============================================================================
// DTOs
// ============================================================================

class CreateMappingJobDto {
  analysisId: string;
  repoUrl: string;
  commitHash?: string;
  githubToken?: string;
  dagNodes: any[];
}

class JobResponse {
  jobId: string;
  status: string;
}

// ============================================================================
// Controller
// ============================================================================

@Controller('api/agent')
export class MappingJobController {
  private readonly logger = new Logger(MappingJobController.name);

  constructor(private readonly orchestrator: MappingOrchestrator) {}

  /**
   * POST /api/agent/map-to-code
   *
   * Create a new mapping job (async)
   *
   * Returns 202 Accepted with job ID
   */
  @Post('map-to-code')
  @HttpCode(HttpStatus.ACCEPTED)
  async createMappingJob(@Body() dto: CreateMappingJobDto): Promise<JobResponse> {
    this.logger.log('Received map-to-code request');

    // Validate input
    if (!dto.repoUrl) {
      throw new BadRequestException('repoUrl is required');
    }

    if (!dto.dagNodes || dto.dagNodes.length === 0) {
      throw new BadRequestException('dagNodes must contain at least one node');
    }

    // Create job
    const { jobId } = await this.orchestrator.createJob({
      analysisId: dto.analysisId,
      repoUrl: dto.repoUrl,
      commitHash: dto.commitHash,
      githubToken: dto.githubToken,
      dagNodes: dto.dagNodes,
    });

    this.logger.log(`Created mapping job: ${jobId}`);

    return {
      jobId,
      status: 'submitted',
    };
  }

  /**
   * GET /api/agent/jobs/:jobId
   *
   * Get job status and results
   *
   * Returns 200 OK with job status
   */
  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    this.logger.log(`Getting status for job: ${jobId}`);

    const status = await this.orchestrator.getJobStatus(jobId);

    if (!status) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return status;
  }

  /**
   * DELETE /api/agent/jobs/:jobId
   *
   * Cancel running job
   *
   * Returns 200 OK
   */
  @Delete('jobs/:jobId')
  async cancelJob(@Param('jobId') jobId: string): Promise<{ message: string }> {
    this.logger.log(`Cancelling job: ${jobId}`);

    await this.orchestrator.cancelJob(jobId);

    return {
      message: `Job ${jobId} cancelled`,
    };
  }

  /**
   * GET /api/agent/jobs/:jobId/stream
   *
   * Server-Sent Events stream of job progress
   *
   * Emits job status updates in real-time
   */
  @Sse('jobs/:jobId/stream')
  streamJobProgress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    this.logger.log(`Streaming job progress: ${jobId}`);

    // Poll job status every 2 seconds
    return interval(2000).pipe(
      switchMap(async () => {
        const status = await this.orchestrator.getJobStatus(jobId);

        if (!status) {
          throw new NotFoundException(`Job ${jobId} not found`);
        }

        return status;
      }),
      takeWhile((status) => status.status === 'running' || status.status === 'pending', true),
      map((status) => ({
        data: status,
      })),
    );
  }

  /**
   * GET /api/agent/health
   *
   * Health check endpoint
   */
  @Get('health')
  async healthCheck() {
    return {
      status: 'healthy',
      langgraph: 'operational',
      timestamp: new Date().toISOString(),
    };
  }
}
