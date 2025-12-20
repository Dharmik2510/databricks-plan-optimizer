
import { useMemo } from 'react';
import { DagNode, DagLink, OptimizationTip } from '../../shared/types';

interface EnhancedNode extends DagNode {
    x: number;
    y: number;
    level: number;
    indexInLevel: number;
    isBottleneck: boolean;
    bottleneckSeverity: 'critical' | 'high' | 'medium' | 'low';
    estimatedCost: number;
    rowsProcessed: number;
    relatedOptimization?: OptimizationTip;
}

interface StageGroup {
    id: number;
    x: number;
    nodeCount: number;
    label: string;
}

interface LayoutResult {
    nodes: EnhancedNode[];
    links: any[]; // D3 compatible links
    stages: StageGroup[];
    width: number;
    height: number;
    maxLevel: number;
    bottleneckCount: number;
}

export const useDagLayout = (
    rawNodes: DagNode[],
    rawLinks: DagLink[],
    optimizations: OptimizationTip[]
): LayoutResult => {

    const STAGE_WIDTH = 300;
    const STAGE_GAP = 100;
    const NODE_VERTICAL_SPACING = 140;

    // Helpers
    const isBottleneckNode = (node: DagNode): OptimizationTip | null => {
        const nodeTypeLower = node.type.toLowerCase();
        const nodeNameLower = node.name.toLowerCase();

        for (const opt of optimizations) {
            if (opt.affected_stages?.some(stage => node.id.includes(stage) || nodeNameLower.includes(stage))) return opt;
            const titleLower = opt.title.toLowerCase();
            if (nodeTypeLower.includes('nestedloop') && (titleLower.includes('cartesian') || titleLower.includes('join'))) return opt;
            if (nodeTypeLower.includes('exchange') && (titleLower.includes('shuffle') || titleLower.includes('partition'))) return opt;
        }
        return null;
    };

    const getSeverity = (opt: OptimizationTip | null) => {
        if (!opt) return 'low';
        if (opt.severity === 'High') return 'critical';
        if (opt.severity === 'Medium') return 'high';
        return 'medium';
    };

    const extractRows = (node: DagNode) => {
        if (!node.metric) return 0;
        const match = node.metric.match(/([\d.]+)\s*([KMBkmb])?/);
        if (!match) return 0;
        const val = parseFloat(match[1]);
        const mul = match[2]?.toUpperCase();
        const map: any = { K: 1e3, M: 1e6, B: 1e9 };
        return val * (map[mul || ''] || 1);
    };

    return useMemo(() => {
        const nodeMap = new Map<string, EnhancedNode>();
        const adjacency = new Map<string, string[]>();
        const inDegree = new Map<string, number>();
        const parentsMap = new Map<string, string[]>();

        // clean IDs
        const cleanId = (id: string) => id.trim();

        // 1. Init
        rawNodes.forEach(n => {
            const id = cleanId(n.id);
            adjacency.set(id, []);
            inDegree.set(id, 0);
            parentsMap.set(id, []);

            const opt = isBottleneckNode(n);
            nodeMap.set(id, {
                ...n,
                id,
                x: 0, y: 0, level: 0, indexInLevel: 0,
                isBottleneck: !!opt,
                bottleneckSeverity: getSeverity(opt),
                estimatedCost: 50, // Simplified for brevity
                rowsProcessed: extractRows(n),
                relatedOptimization: opt || undefined
            });
        });

        // 2. Build Graph
        rawLinks.forEach(l => {
            const s = cleanId(typeof l.source === 'object' ? (l.source as any).id : l.source);
            const t = cleanId(typeof l.target === 'object' ? (l.target as any).id : l.target);

            if (nodeMap.has(s) && nodeMap.has(t)) {
                adjacency.get(s)?.push(t);
                inDegree.set(t, (inDegree.get(t) || 0) + 1);
                if (!parentsMap.has(t)) parentsMap.set(t, []);
                parentsMap.get(t)!.push(s);
            }
        });

        // 3. Leveling (BFS)
        const levels = new Map<string, number>();
        const queue: string[] = [];

        // Find roots
        nodeMap.forEach((_, id) => {
            if ((inDegree.get(id) || 0) === 0) {
                levels.set(id, 0);
                queue.push(id);
            }
        });

        while (queue.length) {
            const u = queue.shift()!;
            const lvl = levels.get(u)!;
            adjacency.get(u)?.forEach(v => {
                const nextLvl = lvl + 1;
                if (!levels.has(v) || levels.get(v)! < nextLvl) {
                    levels.set(v, nextLvl);
                    queue.push(v);
                }
            });
        }

        // Assign fallback level 0
        nodeMap.forEach((_, id) => { if (!levels.has(id)) levels.set(id, 0); });

        // 4. Group & Sort
        const maxLevel = Math.max(0, ...Array.from(levels.values()));
        const nodesByLevel = new Map<number, EnhancedNode[]>();

        nodeMap.forEach((n, id) => {
            const l = levels.get(id)!;
            n.level = l;
            if (!nodesByLevel.has(l)) nodesByLevel.set(l, []);
            nodesByLevel.get(l)!.push(n);
        });

        // Barycentric Sort
        for (let l = 1; l <= maxLevel; l++) {
            const nodes = nodesByLevel.get(l) || [];
            nodes.sort((a, b) => {
                const avgY = (id: string) => {
                    const parents = parentsMap.get(id) || [];
                    if (!parents.length) return 0;
                    return parents.reduce((sum, pid) => sum + (nodeMap.get(pid)?.indexInLevel || 0), 0) / parents.length;
                };
                return avgY(a.id) - avgY(b.id);
            });
            nodes.forEach((n, i) => n.indexInLevel = i);
        }
        // Set level 0 sorted by name for stability
        nodesByLevel.get(0)?.sort((a, b) => a.name.localeCompare(b.name)).forEach((n, i) => n.indexInLevel = i);


        // 5. Final Coordinates
        const stages: StageGroup[] = [];
        let maxNodesInStage = 0;

        for (let i = 0; i <= maxLevel; i++) {
            const count = nodesByLevel.get(i)?.length || 0;
            maxNodesInStage = Math.max(maxNodesInStage, count);
            stages.push({
                id: i,
                x: i * (STAGE_WIDTH + STAGE_GAP),
                nodeCount: count,
                label: `Stage ${i}`
            });
        }

        const calculatedNodes: EnhancedNode[] = [];
        nodeMap.forEach(n => {
            n.x = n.level * (STAGE_WIDTH + STAGE_GAP) + STAGE_WIDTH / 2;
            n.y = n.indexInLevel * NODE_VERTICAL_SPACING + 100;
            calculatedNodes.push(n);
        });

        const calculatedLinks = rawLinks.map(l => ({
            source: nodesByLevel.get(levels.get(cleanId(typeof l.source === 'object' ? (l.source as any).id : l.source))!)?.find(n => n.id === cleanId(typeof l.source === 'object' ? (l.source as any).id : l.source)),
            target: nodesByLevel.get(levels.get(cleanId(typeof l.target === 'object' ? (l.target as any).id : l.target))!)?.find(n => n.id === cleanId(typeof l.target === 'object' ? (l.target as any).id : l.target))
        })).filter(l => l.source && l.target);

        return {
            nodes: calculatedNodes,
            links: calculatedLinks,
            stages,
            width: (maxLevel + 1) * (STAGE_WIDTH + STAGE_GAP) + 100,
            height: Math.max(800, maxNodesInStage * NODE_VERTICAL_SPACING + 200),
            maxLevel,
            bottleneckCount: calculatedNodes.filter(n => n.isBottleneck).length
        };

    }, [rawNodes, rawLinks, optimizations]);
};
