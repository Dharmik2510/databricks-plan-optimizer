import { ExecutionPlan, ExecutionPlanStage, ExecutionStageType } from './agent-types';
import { v4 as uuidv4 } from 'uuid';

export class PlanParserService {
    parsePlan(content: string, name?: string): ExecutionPlan {
        const lines = content.split('\n');
        const stages: ExecutionPlanStage[] = [];

        // Improved Stack-based parsing for tree structures (like Spark explain)
        const stack: { id: string; indent: number }[] = [];

        lines.forEach((line) => {
            const trimmed = line.trimStart();
            if (!trimmed) return;

            // Skip header lines or empty lines
            if (trimmed.startsWith('==') || !trimmed.length) return;

            const indent = line.length - trimmed.length;
            const cleanName = trimmed.replace(/^[\+\:\-\|!> ]+/, '').trim(); // Remove tree characters
            const stageName = cleanName.split(' ')[0];

            const stageType = this.guessStageType(cleanName);
            const stageId = uuidv4();

            // Find parent
            while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }

            const dependencies = stack.length > 0 ? [stack[stack.length - 1].id] : [];

            stages.push({
                id: stageId,
                name: stageName,
                type: stageType,
                description: cleanName,
                dependencies,
                estimatedDuration: '0ms',
                inputs: this.extractInputs(cleanName),
                metrics: {}
            });

            stack.push({ id: stageId, indent });
        });

        return {
            id: uuidv4(),
            name: name || 'Parsed Plan',
            rawContent: content,
            parsedStages: stages,
            createdAt: new Date(),
        };
    }

    private guessStageType(name: string): ExecutionStageType {
        const lower = name.toLowerCase();
        if (lower.includes('scan') || lower.includes('read')) return 'data_ingestion';
        if (lower.includes('filter') || lower.includes('where')) return 'filter';
        if (lower.includes('join')) return 'join';
        if (lower.includes('aggregate') || lower.includes('group')) return 'aggregation';
        if (lower.includes('exchange') || lower.includes('shuffle') || lower.includes('repartition')) return 'shuffle';
        if (lower.includes('sort') || lower.includes('order')) return 'sort';
        if (lower.includes('project') || lower.includes('select')) return 'transformation';
        if (lower.includes('write') || lower.includes('save') || lower.includes('insert')) return 'write';
        if (lower.includes('broadcast')) return 'broadcast';
        return 'custom';
    }

    private extractInputs(description: string): string[] {
        const inputs: string[] = [];
        // Heuristic to find table names or file paths
        const tableMatch = description.match(/(?:parquet|csv|json|delta)\s+([a-zA-Z0-9_\.]+)/i);
        if (tableMatch) inputs.push(tableMatch[1]);
        return inputs;
    }

    createPlanFromDag(dagNodes: any[], name?: string, content: string = ''): ExecutionPlan {
        const stages: ExecutionPlanStage[] = dagNodes.map(node => ({
            id: node.id,
            name: node.name,
            type: this.guessStageType(node.type || node.name), // Map DAG type to ExecutionStageType
            description: node.name, // Use name as description
            dependencies: [], // Dependencies are separate in DAG links, usually handled by caller or ignored for simple mapping
            estimatedDuration: '0ms',
            inputs: this.extractInputs(node.name),
            metrics: {}
        }));

        return {
            id: uuidv4(),
            name: name || 'Generated DAG Plan',
            rawContent: content,
            parsedStages: stages,
            createdAt: new Date(),
        };
    }
}
