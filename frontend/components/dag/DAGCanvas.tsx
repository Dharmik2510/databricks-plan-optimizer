import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import { DAGNode } from './DAGNode';
import { DAGLink } from './DAGLink';
import { DAGMinimap } from './DAGMinimap';
import { useTheme } from '../../ThemeContext';
import { DagNode, DagLink, OptimizationTip } from '../../../shared/types';
import { ZoomIn, ZoomOut, Maximize, RefreshCw, Minimize, X, FileCode2 } from 'lucide-react';
import { useDagLayout } from '../../hooks/useDagLayout';
import { NodeDetailsSidebar, SelectedNode } from './NodeDetailsSidebar';

interface DAGCanvasProps {
    nodes: DagNode[];
    links: DagLink[];
    optimizations: OptimizationTip[];
    isExpanded?: boolean; // Controlled state
    onToggleExpand?: (expanded: boolean) => void;
    highlightedNodeId?: string | null; // Controlled state
    onSelectNode?: (nodeId: string | null) => void;
    onMapToCode?: () => void;
}

export const DAGCanvas: React.FC<DAGCanvasProps> = ({
    nodes: rawNodes,
    links: rawLinks,
    optimizations,
    isExpanded: propsIsExpanded,
    onToggleExpand,
    highlightedNodeId: propsHighlightedNodeId,
    onSelectNode,
    onMapToCode
}) => {
    const { theme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const layout = useDagLayout(rawNodes, rawLinks, optimizations);

    // State (Controlled vs Uncontrolled)
    const [internalTransform, setTransform] = useState({ k: 1, x: 0, y: 0 });
    const [internalSelectedNodeId, setInternalSelectedNodeId] = useState<string | null>(null);
    const [internalExpanded, setInternalExpanded] = useState(false);

    // Derived State
    const isExpanded = propsIsExpanded !== undefined ? propsIsExpanded : internalExpanded;
    const selectedNodeId = propsHighlightedNodeId !== undefined ? propsHighlightedNodeId : internalSelectedNodeId;

    // Handlers
    const handleSetExpanded = (val: boolean) => {
        if (onToggleExpand) onToggleExpand(val);
        else setInternalExpanded(val);
    };
    const handleSetSelectedNode = (id: string | null) => {
        if (onSelectNode) onSelectNode(id);
        else setInternalSelectedNodeId(id);

        // Auto-open sidebar on selection
        if (id) setSidebarOpen(true);
    };

    const [sidebarOpen, setSidebarOpen] = useState(false);

    /**
     * Compute upstream/downstream labels for a node (max 3 each)
     */
    const getNeighborLabels = (nodeId: string): { upstreamLabels: string[], downstreamLabels: string[] } => {
        const nodeMap = new Map(layout.nodes.map(n => [n.id, n]));

        // Get parent IDs and map to labels
        const parentIds = layout.parentsMap.get(nodeId) || [];
        const upstreamLabels = parentIds
            .slice(0, 3)
            .map(id => nodeMap.get(id)?.name || id)
            .filter(Boolean) as string[];

        // Get child IDs and map to labels
        const childIds = layout.childrenMap.get(nodeId) || [];
        const downstreamLabels = childIds
            .slice(0, 3)
            .map(id => nodeMap.get(id)?.name || id)
            .filter(Boolean) as string[];

        return { upstreamLabels, downstreamLabels };
    };

    const mapToSidebarNode = (node: any): SelectedNode => {
        if (!node) return null as any; // Should not happen if called with valid node

        // Construct metrics from known properties if direct metrics map is missing
        const metrics: Record<string, string | number> = node.metrics || {};

        if (Object.keys(metrics).length === 0) {
            if (node.rowsProcessed !== undefined) metrics['Rows Processed'] = node.rowsProcessed >= 1e6 ? `${(node.rowsProcessed / 1e6).toFixed(1)}M` : node.rowsProcessed;
            if (node.partitions !== undefined) metrics['Partitions'] = node.partitions;
            if (node.sizeOut !== undefined) metrics['Output Size'] = node.sizeOut;
            if (node.estimatedCost !== undefined) metrics['Est. Cost'] = node.estimatedCost;
        }

        // Map evidence from various potential sources
        let evidence = node.evidence || [];
        // Fallback for agent mapping node structure if not strict evidence array
        if (evidence.length === 0 && node.mapping && node.mapping.codeSnippet) {
            // We don't want to fabricate evidence, but if codeSnippet is present essentially as evidence
            // we can include it if it implies reasoning. 
            // However, strictly following "evidence objects with text + file" logic:
            // If node.reasoning is present, we treat that as summary, not evidence snippets.
        }

        // Compute upstream and downstream neighbors
        const { upstreamLabels, downstreamLabels } = getNeighborLabels(node.id);

        return {
            id: node.id,
            label: node.name || node.label || node.id,
            operatorType: node.type || null,
            confidence: typeof node.confidence === 'number' ? node.confidence : null,
            evidence: Array.isArray(evidence) ? evidence : [],
            metrics: metrics,
            stageInfo: node.stageInfo || null,
            reasoningNotes: node.reasoningNotes || node.reasoning || null,
            upstreamLabels,
            downstreamLabels
        };
    };

    // Helper for copy
    const handleCopyDetails = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            // Could show toast here, for now console
            console.log("Details copied to clipboard");
        });
    };

    // D3 Zoom Behavior setup
    const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const zoomBehavior = zoom<HTMLDivElement, unknown>()
            .scaleExtent([0.1, 4])
            .on('zoom', (e) => {
                setTransform(e.transform);
            });

        zoomRef.current = zoomBehavior;
        select(containerRef.current).call(zoomBehavior);

        // Restore transform if available, otherwise fit
        if (internalTransform.k !== 1 || internalTransform.x !== 0 || internalTransform.y !== 0) {
            select(containerRef.current).call(zoomBehavior.transform, zoomIdentity.translate(internalTransform.x, internalTransform.y).scale(internalTransform.k));
        } else if (layout.width > 0) {
            // Initial Zoom to fit
            const initialScale = Math.min(0.8, containerRef.current.clientWidth / layout.width);
            select(containerRef.current).call(zoomBehavior.transform, zoomIdentity.translate(50, 50).scale(initialScale));
        }
    }, [layout.width, isExpanded]); // Re-run if layout size changes significantly

    // Auto-focus logic: When selectedNodeId changes (external control) to a non-null value, center view on that node
    useEffect(() => {
        if (selectedNodeId && containerRef.current && zoomRef.current) {
            // Small timeout to allow layout/portal to settle if switching to expanded mode simultaneously
            const timer = setTimeout(() => {
                const node = layout.nodes.find(n => n.id === selectedNodeId);
                if (node && containerRef.current) {
                    const scale = 1.2;
                    // Center the node
                    // viewport center = (width/2, height/2)
                    // node pos = (node.x, node.y)
                    // translate = center - node_pos * scale
                    const x = -node.x * scale + (containerRef.current.clientWidth / 2);
                    const y = -node.y * scale + (containerRef.current.clientHeight / 2);

                    select(containerRef.current)
                        .transition()
                        .duration(750)
                        .call(zoomRef.current.transform, zoomIdentity.translate(x, y).scale(scale));
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [selectedNodeId, isExpanded, layout.nodes]);

    const handleZoomIn = () => {
        if (containerRef.current && zoomRef.current) {
            select(containerRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.2);
        }
    };

    const handleZoomOut = () => {
        if (containerRef.current && zoomRef.current) {
            select(containerRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.8);
        }
    };

    const handleReset = () => {
        if (containerRef.current && zoomRef.current) {
            const initialScale = Math.min(0.8, containerRef.current.clientWidth / layout.width);
            select(containerRef.current).transition().duration(500).call(zoomRef.current.transform, zoomIdentity.translate(50, 50).scale(initialScale));
        }
    };

    const controls = (
        <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-20">
            <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Zoom In"><ZoomIn className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
            <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Zoom Out"><ZoomOut className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
            <button onClick={() => handleSetExpanded(!isExpanded)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title={isExpanded ? "Collapse" : "Maximize"}>
                {isExpanded ? <Minimize className="w-5 h-5 text-slate-600 dark:text-slate-400" /> : <Maximize className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
            </button>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
            <button onClick={handleReset} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Reset Layout"><RefreshCw className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
            {onMapToCode && (
                <>
                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                    <button onClick={onMapToCode} className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded transition-colors" title="Map to Code">
                        <FileCode2 className="w-5 h-5" />
                    </button>
                </>
            )}
        </div>
    );

    // Header for expanded view
    const expandedHeader = isExpanded && (
        <div className="absolute top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 z-30 shadow-sm">
            <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full font-bold text-xs uppercase tracking-wide">DAG Analysis</div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-white">Execution Plan Visualization</h2>
            </div>
            <button onClick={() => handleSetExpanded(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500" />
            </button>
        </div>
    );

    const content = (
        <div className={`
            relative bg-slate-50 dark:bg-slate-950 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 group transition-all duration-300
            ${isExpanded ? 'w-full h-full rounded-none border-0' : 'w-full h-[800px]'}
        `}>
            {expandedHeader}

            {sidebarOpen && (
                <NodeDetailsSidebar
                    selectedNode={selectedNodeId ? mapToSidebarNode(layout.nodes.find(n => n.id === selectedNodeId)) : null}
                    onClose={() => setSidebarOpen(false)}
                    onCopyDetails={handleCopyDetails}
                />
            )}

            {/* Background Grid */}
            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle, ${theme === 'dark' ? '#94a3b8' : '#cbd5e1'} 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                    transform: `translate(${internalTransform.x}px, ${internalTransform.y}px) scale(${internalTransform.k})`
                }}
            />

            {/* Main Canvas Area */}
            <div
                ref={containerRef}
                className={`w-full h-full cursor-grab active:cursor-grabbing ${isExpanded ? 'pt-16' : ''}`} // Add padding top if expanded for header
            >
                <div
                    style={{
                        transform: `translate(${internalTransform.x}px, ${internalTransform.y}px) scale(${internalTransform.k})`,
                        transformOrigin: '0 0',
                        width: '100%',
                        height: '100%',
                        position: 'relative' // Needed for absolute children
                    }}
                >
                    {/* Stages Backgrounds */}
                    {layout.stages.map(stage => (
                        <div
                            key={stage.id}
                            className="absolute top-0 border-l border-r border-slate-200 dark:border-slate-800/50 bg-slate-100/30 dark:bg-slate-900/30"
                            style={{
                                left: stage.x - 40,
                                width: 380, // STAGE_WIDTH + gaps
                                height: layout.height,
                                zIndex: 0
                            }}
                        >
                            <div className="text-center font-bold text-slate-300 dark:text-slate-700 mt-4 text-xl uppercase tracking-widest">{stage.label}</div>
                        </div>
                    ))}

                    <svg
                        className="absolute top-0 left-0 overflow-visible pointer-events-none"
                        style={{ width: 1, height: 1, zIndex: 5 }}
                    >
                        {layout.links.map((link: any, i) => (
                            <DAGLink
                                key={i}
                                source={link.source}
                                target={link.target}
                                theme={theme as any}
                                isHighlighted={false}
                                isBottleneck={link.target.isBottleneck}
                            />
                        ))}
                    </svg>

                    {layout.nodes.map((node: any) => (
                        <DAGNode
                            key={node.id}
                            node={node}
                            selected={selectedNodeId === node.id}
                            onClick={(e) => { e.stopPropagation(); handleSetSelectedNode(node.id); }}
                            onMouseEnter={() => { }}
                            onMouseLeave={() => { }}
                            theme={theme as any}
                        />
                    ))}
                </div>
            </div>

            {/* Controls */}
            {!isExpanded && controls}
            {isExpanded && (
                <div className="absolute top-20 right-4 flex flex-col gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-20">
                    <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Zoom In"><ZoomIn className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
                    <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Zoom Out"><ZoomOut className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
                    <button onClick={() => handleSetExpanded(!isExpanded)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title={isExpanded ? "Collapse" : "Maximize"}>
                        {isExpanded ? <Minimize className="w-5 h-5 text-slate-600 dark:text-slate-400" /> : <Maximize className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
                    </button>
                    <button onClick={handleReset} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Reset Layout"><RefreshCw className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
                </div>
            )}

            {/* Minimap */}
            <DAGMinimap
                nodes={layout.nodes}
                width={200}
                height={150}
                contentWidth={layout.width}
                contentHeight={layout.height}
                viewX={internalTransform.x}
                viewY={internalTransform.y}
                zoom={internalTransform.k}
                onNavigate={() => { }} // Could implement click-to-nav
                theme={theme as any}
            />

        </div>
    );

    if (isExpanded) {
        return createPortal(
            <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 animate-fade-in text-slate-900 dark:text-slate-100">
                {content}
            </div>,
            document.body
        );
    }

    return content;
};
