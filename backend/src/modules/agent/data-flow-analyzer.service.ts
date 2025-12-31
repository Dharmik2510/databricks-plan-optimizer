/**
 * Data Flow Analyzer Service - PRODUCTION READY
 *
 * Tracks data lineage and transformations through code with comprehensive error handling,
 * logging, and performance optimization.
 *
 * @production
 * @version 2.0.0
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    AnalyzedFile,
    DataOperation,
    TableReference,
    FunctionInfo
} from './agent-types';

export interface DataLineageGraph {
    nodes: LineageNode[];
    edges: LineageEdge[];
    metadata: {
        analyzedAt: Date;
        fileCount: number;
        totalNodes: number;
        totalEdges: number;
    };
}

export interface LineageNode {
    id: string;
    type: 'source' | 'transformation' | 'sink' | 'intermediate';
    name: string;
    filePath: string;
    line: number;
    format?: string;
    confidence: number; // 0-100
    metadata?: Record<string, any>;
}

export interface LineageEdge {
    id: string;
    from: string;
    to: string;
    operation: string;
    transformationType?: 'filter' | 'join' | 'aggregate' | 'transform' | 'union' | 'window';
    line: number;
    confidence: number; // 0-100
    metadata?: Record<string, any>;
}

export interface DataFlow {
    id: string;
    variable: string;
    source?: string;
    transformations: Transformation[];
    sink?: string;
    filePath: string;
    confidence: number;
}

export interface Transformation {
    id: string;
    type: string;
    line: number;
    code: string;
    inputVariable?: string;
    outputVariable?: string;
    confidence: number;
}

export interface FunctionLineage {
    functionName: string;
    filePath: string;
    sources: TableReference[];
    transformations: DataOperation[];
    sinks: TableReference[];
    dataFlows: DataFlow[];
    complexity: number;
    confidence: number;
}

@Injectable()
export class DataFlowAnalyzerService {
    private readonly logger = new Logger(DataFlowAnalyzerService.name);
    private nodeIdCounter = 0;
    private edgeIdCounter = 0;

    /**
     * Analyze data lineage across entire file with comprehensive error handling
     */
    analyzeDataLineage(file: AnalyzedFile): DataLineageGraph {
        const startTime = Date.now();

        try {
            this.logger.debug(`Analyzing data lineage for ${file.path}`);

            const graph: DataLineageGraph = {
                nodes: [],
                edges: [],
                metadata: {
                    analyzedAt: new Date(),
                    fileCount: 1,
                    totalNodes: 0,
                    totalEdges: 0
                }
            };

            // Track variable lineage
            const variableLineage = this.trackVariableLineage(file);

            // Build graph nodes
            this.buildSourceNodes(file, graph);
            this.buildTransformationNodes(file, graph);
            this.buildSinkNodes(file, graph);

            // Build graph edges
            this.buildLineageEdges(graph, variableLineage, file);

            // Update metadata
            graph.metadata.totalNodes = graph.nodes.length;
            graph.metadata.totalEdges = graph.edges.length;

            const duration = Date.now() - startTime;
            this.logger.log(
                `Lineage analysis completed for ${file.path}: ${graph.nodes.length} nodes, ${graph.edges.length} edges (${duration}ms)`
            );

            return graph;

        } catch (error) {
            this.logger.error(`Failed to analyze lineage for ${file.path}:`, error);
            return this.emptyGraph();
        }
    }

    /**
     * Build source nodes with validation
     */
    private buildSourceNodes(file: AnalyzedFile, graph: DataLineageGraph): void {
        for (const table of file.analysis.tableReferences) {
            if (table.operation === 'read') {
                const nodeId = this.generateNodeId(file.path, table.line, table.name);

                // Validate before adding
                if (!graph.nodes.find(n => n.id === nodeId)) {
                    graph.nodes.push({
                        id: nodeId,
                        type: 'source',
                        name: table.name,
                        filePath: file.path,
                        line: table.line,
                        format: table.format,
                        confidence: 90, // High confidence for explicit reads
                        metadata: {
                            schema: table.schema,
                            database: table.database
                        }
                    });
                }
            }
        }
    }

    /**
     * Build transformation nodes
     */
    private buildTransformationNodes(file: AnalyzedFile, graph: DataLineageGraph): void {
        for (const op of file.analysis.dataOperations) {
            if (op.type !== 'read' && op.type !== 'write') {
                const nodeId = this.generateNodeId(file.path, op.line, op.type);

                if (!graph.nodes.find(n => n.id === nodeId)) {
                    graph.nodes.push({
                        id: nodeId,
                        type: 'transformation',
                        name: op.type,
                        filePath: file.path,
                        line: op.line,
                        confidence: Math.round((op.confidence || 0.8) * 100),
                        metadata: {
                            code: op.code.substring(0, 200), // Limit code length
                            tables: op.tables,
                            columns: op.columns
                        }
                    });
                }
            }
        }
    }

    /**
     * Build sink nodes
     */
    private buildSinkNodes(file: AnalyzedFile, graph: DataLineageGraph): void {
        for (const table of file.analysis.tableReferences) {
            if (table.operation === 'write') {
                const nodeId = this.generateNodeId(file.path, table.line, table.name);

                if (!graph.nodes.find(n => n.id === nodeId)) {
                    graph.nodes.push({
                        id: nodeId,
                        type: 'sink',
                        name: table.name,
                        filePath: file.path,
                        line: table.line,
                        format: table.format,
                        confidence: 90,
                        metadata: {
                            schema: table.schema,
                            database: table.database
                        }
                    });
                }
            }
        }
    }

    /**
     * Track variable lineage through transformations - PRODUCTION READY
     */
    private trackVariableLineage(file: AnalyzedFile): Map<string, DataFlow> {
        const lineage = new Map<string, DataFlow>();
        const lines = file.content.split('\n');

        try {
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line.trim() || line.trim().startsWith('#')) continue;

                this.processAssignment(line, i, file.path, lineage);
                this.processChainedTransformation(line, i, lineage);
            }
        } catch (error) {
            this.logger.warn(`Error tracking variable lineage in ${file.path}:`, error);
        }

        return lineage;
    }

    /**
     * Process variable assignment
     */
    private processAssignment(
        line: string,
        lineIndex: number,
        filePath: string,
        lineage: Map<string, DataFlow>
    ): void {
        const assignMatch = line.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)/);
        if (!assignMatch) return;

        const [, variable, expression] = assignMatch;

        // Spark read operation
        if (this.isSparkRead(expression)) {
            const tableName = this.extractTableName(expression);
            const flowId = this.generateFlowId(filePath, lineIndex, variable);

            lineage.set(variable, {
                id: flowId,
                variable,
                source: tableName || 'unknown_source',
                transformations: [],
                filePath,
                confidence: tableName ? 95 : 60
            });
        }
        // Transformation of existing variable
        else {
            const sourceVar = this.extractSourceVariable(expression);
            if (sourceVar && lineage.has(sourceVar)) {
                const sourceFlow = lineage.get(sourceVar)!;
                const transformType = this.detectTransformationType(expression);
                const flowId = this.generateFlowId(filePath, lineIndex, variable);

                lineage.set(variable, {
                    id: flowId,
                    variable,
                    source: sourceFlow.source,
                    transformations: [
                        ...sourceFlow.transformations,
                        {
                            id: this.generateTransformId(filePath, lineIndex),
                            type: transformType,
                            line: lineIndex + 1,
                            code: line.trim().substring(0, 200),
                            inputVariable: sourceVar,
                            outputVariable: variable,
                            confidence: 85
                        }
                    ],
                    filePath,
                    confidence: Math.max(sourceFlow.confidence - 5, 50) // Slightly reduce confidence
                });
            }
        }

        // Write operation
        if (expression.includes('.write') || expression.includes('.saveAsTable')) {
            const sourceVar = this.extractSourceVariable(expression);
            if (sourceVar && lineage.has(sourceVar)) {
                const flow = lineage.get(sourceVar)!;
                flow.sink = this.extractTableName(expression) || 'unknown_sink';
            }
        }
    }

    /**
     * Process chained transformations
     */
    private processChainedTransformation(
        line: string,
        lineIndex: number,
        lineage: Map<string, DataFlow>
    ): void {
        const chainMatch = line.match(/([a-zA-Z_][a-zA-Z0-9_]*)\.(filter|select|join|groupBy|agg|withColumn|where|orderBy|distinct|union)/);
        if (!chainMatch) return;

        const [, variable, operation] = chainMatch;
        if (lineage.has(variable)) {
            const flow = lineage.get(variable)!;
            flow.transformations.push({
                id: this.generateTransformId(flow.filePath, lineIndex),
                type: operation,
                line: lineIndex + 1,
                code: line.trim().substring(0, 200),
                confidence: 80
            });
        }
    }

    /**
     * Check if expression is a Spark read
     */
    private isSparkRead(expression: string): boolean {
        return expression.includes('spark.read') ||
            expression.includes('.read(') ||
            expression.includes('.table(') ||
            expression.match(/\.(parquet|csv|json|delta|orc|avro)\(/) !== null;
    }

    /**
     * Extract table name from expression with multiple patterns
     */
    private extractTableName(expression: string): string | undefined {
        // Pattern 1: table("db.table")
        let match = expression.match(/table\s*\(\s*["']([a-zA-Z0-9_\.]+)["']\s*\)/);
        if (match) return match[1];

        // Pattern 2: parquet("path/to/table")
        match = expression.match(/\.(parquet|csv|json|delta|orc|avro)\s*\(\s*["']([^"']+)["']\s*\)/);
        if (match) return this.extractTableFromPath(match[2]);

        // Pattern 3: saveAsTable("table")
        match = expression.match(/saveAsTable\s*\(\s*["']([a-zA-Z0-9_\.]+)["']\s*\)/);
        if (match) return match[1];

        return undefined;
    }

    /**
     * Extract table name from file path
     */
    private extractTableFromPath(path: string): string {
        // Extract last part of path as table name
        const parts = path.split('/');
        const lastPart = parts[parts.length - 1];
        return lastPart.replace(/\.(parquet|csv|json|delta)$/, '');
    }

    /**
     * Extract source variable from expression
     */
    private extractSourceVariable(expression: string): string | undefined {
        // Match: df.filter(...) or df.transform(...)
        const match = expression.match(/([a-zA-Z_][a-zA-Z0-9_]*)\./);
        if (match) return match[1];

        // Match: function(df, ...)
        const funcMatch = expression.match(/\(([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (funcMatch) return funcMatch[1];

        return undefined;
    }

    /**
     * Detect transformation type from expression
     */
    private detectTransformationType(expression: string): string {
        const types = [
            { pattern: /\.filter|\.where/, type: 'filter' },
            { pattern: /\.select/, type: 'select' },
            { pattern: /\.join/, type: 'join' },
            { pattern: /\.groupBy/, type: 'groupBy' },
            { pattern: /\.agg/, type: 'aggregate' },
            { pattern: /\.withColumn/, type: 'withColumn' },
            { pattern: /\.transform/, type: 'transform' },
            { pattern: /\.union/, type: 'union' },
            { pattern: /\.distinct/, type: 'distinct' },
            { pattern: /\.window/, type: 'window' }
        ];

        for (const { pattern, type } of types) {
            if (pattern.test(expression)) return type;
        }

        return 'transform';
    }

    /**
     * Build edges connecting nodes based on variable lineage
     */
    private buildLineageEdges(
        graph: DataLineageGraph,
        lineage: Map<string, DataFlow>,
        file: AnalyzedFile
    ): void {
        for (const flow of lineage.values()) {
            try {
                let previousNodeId: string | undefined;

                // Edge from source to first transformation
                if (flow.source) {
                    const sourceNode = graph.nodes.find(n =>
                        n.type === 'source' && this.tableNamesMatch(n.name, flow.source!)
                    );
                    if (sourceNode) {
                        previousNodeId = sourceNode.id;
                    }
                }

                // Edges through transformations
                for (const transform of flow.transformations) {
                    const transformNode = graph.nodes.find(n =>
                        n.type === 'transformation' && n.line === transform.line
                    );

                    if (transformNode && previousNodeId) {
                        const edgeId = this.generateEdgeId(previousNodeId, transformNode.id);

                        if (!graph.edges.find(e => e.id === edgeId)) {
                            graph.edges.push({
                                id: edgeId,
                                from: previousNodeId,
                                to: transformNode.id,
                                operation: transform.type,
                                transformationType: this.mapToTransformationType(transform.type),
                                line: transform.line,
                                confidence: transform.confidence
                            });
                        }
                        previousNodeId = transformNode.id;
                    }
                }

                // Edge from last transformation to sink
                if (flow.sink && previousNodeId) {
                    const sinkNode = graph.nodes.find(n =>
                        n.type === 'sink' && this.tableNamesMatch(n.name, flow.sink!)
                    );
                    if (sinkNode) {
                        const edgeId = this.generateEdgeId(previousNodeId, sinkNode.id);

                        if (!graph.edges.find(e => e.id === edgeId)) {
                            graph.edges.push({
                                id: edgeId,
                                from: previousNodeId,
                                to: sinkNode.id,
                                operation: 'write',
                                line: sinkNode.line,
                                confidence: 90
                            });
                        }
                    }
                }
            } catch (error) {
                this.logger.warn(`Error building edge for flow ${flow.id}:`, error);
            }
        }
    }

    /**
     * Map transformation type to enum
     */
    private mapToTransformationType(type: string): 'filter' | 'join' | 'aggregate' | 'transform' | 'union' | 'window' {
        const mapping: Record<string, any> = {
            'filter': 'filter',
            'where': 'filter',
            'join': 'join',
            'groupBy': 'aggregate',
            'agg': 'aggregate',
            'union': 'union',
            'window': 'window'
        };
        return mapping[type] || 'transform';
    }

    /**
     * Check if two table names match (with normalization)
     */
    private tableNamesMatch(name1: string, name2: string): boolean {
        const normalize = (name: string) => {
            return name.toLowerCase()
                .replace(/[^a-z0-9_]/g, '')
                .split('.')
                .pop() || name;
        };

        const n1 = normalize(name1);
        const n2 = normalize(name2);

        return n1 === n2 || name1.includes(name2) || name2.includes(name1);
    }

    /**
     * Generate unique node ID
     */
    private generateNodeId(filePath: string, line: number, name: string): string {
        return `node_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_${line}_${name}_${this.nodeIdCounter++}`;
    }

    /**
     * Generate unique edge ID
     */
    private generateEdgeId(fromId: string, toId: string): string {
        return `edge_${fromId}_to_${toId}_${this.edgeIdCounter++}`;
    }

    /**
     * Generate unique flow ID
     */
    private generateFlowId(filePath: string, line: number, variable: string): string {
        return `flow_${filePath}_${line}_${variable}_${Date.now()}`;
    }

    /**
     * Generate unique transform ID
     */
    private generateTransformId(filePath: string, line: number): string {
        return `transform_${filePath}_${line}_${Date.now()}`;
    }

    /**
     * Return empty graph on error
     */
    private emptyGraph(): DataLineageGraph {
        return {
            nodes: [],
            edges: [],
            metadata: {
                analyzedAt: new Date(),
                fileCount: 0,
                totalNodes: 0,
                totalEdges: 0
            }
        };
    }

    /**
     * Merge multiple lineage graphs - PRODUCTION READY
     */
    mergeLineageGraphs(graphs: DataLineageGraph[]): DataLineageGraph {
        const startTime = Date.now();

        try {
            const merged: DataLineageGraph = {
                nodes: [],
                edges: [],
                metadata: {
                    analyzedAt: new Date(),
                    fileCount: graphs.length,
                    totalNodes: 0,
                    totalEdges: 0
                }
            };

            const nodeIds = new Set<string>();
            const edgeIds = new Set<string>();

            for (const graph of graphs) {
                // Add unique nodes
                for (const node of graph.nodes) {
                    if (!nodeIds.has(node.id)) {
                        merged.nodes.push(node);
                        nodeIds.add(node.id);
                    }
                }

                // Add unique edges
                for (const edge of graph.edges) {
                    if (!edgeIds.has(edge.id)) {
                        merged.edges.push(edge);
                        edgeIds.add(edge.id);
                    }
                }
            }

            merged.metadata.totalNodes = merged.nodes.length;
            merged.metadata.totalEdges = merged.edges.length;

            const duration = Date.now() - startTime;
            this.logger.log(`Merged ${graphs.length} lineage graphs: ${merged.nodes.length} nodes, ${merged.edges.length} edges (${duration}ms)`);

            return merged;

        } catch (error) {
            this.logger.error('Failed to merge lineage graphs:', error);
            return this.emptyGraph();
        }
    }
}
