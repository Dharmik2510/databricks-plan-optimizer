/**
 * Node 2: plan_semantics_node
 *
 * Purpose: Extract execution semantics from DAG node
 *
 * This node:
 * - Parses Spark operator type
 * - Extracts execution behavior (groupBy, filter, join, etc.)
 * - Builds natural language description
 * - Creates embedding-friendly signature
 *
 * Input: currentDagNode (physical plan fragment)
 * Output: semanticDescription (structured execution semantics)
 */

import { MappingState, SemanticDescription } from '../state/mapping-state.schema';
import { Logger } from '@nestjs/common';

// ============================================================================
// Operator Mapping
// ============================================================================

const OPERATOR_BEHAVIORS: Record<
  string,
  (node: any) => string
> = {
  HashAggregate: (node) =>
    `Groups data by ${node.keys?.join(', ') || 'keys'} and applies aggregate functions: ${node.aggregations?.map((a: any) => a.func).join(', ') || 'none'}`,

  Filter: (node) =>
    `Filters rows based on conditions: ${node.filters?.map((f: any) => `${f.col} ${f.op} ${f.val}`).join(' AND ') || 'predicate'}`,

  Sort: (node) =>
    `Sorts data by columns: ${node.sortColumns?.join(', ') || 'unspecified'}`,

  Exchange: (node) =>
    `Shuffles data for distribution (partitioning operation)`,

  Project: (node) =>
    `Projects/selects specific columns from dataset`,

  BroadcastHashJoin: (node) =>
    `Performs broadcast hash join on keys: ${node.keys?.join(', ') || 'join keys'}`,

  SortMergeJoin: (node) =>
    `Performs sort-merge join on keys: ${node.keys?.join(', ') || 'join keys'}`,

  Scan: (node) =>
    `Scans data source (table or file)`,

  Union: (node) =>
    `Combines multiple datasets`,

  Limit: (node) =>
    `Limits result to specified number of rows`,

  Window: (node) =>
    `Applies window function over partitioned data`,
};

// ============================================================================
// Main Node Function
// ============================================================================

export async function planSemanticsNode(
  state: MappingState,
): Promise<Partial<MappingState>> {
  const logger = new Logger('PlanSemanticsNode');

  try {
    const { currentDagNode } = state;

    if (!currentDagNode) {
      throw new Error('currentDagNode is required');
    }

    logger.log(`Planning semantics for DAG node: ${currentDagNode.id}`);

    // Extract operator type
    const operatorType = currentDagNode.operator;

    // Get execution behavior description
    const behaviorFn =
      OPERATOR_BEHAVIORS[operatorType] || OPERATOR_BEHAVIORS.Project;
    const executionBehavior = behaviorFn(currentDagNode);

    // Extract data transformation details
    const dataTransformation = extractDataTransformation(currentDagNode);

    // Build Spark operator signature (embedding-friendly)
    const sparkOperatorSignature = buildOperatorSignature(
      currentDagNode,
      executionBehavior,
    );

    // Create semantic description
    const semanticDescription: SemanticDescription = {
      dagNodeId: currentDagNode.id,
      operatorType,
      executionBehavior,
      dataTransformation,
      sparkOperatorSignature,
    };

    logger.log(`Semantic description: ${semanticDescription.executionBehavior}`);

    return {
      semanticDescription,
    };
  } catch (error) {
    logger.error('Failed to plan semantics', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract data transformation details from DAG node
 */
function extractDataTransformation(node: any): SemanticDescription['dataTransformation'] {
  return {
    inputSchema: extractInputSchema(node),
    outputSchema: extractOutputSchema(node),
    keyColumns: node.keys || [],
    aggregateFunctions: node.aggregations?.map((a: any) => a.func) || [],
    filterConditions: node.filters?.map((f: any) => `${f.col} ${f.op} ${f.val}`) || [],
  };
}

/**
 * Extract input schema from physical plan fragment
 */
function extractInputSchema(node: any): string[] {
  // Parse physical plan fragment for input columns
  // Example: "Input [customer_id#123, age#456, amount#789]"

  const planText = node.physicalPlanFragment || '';
  const inputMatch = planText.match(/Input \[(.*?)\]/);

  if (inputMatch) {
    return inputMatch[1]
      .split(',')
      .map((col: string) => col.trim().split('#')[0]);
  }

  return [];
}

/**
 * Extract output schema from physical plan fragment
 */
function extractOutputSchema(node: any): string[] {
  // Parse physical plan fragment for output columns
  const planText = node.physicalPlanFragment || '';
  const outputMatch = planText.match(/Output \[(.*?)\]/);

  if (outputMatch) {
    return outputMatch[1]
      .split(',')
      .map((col: string) => col.trim().split('#')[0]);
  }

  // Fallback: use input schema
  return extractInputSchema(node);
}

/**
 * Build embedding-friendly operator signature
 *
 * This signature is optimized for semantic similarity matching.
 * Format: "<operator> <action> <keywords>"
 */
function buildOperatorSignature(node: any, behavior: string): string {
  const parts: string[] = [node.operator];

  // Add action keywords
  switch (node.operator) {
    case 'HashAggregate':
      parts.push('groupBy');
      if (node.keys) parts.push(...node.keys);
      parts.push('aggregate');
      if (node.aggregations) {
        parts.push(...node.aggregations.map((a: any) => a.func));
      }
      break;

    case 'Filter':
      parts.push('filter', 'where');
      if (node.filters) {
        node.filters.forEach((f: any) => {
          parts.push(f.col, f.op);
        });
      }
      break;

    case 'Sort':
      parts.push('sort', 'orderBy');
      if (node.sortColumns) parts.push(...node.sortColumns);
      break;

    case 'BroadcastHashJoin':
    case 'SortMergeJoin':
      parts.push('join', 'on');
      if (node.keys) parts.push(...node.keys);
      break;

    case 'Project':
      parts.push('select', 'project');
      break;

    case 'Scan':
      parts.push('read', 'scan', 'source');
      break;

    default:
      parts.push(behavior);
  }

  return parts.join(' ');
}

/**
 * Enrich semantic description with additional context
 *
 * This function can be extended to add more domain-specific knowledge:
 * - Common Spark patterns (wide vs narrow transformations)
 * - Performance characteristics (shuffle vs non-shuffle)
 * - Data lineage hints
 */
export function enrichSemanticDescription(
  description: SemanticDescription,
  physicalPlan: string,
): SemanticDescription {
  // Check for shuffle operations
  const hasExchange = physicalPlan.includes('Exchange');

  // Check for broadcast
  const hasBroadcast = physicalPlan.includes('Broadcast');

  // Add to execution behavior
  let enrichedBehavior = description.executionBehavior;

  if (hasExchange) {
    enrichedBehavior += ' (involves shuffle operation)';
  }

  if (hasBroadcast) {
    enrichedBehavior += ' (uses broadcast join)';
  }

  return {
    ...description,
    executionBehavior: enrichedBehavior,
  };
}
