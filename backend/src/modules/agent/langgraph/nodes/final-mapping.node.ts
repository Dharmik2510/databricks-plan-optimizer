/**
 * Node 7: final_mapping_node
 *
 * Purpose: Persist results and emit UI-friendly output
 *
 * This node:
 * - Builds final mapping output schema
 * - Persists to database
 * - Appends to completedMappings
 * - Emits event for streaming
 *
 * Input: All state fields
 * Output: completedMappings (appended)
 */

import { MappingState, MappingOutput } from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';

// ============================================================================
// Main Node Function
// ============================================================================

export async function finalMappingNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const logger = new Logger('FinalMappingNode');

  try {
    const {
      currentDagNode,
      finalMapping,
      confidence,
      explanation,
      alternatives,
      semanticDescription,
      filteredCandidates,
      jobId,
    } = state;

    if (!currentDagNode) {
      throw new Error('currentDagNode is required');
    }

    logger.log(`Finalizing mapping for DAG node: ${currentDagNode.id}`);

    // Step 1: Build mapping output
    const mappingOutput: MappingOutput = {
      dagNodeId: currentDagNode.id,
      mappedCode: finalMapping || {
        file: 'unknown',
        symbol: 'unknown',
        lines: '0-0',
      },
      confidence,
      explanation,
      alternatives: alternatives || [],
      metadata: {
        operatorType: semanticDescription?.operatorType || 'Unknown',
        embeddingScore:
          filteredCandidates.find(
            (c) =>
              c.file === finalMapping?.file && c.symbol === finalMapping?.symbol,
          )?.embeddingScore || 0,
        astScore:
          filteredCandidates.find(
            (c) =>
              c.file === finalMapping?.file && c.symbol === finalMapping?.symbol,
          )?.astScore || 0,
        processedAt: new Date().toISOString(),
        processingDuration: state.metadata?.reasoningDuration || 0,
      },
    };

    // Step 2: Persist to database
    await persistMapping(jobId, mappingOutput);

    // Step 3: Emit streaming event
    await emitMappingEvent(jobId, mappingOutput);

    logger.log(
      `Mapping finalized: ${finalMapping?.symbol || 'none'} (confidence: ${confidence.toFixed(2)})`,
    );

    // Step 4: Return updated state
    return {
      completedMappings: [mappingOutput], // Will be appended by reducer
    };
  } catch (error) {
    logger.error('Failed to finalize mapping', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Persist mapping to database
 */
async function persistMapping(
  jobId: string,
  mapping: MappingOutput,
): Promise<void> {
  const logger = new Logger('PersistMapping');

  try {
    // TODO: Integrate with database service
    logger.log(`Persisting mapping for ${mapping.dagNodeId} to database`);

    // Example SQL:
    // INSERT INTO code_mappings (job_id, dag_node_id, file, symbol, lines, confidence, explanation, alternatives, metadata)
    // VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  } catch (error) {
    logger.error('Database persistence failed', error);
    // Retry logic
    throw error;
  }
}

/**
 * Emit mapping event for real-time streaming to frontend
 */
async function emitMappingEvent(
  jobId: string,
  mapping: MappingOutput,
): Promise<void> {
  const logger = new Logger('EmitMappingEvent');

  try {
    // TODO: Integrate with WebSocket/EventEmitter
    logger.log(`Emitting mapping event for ${mapping.dagNodeId}`);

    // Example:
    // eventEmitter.emit('mapping_completed', {
    //   jobId,
    //   dagNodeId: mapping.dagNodeId,
    //   result: mapping,
    // });
  } catch (error) {
    logger.warn('Failed to emit mapping event', error);
    // Non-fatal: continue without event
  }
}

/**
 * Validate mapping output before persistence
 */
export function validateMappingOutput(output: MappingOutput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!output.dagNodeId) {
    errors.push('Missing dagNodeId');
  }

  if (!output.mappedCode) {
    errors.push('Missing mappedCode');
  }

  if (output.confidence < 0 || output.confidence > 1) {
    errors.push('Invalid confidence score (must be 0-1)');
  }

  if (!output.explanation) {
    errors.push('Missing explanation');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
