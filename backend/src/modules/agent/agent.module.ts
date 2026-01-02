import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { PlanCodeAgentOrchestrator } from './plan-code-agent.orchestrator';
import { ASTParserService } from './ast-parser.service';
import { ChromaDBCloudService } from './services/chromadb-cloud.service';
import { MappingOrchestrator } from './langgraph/orchestrator/mapping.orchestrator';

@Module({
    controllers: [AgentController],
    providers: [
        PlanCodeAgentOrchestrator,
        ASTParserService,
        ChromaDBCloudService,
        MappingOrchestrator
    ],
    exports: [
        PlanCodeAgentOrchestrator,
        ASTParserService,
        ChromaDBCloudService,
        MappingOrchestrator
    ],
})
export class AgentModule { }
