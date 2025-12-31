import { Module } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { PlanCodeAgentOrchestrator } from './plan-code-agent.orchestrator';
import { ASTParserService } from './ast-parser.service';
import { DataFlowAnalyzerService } from './data-flow-analyzer.service';
import { SemanticMatchingService } from './semantic-matching.service';
import { ParallelAnalyzerService } from './parallel-analyzer.service';
import { MappingMetricsService } from './mapping-metrics.service';
import { ChromaDBCloudService } from './services/chromadb-cloud.service';
import { MappingOrchestrator } from './langgraph/orchestrator/mapping.orchestrator';

@Module({
    controllers: [AgentController],
    providers: [
        PlanCodeAgentOrchestrator,
        ASTParserService,
        DataFlowAnalyzerService,
        SemanticMatchingService,
        ParallelAnalyzerService,
        MappingMetricsService,
        ChromaDBCloudService,
        MappingOrchestrator
    ],
    exports: [
        PlanCodeAgentOrchestrator,
        ASTParserService,
        DataFlowAnalyzerService,
        SemanticMatchingService,
        ParallelAnalyzerService,
        MappingMetricsService,
        ChromaDBCloudService,
        MappingOrchestrator
    ],
})
export class AgentModule { }
