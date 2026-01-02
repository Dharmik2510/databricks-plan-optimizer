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
    `Groups data by ${node.keys?.join(', ') || 'keys'} and applies aggregate functions: ${node.aggregations?.map((a: any) => a.func).join(', ') || 'none'}. In PySpark this corresponds to .groupBy().agg() or .agg() method calls.`,

  Filter: (node) =>
    `Filters rows based on conditions: ${node.filters?.map((f: any) => `${f.col} ${f.op} ${f.val}`).join(' AND ') || 'predicate'}. In PySpark this corresponds to .filter() or .where() method calls.`,

  Sort: (node) =>
    `Sorts data by columns: ${node.sortColumns?.join(', ') || 'unspecified'}. In PySpark this corresponds to .orderBy() or .sort() method calls. This may also be an internal sort for aggregation operations.`,

  Exchange: (node) =>
    `Shuffles data for distribution (partitioning operation). In PySpark this corresponds to .repartition() or .coalesce() method calls.`,

  Project: (node) =>
    `Projects/selects specific columns from dataset. In PySpark this corresponds to .select(), .withColumn(), or .alias() method calls.`,

  BroadcastHashJoin: (node) =>
    `Performs broadcast hash join on keys: ${node.keys?.join(', ') || 'join keys'}. In PySpark this corresponds to .join() with broadcast hint or automatic broadcast.`,

  SortMergeJoin: (node) =>
    `Performs sort-merge join on keys: ${node.keys?.join(', ') || 'join keys'}. In PySpark this corresponds to standard .join() on large datasets.`,

  Scan: (node) =>
    `Scans data source (table or file). In PySpark this corresponds to spark.read.table() or spark.read.format().load().`,

  Union: (node) =>
    `Combines multiple datasets. In PySpark this corresponds to .union() or .unionByName().`,

  Limit: (node) =>
    `Limits result to specified number of rows. In PySpark this corresponds to .limit().`,

  Window: (node) =>
    `Applies window function over partitioned data. In PySpark this corresponds to Window.partitionBy() usage.`,
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
      OPERATOR_BEHAVIORS[operatorType] ||
      ((node: any) => `Performs ${node.operator || 'data transformation'} operation on dataset`);
    const executionBehavior = behaviorFn(currentDagNode);

    // Extract data transformation details
    const dataTransformation = extractDataTransformation(currentDagNode);

    // Build Spark operator signature (embedding-friendly)
    const sparkOperatorSignature = buildOperatorSignature(
      currentDagNode,
      executionBehavior,
    );

    // Create semantic description
    const nodeClassification = classifyNode(operatorType);

    const semanticDescription: SemanticDescription = {
      dagNodeId: currentDagNode.id,
      operatorType,
      executionBehavior,
      dataTransformation,
      sparkOperatorSignature,
      nodeClassification,
    };

    logger.log(`Semantic description: ${semanticDescription.executionBehavior} (${nodeClassification})`);

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
 * Format: "<operator> <action> <keywords> <table_names> <column_names>"
 */
function buildOperatorSignature(node: any, behavior: string): string {
  // Use structured format for precise retrieval: OP: <Type> KEYS: <...> AGG: <...> COLS: <...>
  const parts: string[] = [`OP: ${node.operator}`];

  // Extract table names and schemas
  const tableNames = extractTableNames(node.physicalPlanFragment || '');
  const inputColumns = extractInputSchema(node);
  const outputColumns = extractOutputSchema(node);

  // 1. Keys
  if (node.keys && node.keys.length > 0) {
    parts.push(`KEYS: ${node.keys.join(', ')}`);
  }

  // 2. Aggregations / Functions
  if (node.aggregations && node.aggregations.length > 0) {
    parts.push(`AGG: ${node.aggregations.map((a: any) => a.func).join(', ')}`);
  }

  // 3. Filter Conditions
  if (node.filters && node.filters.length > 0) {
    parts.push(`FILTERS: ${node.filters.map((f: any) => `${f.col} ${f.op}`).join(', ')}`);
  }

  // 4. Sort Columns
  if (node.sortColumns && node.sortColumns.length > 0) {
    parts.push(`SORT: ${node.sortColumns.join(', ')}`);
  }

  // 5. Input Columns (Context)
  if (inputColumns.length > 0) {
    // Limit to avoid token overflow, but include enough for matching
    parts.push(`INPUT_COLS: ${inputColumns.slice(0, 10).join(', ')}`);
  }

  // 6. Keywords (Legacy support + explicit intent)
  const keywords: string[] = [];
  switch (node.operator) {
    case 'HashAggregate': keywords.push('groupBy', 'aggregate', 'count', 'sum', 'avg'); break;
    case 'Filter': keywords.push('filter', 'where'); break;
    case 'Sort': keywords.push('orderBy', 'sort'); break;
    case 'BroadcastHashJoin':
    case 'SortMergeJoin': keywords.push('join'); break;
    case 'Project': keywords.push('select', 'withColumn'); break;
    case 'Scan': keywords.push('read', 'load', 'table'); break;
    default: keywords.push('transform');
  }
  // Add table names as keywords for context
  if (tableNames.length > 0) keywords.push(...tableNames);

  parts.push(`KEYWORDS: ${keywords.join(' ')}`);

  return parts.join('\n');
}

/**
 * Extract table names from physical plan fragment
 */
function extractTableNames(planFragment: string): string[] {
  const tableNames: string[] = [];

  // Match common table patterns in Spark plans
  // Pattern 1: FileScan parquet/delta table_name
  const fileScanMatch = planFragment.match(/FileScan\s+(?:parquet|delta|orc|csv)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  if (fileScanMatch) {
    tableNames.push(fileScanMatch[1]);
  }

  // Pattern 2: Scan table_name or Scan <catalog>.<schema>.<table>
  const scanMatches = planFragment.matchAll(/Scan\s+(?:table\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)/g);
  for (const match of scanMatches) {
    const tableName = match[1].split('.').pop(); // Get last part if qualified
    if (tableName && !tableNames.includes(tableName)) {
      tableNames.push(tableName);
    }
  }

  // Pattern 3: Relation[table_name]
  const relationMatch = planFragment.match(/Relation\[([a-zA-Z_][a-zA-Z0-9_]*)\]/);
  if (relationMatch && !tableNames.includes(relationMatch[1])) {
    tableNames.push(relationMatch[1]);
  }

  return tableNames;
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

/**
 * Classify node as CODE_OWNED or DERIVED
 */
function classifyNode(operatorType: string): 'CODE_OWNED' | 'DERIVED' {
  if (!operatorType) return 'CODE_OWNED';

  const DERIVED_OPS = [
    'Exchange',
    'ShuffleExchange',
    'BroadcastExchange',
    'AdaptiveSparkPlan',
    'WholeStageCodegen',
    'ColumnarToRow',
    'RowToColumnar',
    'Coalesce'
  ];

  const op = operatorType.trim();

  // Check if operator type contains any derived keyword
  if (DERIVED_OPS.some(derived => op.includes(derived))) {
    return 'DERIVED';
  }

  return 'CODE_OWNED';
}
