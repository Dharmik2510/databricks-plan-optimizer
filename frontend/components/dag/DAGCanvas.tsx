import React, { useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import { DAGNode } from './DAGNode';
import { DAGLink } from './DAGLink';
import { DAGMinimap } from './DAGMinimap';
import { useTheme } from '../../ThemeContext';
import { DagNode, DagLink, OptimizationTip } from '../../../shared/types';
import { ZoomIn, ZoomOut, Maximize, RefreshCw } from 'lucide-react';
import { useDagLayout } from '../../hooks/useDagLayout';

interface DAGCanvasProps {
    nodes: DagNode[];
    links: DagLink[];
    optimizations: OptimizationTip[];
}

export const DAGCanvas: React.FC<DAGCanvasProps> = ({ nodes: rawNodes, links: rawLinks, optimizations }) => {
    const { theme } = useTheme();
    const containerRef = useRef<HTMLDivElement>(null);
    const layout = useDagLayout(rawNodes, rawLinks, optimizations);

    // State
    const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    // D3 Zoom Behavior setup
    const zoomRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (e) => {
                setTransform(e.transform);
            });

        zoomRef.current = zoom;
        d3.select(containerRef.current).call(zoom as any);

        // Initial Zoom to fit
        if (layout.width > 0) {
            const initialScale = Math.min(0.8, containerRef.current.clientWidth / layout.width);
            d3.select(containerRef.current).call(zoom.transform as any, d3.zoomIdentity.translate(50, 50).scale(initialScale));
        }
    }, [layout.width, isExpanded]); // Re-run if layout size changes significantly

    const handleZoomIn = () => {
        if (containerRef.current && zoomRef.current) {
            d3.select(containerRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.2);
        }
    };

    const handleZoomOut = () => {
        if (containerRef.current && zoomRef.current) {
            d3.select(containerRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.8);
        }
    };

    const handleReset = () => {
        if (containerRef.current && zoomRef.current) {
            const initialScale = Math.min(0.8, containerRef.current.clientWidth / layout.width);
            d3.select(containerRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity.translate(50, 50).scale(initialScale));
        }
    };

    return (
        <div className={`
            relative bg-slate-50 dark:bg-slate-950 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 group transition-all duration-300
            ${isExpanded ? 'fixed inset-4 z-50 shadow-2xl h-auto' : 'w-full h-[800px]'}
        `}>

            {/* Background Grid */}
            <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle, ${theme === 'dark' ? '#94a3b8' : '#cbd5e1'} 1px, transparent 1px)`,
                    backgroundSize: '24px 24px',
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`
                }}
            />

            {/* Main Canvas Area */}
            <div
                ref={containerRef}
                className="w-full h-full cursor-grab active:cursor-grabbing"
            >
                <div
                    style={{
                        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
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
                            onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                            onMouseEnter={() => { }}
                            onMouseLeave={() => { }}
                            theme={theme as any}
                        />
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg z-20">
                <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Zoom In"><ZoomIn className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
                <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Zoom Out"><ZoomOut className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
                <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title={isExpanded ? "Collapse" : "Maximize"}><Maximize className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
                <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />
                <button onClick={handleReset} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title="Reset Layout"><RefreshCw className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
            </div>

            {/* Minimap */}
            <DAGMinimap
                nodes={layout.nodes}
                width={200}
                height={150}
                contentWidth={layout.width}
                contentHeight={layout.height}
                viewX={transform.x}
                viewY={transform.y}
                zoom={transform.k}
                onNavigate={() => { }} // Could implement click-to-nav
                theme={theme as any}
            />

        </div>
    );
};

