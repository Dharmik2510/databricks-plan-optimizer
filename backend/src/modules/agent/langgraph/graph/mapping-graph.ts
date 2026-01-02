/**
 * LangGraph Workflow Definition for DAG → Code Mapping
 *
 * This file defines the complete graph structure:
 * - Nodes (processing steps)
 * - Edges (transitions)
 * - Conditional routing (based on confidence)
 * - State management
 *
 * Graph Flow:
 * START → load_repo → plan_semantics → embedding_retrieval → ast_filter
 *   → reasoning_agent → confidence_gate → [high/medium/low] → final_mapping → END
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { MappingStateAnnotation, MappingState } from '../state/mapping-state.schema';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

// Import nodes
import { loadRepoContextNode } from '../nodes/load-repo-context.node';
import { planSemanticsNode } from '../nodes/plan-semantics.node';
import { embeddingRetrievalNode } from '../nodes/embedding-retrieval.node';
import { astFilterNode } from '../nodes/ast-filter.node';
import { reasoningAgentNode } from '../nodes/reasoning-agent.node';
import { confidenceGateNode, routeByConfidence } from '../nodes/confidence-gate.node';
import { finalMappingNode } from '../nodes/final-mapping.node';
import { Logger } from '@nestjs/common';
import { WorkflowLoggerService } from '../../../../common/logging/workflow-logger.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AppLoggerService } from '../../../../common/logging/app-logger.service';

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Create the mapping graph workflow
 *
 * This graph processes a SINGLE DAG node. For multiple DAG nodes,
 * invoke this graph in parallel (handled by orchestrator).
 */
export function createMappingGraph() {
  const logger = new Logger('MappingGraph');

  logger.log('Building LangGraph workflow...');

  const workflow = new StateGraph(MappingStateAnnotation)
    // ========================================================================
    // Add Nodes
    // ========================================================================
    .addNode('load_repo', loadRepoContextNode)
    .addNode('plan_semantics', planSemanticsNode)
    .addNode('embedding_retrieval', embeddingRetrievalNode)
    .addNode('ast_filter', astFilterNode)
    .addNode('reasoning_agent', reasoningAgentNode)
    .addNode('confidence_gate', confidenceGateNode)
    .addNode('final_mapping', finalMappingNode)

    // ========================================================================
    // Define Linear Edges (Sequential Flow)
    // ========================================================================
    .addEdge(START, 'load_repo')
    .addEdge('load_repo', 'plan_semantics')
    .addEdge('plan_semantics', 'embedding_retrieval')
    .addEdge('embedding_retrieval', 'ast_filter')
    .addEdge('ast_filter', 'reasoning_agent')
    .addEdge('reasoning_agent', 'confidence_gate')

    // ========================================================================
    // Conditional Routing (Based on Confidence)
    // ========================================================================
    .addConditionalEdges(
      'confidence_gate',
      routeByConfidence,
      {
        finalize: 'final_mapping',
        finalize_with_alternatives: 'final_mapping',
        unresolved: 'final_mapping',
      },
    )

    // ========================================================================
    // Final Edge to END
    // ========================================================================
    .addEdge('final_mapping', END);

  logger.log('LangGraph workflow built successfully');

  return workflow;
}

/**
 * Create Supabase checkpointer for state persistence
 */
async function createSupabaseCheckpointer() {
  const logger = new Logger('CreateCheckpointer');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for checkpointer');
  }

  logger.log('Creating Supabase checkpointer');

  const checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL);

  // Setup tables (creates checkpoints and checkpoint_writes tables)
  await checkpointer.setup();
  logger.log('Checkpointer tables created/verified');

  return checkpointer;
}

/**
 * Compile the graph with Supabase checkpointer
 *
 * This enables:
 * - State persistence in Supabase
 * - Resume from failure
 * - Audit trail of all state transitions
 */
export async function compileGraphWithSupabase() {
  const logger = new Logger('CompileGraph');

  const workflow = createMappingGraph();
  const checkpointer = await createSupabaseCheckpointer();

  const compiledGraph = workflow.compile({
    checkpointer,
  });

  logger.log('Graph compiled successfully with Supabase checkpointer');

  return compiledGraph;
}

/**
 * Compile the graph with production configuration
 *
 * Options:
 * - checkpointer: PostgreSQL state persistence
 * - enableRetries: Node-level retry configuration
 */
export function compileGraph(options?: {
  checkpointer?: any;
  enableRetries?: boolean;
}) {
  const logger = new Logger('CompileGraph');

  const workflow = createMappingGraph();

  const compileOptions: any = {};

  // Add checkpointer for state persistence
  if (options?.checkpointer) {
    compileOptions.checkpointer = options.checkpointer;
    logger.log('Graph compiled with checkpointer (persistent state)');
  } else {
    logger.warn('No checkpointer provided - state is in-memory only');
  }

  const compiledGraph = workflow.compile(compileOptions);

  logger.log('Graph compiled successfully');

  return compiledGraph;
}

/**
 * Invoke graph with error handling and logging
 *
 * Enhanced with Phase 2 workflow observability:
 * - Creates workflow_runs record
 * - Tracks workflow execution (start, complete, error)
 * - Persists workflow metadata to database
 */
export async function invokeGraph(
  graph: any,
  initialState: Partial<MappingState>,
): Promise<MappingState> {
  const logger = new Logger('InvokeGraph');

  // Initialize workflow logger
  const appLogger = new AppLoggerService();
  const prisma = new PrismaService();
  const workflowLogger = new WorkflowLoggerService(appLogger, prisma);

  let workflowRunId: string | undefined;

  try {
    logger.log(`Invoking graph for job: ${initialState.jobId}`);

    // Start workflow tracking
    workflowRunId = await workflowLogger.startWorkflow({
      workflowName: 'dag-to-code-mapping',
      workflowVersion: '1.0',
      input: {
        jobId: initialState.jobId,
        analysisId: initialState.analysisId,
        dagNodeId: initialState.currentDagNode?.id,
        repoUrl: initialState.repoUrl,
      },
      tags: ['mapping', 'langgraph'],
      analysisId: initialState.analysisId,
      jobId: initialState.jobId,
    });

    // Add workflowRunId to state for node tracking
    const stateWithWorkflowId = {
      ...initialState,
      workflowRunId,
    };

    // Invoke with thread_id for checkpointing
    const result = await graph.invoke(stateWithWorkflowId, {
      configurable: {
        thread_id: initialState.jobId, // Use jobId as thread_id
      },
    });

    logger.log(`Graph execution completed for job: ${initialState.jobId}`);

    // Complete workflow tracking
    await workflowLogger.completeWorkflow(workflowRunId, {
      mappingOutput: result.mappingOutput,
      confidence: result.confidence,
    }, {
      dagNodeId: initialState.currentDagNode?.id,
      status: result.status,
    });

    return result as MappingState;
  } catch (error) {
    logger.error('Graph execution failed', error);

    // Record workflow failure
    if (workflowRunId) {
      await workflowLogger.failWorkflow(workflowRunId, error as Error, {
        dagNodeId: initialState.currentDagNode?.id,
      });
    }

    throw error;
  }
}

/**
 * Stream graph execution with partial results
 *
 * Emits state after each node completion
 * Enhanced with Phase 2 workflow observability
 */
export async function* streamGraph(
  graph: any,
  initialState: Partial<MappingState>,
): AsyncGenerator<{ node: string; state: Partial<MappingState> }> {
  const logger = new Logger('StreamGraph');

  // Initialize workflow logger
  const appLogger = new AppLoggerService();
  const prisma = new PrismaService();
  const workflowLogger = new WorkflowLoggerService(appLogger, prisma);

  let workflowRunId: string | undefined;

  try {
    logger.log(`Streaming graph for job: ${initialState.jobId}`);

    // Start workflow tracking
    workflowRunId = await workflowLogger.startWorkflow({
      workflowName: 'dag-to-code-mapping',
      workflowVersion: '1.0',
      input: {
        jobId: initialState.jobId,
        analysisId: initialState.analysisId,
        dagNodeId: initialState.currentDagNode?.id,
        repoUrl: initialState.repoUrl,
      },
      tags: ['mapping', 'langgraph', 'streaming'],
      analysisId: initialState.analysisId,
      jobId: initialState.jobId,
    });

    // Add workflowRunId to state
    const stateWithWorkflowId = {
      ...initialState,
      workflowRunId,
    };

    // Track node execution times
    const nodeStartTimes = new Map<string, number>();

    for await (const chunk of graph.stream(stateWithWorkflowId)) {
      const nodeName = Object.keys(chunk)[0];
      const nodeState = chunk[nodeName];

      logger.log(`Node completed: ${nodeName}`);

      // Log node completion (if we tracked start time)
      const startTime = nodeStartTimes.get(nodeName);
      if (startTime) {
        const durationMs = Date.now() - startTime;
        await workflowLogger.logNodeComplete(
          workflowRunId!,
          nodeName,
          nodeName,
          'langgraph_node',
          nodeState,
          startTime,
        );
      } else {
        // Log as completed without start time
        await workflowLogger.logNodeComplete(
          workflowRunId!,
          nodeName,
          nodeName,
          'langgraph_node',
          nodeState,
        );
      }

      yield {
        node: nodeName,
        state: nodeState,
      };
    }

    logger.log(`Graph streaming completed for job: ${initialState.jobId}`);

    // Complete workflow
    if (workflowRunId) {
      await workflowLogger.completeWorkflow(workflowRunId, undefined, {
        dagNodeId: initialState.currentDagNode?.id,
        streaming: true,
      });
    }
  } catch (error) {
    logger.error('Graph streaming failed', error);

    // Record workflow failure
    if (workflowRunId) {
      await workflowLogger.failWorkflow(workflowRunId, error as Error, {
        dagNodeId: initialState.currentDagNode?.id,
        streaming: true,
      });
    }

    throw error;
  }
}
