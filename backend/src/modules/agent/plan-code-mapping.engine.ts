/**
 * Plan-to-Code Mapping Engine
 * Intelligent mapping of execution plan stages to source code
 */

import {
    ExecutionPlan,
    ExecutionPlanStage,
    ExecutionStageType,
    AnalyzedFile,
    PlanCodeMapping,
    CodeMapping,
    MatchType,
    EvidenceFactor,
    MappingStatus,
    OptimizationSuggestion,
    AgentConfig,
    AgentLog,
    TableReference,
} from './agent-types';
import { v4 as uuidv4 } from 'uuid';

interface MappingCandidate {
    file: AnalyzedFile;
    lineStart: number;
    lineEnd: number;
    evidence: EvidenceFactor[];
    totalScore: number;
}

export class PlanCodeMappingEngine {
    private logs: AgentLog[] = [];
    private onProgress?: (log: AgentLog) => void;

    constructor(
        private config: AgentConfig,
        onProgressCallback?: (log: AgentLog) => void
    ) {
        this.onProgress = onProgressCallback;
    }

    /**
     * Map all stages in an execution plan to code
     */
    async mapPlanToCode(
        plan: ExecutionPlan,
        analyzedFiles: AnalyzedFile[]
    ): Promise<PlanCodeMapping[]> {
        this.log('info', `Starting plan-to-code mapping for ${plan.parsedStages.length} stages`);

        const mappings: PlanCodeMapping[] = [];
        const indices = this.buildIndices(analyzedFiles);

        for (const stage of plan.parsedStages) {
            this.log('debug', `Mapping stage: ${stage.name} (${stage.type})`);
            const mapping = await this.mapStageToCode(stage, analyzedFiles, indices);
            mapping.planId = plan.id;
            mappings.push(mapping);
            this.log('info', `Stage ${stage.id}: ${mapping.mappings.length} code locations, confidence: ${mapping.confidence}%`);
        }

        this.addCrossReferences(mappings);
        // Suggestions are handled by Plan Analyzer, so we skip them here
        // this.generateOptimizationSuggestions(mappings);

        this.log('info', `Completed mapping: ${mappings.filter(m => m.status !== 'unmapped').length}/${mappings.length} stages mapped`);
        return mappings;
    }

    private buildIndices(files: AnalyzedFile[]) {
        const tableIndex = new Map<string, { file: AnalyzedFile; ref: TableReference }[]>();
        const operationIndex = new Map<string, { file: AnalyzedFile; op: any }[]>();
        const functionIndex = new Map<string, { file: AnalyzedFile; lineStart: number; lineEnd: number }[]>();

        for (const file of files) {
            for (const ref of file.analysis.tableReferences) {
                const key = this.normalizeTableName(ref.name);
                // Avoid duplicate entries if possible, or allow multiple refs
                const existing = tableIndex.get(key) || [];
                existing.push({ file, ref });
                tableIndex.set(key, existing);
            }

            for (const op of file.analysis.dataOperations) {
                const existing = operationIndex.get(op.type) || [];
                existing.push({ file, op });
                operationIndex.set(op.type, existing);
            }

            for (const func of file.analysis.functions) {
                const key = func.name.toLowerCase();
                const existing = functionIndex.get(key) || [];
                existing.push({ file, lineStart: func.startLine, lineEnd: func.endLine });
                functionIndex.set(key, existing);
            }

            // Also index class methods
            for (const cls of file.analysis.classes) {
                for (const method of cls.methods) {
                    const key = method.name.toLowerCase();
                    const existing = functionIndex.get(key) || [];
                    existing.push({ file, lineStart: method.startLine, lineEnd: method.endLine });
                    functionIndex.set(key, existing);
                }
            }
        }

        return { tableIndex, operationIndex, functionIndex };
    }

    private async mapStageToCode(
        stage: ExecutionPlanStage,
        files: AnalyzedFile[],
        indices: ReturnType<typeof this.buildIndices>
    ): Promise<PlanCodeMapping> {
        const candidates: MappingCandidate[] = [];

        // strategy 1: Table Matches
        candidates.push(...this.findTableMatches(stage, indices.tableIndex));
        // strategy 2: Operation Matches
        candidates.push(...this.findOperationMatches(stage, indices.operationIndex));
        // strategy 3: Keyword Matches
        candidates.push(...this.findKeywordMatches(stage, files));
        // strategy 4: Function Name Matches
        candidates.push(...this.findFunctionMatches(stage, indices.functionIndex));
        // strategy 5: Comment References
        candidates.push(...this.findCommentMatches(stage, files));

        const mergedCandidates = this.mergeCandidates(candidates);
        mergedCandidates.sort((a, b) => b.totalScore - a.totalScore);
        const topCandidates = mergedCandidates.slice(0, 5);

        const codeMappings = topCandidates
            .filter(c => c.totalScore >= this.config.confidenceThreshold)
            .map(c => this.candidateToMapping(c, stage));

        const status = this.determineStatus(codeMappings);
        const avgConfidence = codeMappings.length > 0
            ? Math.round(codeMappings.reduce((sum, m) => sum + m.confidence, 0) / codeMappings.length)
            : 0;

        return {
            id: uuidv4(),
            planId: '',
            stageId: stage.id,
            stageName: stage.name,
            stageType: stage.type,
            mappings: codeMappings,
            confidence: avgConfidence,
            status,
            reasoning: this.generateReasoning(stage, codeMappings),
        };
    }

    private findTableMatches(
        stage: ExecutionPlanStage,
        tableIndex: Map<string, { file: AnalyzedFile; ref: TableReference }[]>
    ): MappingCandidate[] {
        const candidates: MappingCandidate[] = [];
        const stageTableNames = this.extractTableNames(stage);

        for (const tableName of stageTableNames) {
            const normalizedName = this.normalizeTableName(tableName);
            // Try exact match or suffix match (e.g. stage has db.table, code has table)
            let matches = tableIndex.get(normalizedName);

            // If no exact match, try searching keys that end with name
            if (!matches) {
                for (const [key, value] of tableIndex.entries()) {
                    if (key.endsWith(normalizedName) || normalizedName.endsWith(key)) {
                        matches = value;
                        break;
                    }
                }
            }

            if (matches) {
                for (const match of matches) {
                    const evidence: EvidenceFactor[] = [{
                        type: 'table_match',
                        description: `Table "${tableName}" referenced in code`,
                        weight: 0.9,
                        details: { tableName, operation: match.ref.operation },
                    }];

                    if (this.operationMatchesStage(match.ref.operation, stage.type)) {
                        evidence.push({
                            type: 'operation_match',
                            description: `Operation type matches: ${match.ref.operation}`,
                            weight: 0.3,
                        });
                    }

                    candidates.push({
                        file: match.file,
                        lineStart: match.ref.line,
                        lineEnd: match.ref.line + 5,
                        evidence,
                        totalScore: evidence.reduce((sum, e) => sum + e.weight * 100, 0),
                    });
                }
            }
        }

        return candidates;
    }

    private findOperationMatches(
        stage: ExecutionPlanStage,
        operationIndex: Map<string, { file: AnalyzedFile; op: any }[]>
    ): MappingCandidate[] {
        const candidates: MappingCandidate[] = [];
        const opTypes = this.stageTypeToOperationTypes(stage.type);

        for (const opType of opTypes) {
            const matches = operationIndex.get(opType);
            if (matches) {
                for (const match of matches) {
                    const evidence: EvidenceFactor[] = [{
                        type: 'operation_type_match',
                        description: `${opType} operation found in code`,
                        weight: 0.7,
                        details: { operationType: opType, line: match.op.line },
                    }];

                    if (stage.inputs?.length) {
                        for (const input of stage.inputs) {
                            if (match.op.code?.toLowerCase().includes(input.toLowerCase())) {
                                evidence.push({
                                    type: 'input_match',
                                    description: `Input "${input}" found in operation code`,
                                    weight: 0.4,
                                });
                            }
                        }
                    }

                    candidates.push({
                        file: match.file,
                        lineStart: match.op.line,
                        lineEnd: match.op.line + 3,
                        evidence,
                        totalScore: evidence.reduce((sum, e) => sum + e.weight * 100, 0),
                    });
                }
            }
        }

        return candidates;
    }

    private findKeywordMatches(stage: ExecutionPlanStage, files: AnalyzedFile[]): MappingCandidate[] {
        const candidates: MappingCandidate[] = [];
        const keywords = this.extractKeywords(stage);
        if (keywords.length === 0) return candidates;

        for (const file of files) {
            const lines = file.content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].toLowerCase();
                // Simple check if line contains multiple keywords
                const matchedKeywords = keywords.filter(kw => line.includes(kw.toLowerCase()));

                if (matchedKeywords.length >= 2 || (matchedKeywords.length === 1 && keywords.length === 1)) {
                    candidates.push({
                        file,
                        lineStart: i + 1,
                        lineEnd: Math.min(i + 10, lines.length),
                        evidence: [{
                            type: 'keyword_match',
                            description: `Keywords found: ${matchedKeywords.join(', ')}`,
                            weight: 0.4 + (matchedKeywords.length * 0.15),
                            details: { keywords: matchedKeywords },
                        }],
                        totalScore: (0.4 + matchedKeywords.length * 0.15) * 100,
                    });
                }
            }
        }

        return candidates;
    }

    private findFunctionMatches(
        stage: ExecutionPlanStage,
        functionIndex: Map<string, { file: AnalyzedFile; lineStart: number; lineEnd: number }[]>
    ): MappingCandidate[] {
        const candidates: MappingCandidate[] = [];
        const potentialNames = this.generatePotentialFunctionNames(stage);

        for (const name of potentialNames) {
            const matches = functionIndex.get(name);
            if (matches) {
                for (const match of matches) {
                    candidates.push({
                        file: match.file,
                        lineStart: match.lineStart,
                        lineEnd: match.lineEnd,
                        evidence: [{
                            type: 'function_name_match',
                            description: `Function "${name}" matches stage naming pattern`,
                            weight: 0.6,
                            details: { functionName: name },
                        }],
                        totalScore: 60,
                    });
                }
            }
        }

        return candidates;
    }

    private findCommentMatches(stage: ExecutionPlanStage, files: AnalyzedFile[]): MappingCandidate[] {
        const candidates: MappingCandidate[] = [];
        // Only search comment matches if we have a distinctive stage name
        if (stage.name.length < 4) return [];

        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const safeStageId = escapeRegExp(stage.id);
        const safeStageName = escapeRegExp(stage.name);

        const stageRefPatterns = [
            new RegExp(`stage.*${safeStageId}`, 'i'),
            new RegExp(`step.*${safeStageName}`, 'i'),
            new RegExp(`\\b${safeStageName}\\b`, 'i'),
        ];

        for (const file of files) {
            const lines = file.content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!this.isCommentLine(line, file.language)) continue;

                for (const pattern of stageRefPatterns) {
                    if (pattern.test(line)) {
                        candidates.push({
                            file,
                            lineStart: i + 1,
                            lineEnd: Math.min(i + 20, lines.length),
                            evidence: [{
                                type: 'comment_reference',
                                description: `Comment references stage: "${line.trim().slice(0, 50)}..."`,
                                weight: 0.9,
                                details: { comment: line.trim() },
                            }],
                            totalScore: 90,
                        });
                        break;
                    }
                }
            }
        }

        return candidates;
    }

    private mergeCandidates(candidates: MappingCandidate[]): MappingCandidate[] {
        // 1. Group by file
        const merged: MappingCandidate[] = [];
        const fileGroups = new Map<string, MappingCandidate[]>();

        for (const candidate of candidates) {
            const group = fileGroups.get(candidate.file.path) || [];
            group.push(candidate);
            fileGroups.set(candidate.file.path, group);
        }

        // 2. Merge overlapping ranges within keys
        for (const [, group] of fileGroups) {
            group.sort((a, b) => a.lineStart - b.lineStart);
            let current: MappingCandidate | null = null;

            for (const candidate of group) {
                if (!current) {
                    current = { ...candidate };
                    continue;
                }

                // If ranges overlap or are close (within 5 lines)
                if (candidate.lineStart <= current.lineEnd + 5) {
                    current.lineEnd = Math.max(current.lineEnd, candidate.lineEnd);
                    current.evidence.push(...candidate.evidence);
                    // Recalculate score (capped)
                    current.totalScore = Math.min(100, current.evidence.reduce((sum, e) => sum + e.weight * 100, 0));
                } else {
                    merged.push(current);
                    current = { ...candidate };
                }
            }

            if (current) merged.push(current);
        }

        // Deduplicate evidence
        for (const candidate of merged) {
            const seen = new Set<string>();
            candidate.evidence = candidate.evidence.filter(e => {
                const key = `${e.type}-${e.description}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            // Normalize score max 100
            candidate.totalScore = Math.min(100, candidate.evidence.reduce((sum, e) => sum + e.weight * 100, 0));
        }

        return merged;
    }

    private candidateToMapping(candidate: MappingCandidate, stage: ExecutionPlanStage): CodeMapping {
        const lines = candidate.file.content.split('\n');
        const codeSnippet = lines.slice(Math.max(0, candidate.lineStart - 1), candidate.lineEnd).join('\n').slice(0, 500);
        const matchType = this.determineMatchType(candidate.evidence);
        const functionContext = this.findFunctionContext(candidate.file, candidate.lineStart);

        return {
            id: uuidv4(),
            filePath: candidate.file.path,
            language: candidate.file.language,
            startLine: candidate.lineStart,
            endLine: candidate.lineEnd,
            codeSnippet,
            matchType,
            confidence: Math.round(candidate.totalScore),
            evidenceFactors: candidate.evidence,
            functionContext,
        };
    }

    private determineMatchType(evidence: EvidenceFactor[]): MatchType {
        const types = evidence.map(e => e.type);
        if (types.includes('table_match') && types.includes('operation_match')) return 'exact_table';
        if (types.includes('table_match')) return 'exact_table';
        if (types.includes('operation_type_match') && types.includes('input_match')) return 'exact_operation';
        if (types.includes('comment_reference')) return 'comment_reference';
        if (types.includes('function_name_match')) return 'naming_convention';
        if (types.includes('keyword_match')) return 'semantic';
        return 'inferred';
    }

    private findFunctionContext(file: AnalyzedFile, line: number): string | undefined {
        for (const func of file.analysis.functions) {
            if (line >= func.startLine && line <= func.endLine) return func.name;
        }
        for (const cls of file.analysis.classes) {
            for (const method of cls.methods) {
                if (line >= method.startLine && line <= method.endLine) return `${cls.name}.${method.name}`;
            }
        }
        return undefined;
    }

    private determineStatus(mappings: CodeMapping[]): MappingStatus {
        if (mappings.length === 0) return 'unmapped';
        const maxConfidence = Math.max(...mappings.map(m => m.confidence));
        if (maxConfidence >= 80) return 'confirmed';
        if (maxConfidence >= 50) return 'probable';
        return 'uncertain';
    }

    private generateReasoning(stage: ExecutionPlanStage, mappings: CodeMapping[]): string {
        if (mappings.length === 0) {
            return `No code locations found for stage "${stage.name}" (${stage.type}).`;
        }
        const top = mappings[0];
        const evidenceDesc = top.evidenceFactors.slice(0, 3).map(e => e.description).join('; ');
        return `Found ${mappings.length} code location(s) for "${stage.name}". Top: ${top.filePath}:${top.startLine} (${top.confidence}%). Evidence: ${evidenceDesc}`;
    }

    private addCrossReferences(mappings: PlanCodeMapping[]): void {
        const fileToStages = new Map<string, string[]>();
        for (const mapping of mappings) {
            for (const codeMapping of mapping.mappings) {
                const stages = fileToStages.get(codeMapping.filePath) || [];
                stages.push(mapping.stageId);
                fileToStages.set(codeMapping.filePath, stages);
            }
        }
        for (const mapping of mappings) {
            for (const codeMapping of mapping.mappings) {
                const related = fileToStages.get(codeMapping.filePath) || [];
                codeMapping.relatedMappings = related.filter(s => s !== mapping.stageId);
            }
        }
    }

    private generateOptimizationSuggestions(mappings: PlanCodeMapping[]): void {
        for (const mapping of mappings) {
            const suggestions: OptimizationSuggestion[] = [];

            if (mapping.stageType === 'shuffle') {
                suggestions.push({
                    type: 'shuffle',
                    title: 'Consider Reducing Shuffle',
                    description: 'This stage involves expensive data shuffling. Consider broadcast joins or partition optimization.',
                    severity: 'high',
                    affectedLines: mapping.mappings.map(m => m.startLine),
                });
            }

            if (mapping.stageType === 'join') {
                for (const cm of mapping.mappings) {
                    const code = cm.codeSnippet.toLowerCase();
                    if (!code.includes('broadcast')) {
                        suggestions.push({
                            type: 'broadcast',
                            title: 'Consider Broadcast Join',
                            description: 'If one table is small (<10MB), use broadcast join for better performance.',
                            severity: 'medium',
                            affectedLines: [cm.startLine],
                            suggestedCode: '# from pyspark.sql.functions import broadcast\n# df.join(broadcast(small_df), ...)',
                        });
                    }
                }
            }

            if (mapping.stageType === 'data_ingestion') {
                for (const cm of mapping.mappings) {
                    const code = cm.codeSnippet.toLowerCase();
                    if (code.includes('.csv') || code.includes("format('csv')")) {
                        suggestions.push({
                            type: 'performance',
                            title: 'Convert CSV to Parquet',
                            description: 'Reading CSV is slow. Convert to Parquet for 10x faster reads.',
                            severity: 'high',
                            affectedLines: [cm.startLine],
                            estimatedImpact: '40-60% faster reads',
                        });
                    }
                }
            }

            mapping.suggestions = suggestions;
        }
    }

    private extractTableNames(stage: ExecutionPlanStage): string[] {
        const tables: string[] = [];
        const description = stage.description || '';
        // Also check inputs
        if (stage.inputs) tables.push(...stage.inputs);

        const patterns = [
            /(?:table|relation)\s*[:=]?\s*([a-zA-Z0-9_.]+)/gi,
            /(?:scan|read|from)\s+(?:parquet|delta|csv|json)?\s*([a-zA-Z0-9_.]+)/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(description)) !== null) {
                const table = match[1];
                if (table?.length > 2 && !['true', 'false', 'null', 'temp'].includes(table.toLowerCase())) {
                    tables.push(table);
                }
            }
        }

        return [...new Set(tables)];
    }

    private normalizeTableName(name: string): string {
        return name.replace(/^["'`]|["'`]$/g, '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9_]/g, '') || name;
    }

    private operationMatchesStage(operation: string, stageType: ExecutionStageType): boolean {
        const map: Record<string, ExecutionStageType[]> = {
            'read': ['data_ingestion'], 'write': ['write'], 'join': ['join'], 'aggregate': ['aggregation'],
        };
        return map[operation]?.includes(stageType) || false;
    }

    private stageTypeToOperationTypes(stageType: ExecutionStageType): string[] {
        const map: Record<ExecutionStageType, string[]> = {
            'data_ingestion': ['read'], 'transformation': ['transform', 'window'], 'aggregation': ['aggregate'],
            'join': ['join'], 'filter': ['filter'], 'shuffle': ['repartition'], 'sort': ['sort'],
            'write': ['write'], 'cache': ['cache'], 'broadcast': ['broadcast'], 'custom': [],
        };
        return map[stageType] || [];
    }

    private extractKeywords(stage: ExecutionPlanStage): string[] {
        const text = `${stage.name} ${stage.description || ''} ${stage.inputs?.join(' ') || ''}`;
        const words = text.split(/[\s,;:()[\]{}]+/);
        const common = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'true', 'false', 'null', 'scan', 'plan', 'execution']);
        return [...new Set(words.map(w => w.replace(/[^a-zA-Z0-9_]/g, '')).filter(w => w.length >= 3 && !common.has(w.toLowerCase())))];
    }

    private generatePotentialFunctionNames(stage: ExecutionPlanStage): string[] {
        const baseName = stage.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const names = [baseName, `process_${baseName}`, `run_${baseName}`, `execute_${baseName}`];
        if (stage.type === 'data_ingestion') names.push('load_data', 'read_data', 'ingest');
        if (stage.type === 'transformation') names.push('transform', 'process', 'clean');
        if (stage.type === 'aggregation') names.push('aggregate', 'summarize', 'group');
        if (stage.type === 'join') names.push('join_tables', 'merge', 'combine');
        if (stage.type === 'write') names.push('write_data', 'save', 'export');
        return names;
    }

    private isCommentLine(line: string, language: string): boolean {
        const t = line.trim();
        if (language === 'python') return t.startsWith('#') || t.startsWith('"""');
        if (['scala', 'java'].includes(language)) return t.startsWith('//') || t.startsWith('/*');
        if (language === 'sql') return t.startsWith('--') || t.startsWith('/*');
        return t.startsWith('#') || t.startsWith('//') || t.startsWith('--');
    }

    private log(level: AgentLog['level'], message: string, details?: Record<string, any>): void {
        const log: AgentLog = { timestamp: new Date(), level, message, details };
        this.logs.push(log);
        this.onProgress?.(log);
    }

    getLogs(): AgentLog[] {
        return this.logs;
    }
}
