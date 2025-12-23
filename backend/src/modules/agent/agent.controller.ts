import { Controller, Post, Body, Get, Param, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PlanCodeAgentOrchestrator } from './plan-code-agent.orchestrator';
import { CreateAgentJobRequest } from './agent-types';

@Controller('agent')
export class AgentController {
    constructor(private readonly orchestrator: PlanCodeAgentOrchestrator) { }

    @Post('jobs')
    async createJob(@Body() request: CreateAgentJobRequest) {
        try {
            // Basic validation handled by DTO/Interfaces, but can add more
            const job = await this.orchestrator.createJob(request);
            return job;
        } catch (e: any) {
            throw new InternalServerErrorException(e.message);
        }
    }

    @Get('jobs/:id')
    async getJob(@Param('id') id: string) {
        const job = this.orchestrator.getJob(id);
        if (!job) {
            throw new NotFoundException(`Job ${id} not found`);
        }
        return job;
    }

    @Post('jobs/:id/cancel')
    async cancelJob(@Param('id') id: string) {
        const success = this.orchestrator.cancelJob(id);
        if (!success) {
            throw new NotFoundException(`Job ${id} not found or cannot be cancelled`);
        }
        return { success: true };
    }
}
