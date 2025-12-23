import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { PlanCodeAgentOrchestrator } from './plan-code-agent.orchestrator';

@Module({
    controllers: [AgentController],
    providers: [PlanCodeAgentOrchestrator],
    exports: [PlanCodeAgentOrchestrator],
})
export class AgentModule { }
