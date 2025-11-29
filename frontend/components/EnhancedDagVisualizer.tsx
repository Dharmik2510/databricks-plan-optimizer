import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { DagNode, DagLink, OptimizationTip } from '../../shared/types';
import { ZoomIn, ZoomOut, Download, AlertCircle, Zap, Eye, EyeOff } from 'lucide-react';

interface Props {
  nodes: DagNode[];
  links: DagLink[];
  optimizations: OptimizationTip[];
}

interface EnhancedNode extends d3.SimulationNodeDatum, DagNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  level?: number;
  isBottleneck?: boolean;
  bottleneckSeverity?: 'critical' | 'high' | 'medium' | 'low';
  estimatedCost?: number;
  rowsProcessed?: number;
}

export const EnhancedDagVisualizer: React.FC<Props> = ({ nodes, links, optimizations }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<EnhancedNode | null>(null);
  const [highlightMode, setHighlightMode] = useState<'bottlenecks' | 'cost' | 'none'>('bottlenecks');
  const [showMetrics, setShowMetrics] = useState(true);

  // Helper methods
  const isBottleneckNode = (node: DagNode, opts: OptimizationTip[]): boolean => {
    return opts.some(opt => 
      opt.title.toLowerCase().includes(node.type.toLowerCase()) ||
      opt.affected_stages?.some(stage => node.id.includes(stage))
    );
  };

  const getBottleneckSeverity = (node: DagNode, opts: OptimizationTip[]): 'critical' | 'high' | 'medium' | 'low' => {
    const relatedOpt = opts.find(opt => 
      opt.title.toLowerCase().includes(node.type.toLowerCase())
    );
    
    if (!relatedOpt) return 'low';
    
    if (relatedOpt.severity === 'High') return 'critical';
    if (relatedOpt.severity === 'Medium') return 'high';
    return 'medium';
  };

  const estimateNodeCost = (node: DagNode): number => {
    const type = node.type.toLowerCase();
    if (type.includes('cartesian') || type.includes('nestedloop')) return 100;
    if (type.includes('exchange') || type.includes('shuffle')) return 50;
    if (type.includes('aggregate') || type.includes('sort')) return 30;
    if (type.includes('join')) return 40;
    if (type.includes('scan')) return 20;
    return 10;
  };

  const extractRowCount = (node: DagNode): number => {
    const match = node.metric?.match(/([\d.]+)([KMB])/);
    if (!match) return 0;
    const multipliers: any = { K: 1000, M: 1000000, B: 1000000000 };
    return parseFloat(match[1]) * multipliers[match[2]];
  };

  const enhancedLayout = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, EnhancedNode>();
    
    nodes.forEach(n => {
      adjacency.set(n.id, []);
      inDegree.set(n.id, 0);
      
      const enhanced: EnhancedNode = {
        ...n,
        isBottleneck: isBottleneckNode(n, optimizations),
        bottleneckSeverity: getBottleneckSeverity(n, optimizations),
        estimatedCost: estimateNodeCost(n),
        rowsProcessed: extractRowCount(n)
      };
      nodeMap.set(n.id, enhanced);
    });

    links.forEach(l => {
      adjacency.get(l.source)?.push(l.target);
      inDegree.set(l.target, (inDegree.get(l.target) || 0) + 1);
    });

    const levels = new Map<string, number>();
    const queue: string[] = [];
    
    nodes.forEach(n => {
      if ((inDegree.get(n.id) || 0) === 0) {
        levels.set(n.id, 0);
        queue.push(n.id);
      }
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      const currentLevel = levels.get(u)!;
      
      adjacency.get(u)?.forEach(v => {
        const existingLevel = levels.get(v) || -1;
        if (currentLevel + 1 > existingLevel) {
          levels.set(v, currentLevel + 1);
          queue.push(v);
        }
      });
    }

    nodes.forEach(n => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
      const node = nodeMap.get(n.id)!;
      node.level = levels.get(n.id);
    });

    return { levels, nodeMap, maxLevel: Math.max(...levels.values()) };
  }, [nodes, links, optimizations]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = 700;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("cursor", "grab");

    const defs = svg.append("defs");
    
    const criticalGradient = defs.append("linearGradient")
      .attr("id", "criticalGradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");
    criticalGradient.append("stop").attr("offset", "0%").attr("stop-color", "#ef4444").attr("stop-opacity", 0.8);
    criticalGradient.append("stop").attr("offset", "100%").attr("stop-color", "#dc2626").attr("stop-opacity", 1);

    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 35)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#64748b"); // Slate 500 works for both

    defs.append("marker")
      .attr("id", "criticalArrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 35)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#ef4444");

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(50, height / 2).scale(0.7));

    const simNodes: EnhancedNode[] = Array.from(enhancedLayout.nodeMap.values()).map((n: EnhancedNode) => ({
      ...n,
      x: (n.level || 0) * 240,
      y: height / 2 + (Math.random() - 0.5) * 120
    }));

    const simLinks = links.map(l => ({ ...l }));

    const simulation = d3.forceSimulation<EnhancedNode>(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-2000))
      .force("collide", d3.forceCollide().radius(90))
      .force("x", d3.forceX((d: any) => (d.level || 0) * 250).strength(2))
      .force("y", d3.forceY(height / 2).strength(0.1));

    const link = g.append("g")
      .selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("stroke", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.isBottleneck ? "#ef4444" : "#94a3b8";
      })
      .attr("stroke-width", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.isBottleneck ? 4 : 2;
      })
      .attr("stroke-opacity", 0.7)
      .attr("fill", "none")
      .attr("marker-end", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.isBottleneck ? "url(#criticalArrow)" : "url(#arrowhead)";
      })
      .style("stroke-dasharray", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.bottleneckSeverity === 'critical' ? "5,5" : "none";
      });

    link.filter((d: any) => {
      const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
      return targetNode?.bottleneckSeverity === 'critical';
    })
    .style("animation", "pulse 2s infinite");

    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", function(event, d) {
        setSelectedNode(d);
      })
      .call(d3.drag<SVGGElement, EnhancedNode>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.filter(d => d.isBottleneck!)
      .append("circle")
      .attr("r", 36)
      .attr("fill", "none")
      .attr("stroke", d => {
        switch (d.bottleneckSeverity) {
          case 'critical': return '#ef4444';
          case 'high': return '#f97316';
          case 'medium': return '#eab308';
          default: return '#10b981';
        }
      })
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", "4,4")
      .style("animation", "rotate 3s linear infinite");

    node.append("circle")
      .attr("r", 30)
      .attr("fill", d => {
        if (d.isBottleneck) {
          switch (d.bottleneckSeverity) {
            case 'critical': return '#fee2e2';
            case 'high': return '#fed7aa';
            case 'medium': return '#fef3c7';
            default: return '#d1fae5';
          }
        }
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#e0e7ff';
        if (t.includes('scan')) return '#dcfce7';
        if (t.includes('join')) return '#fef3c7';
        return '#ffffff';
      })
      .attr("stroke", d => {
        if (d.isBottleneck) {
          switch (d.bottleneckSeverity) {
            case 'critical': return '#ef4444';
            case 'high': return '#f97316';
            default: return '#eab308';
          }
        }
        const t = d.type.toLowerCase();
        if (t.includes('shuffle')) return '#6366f1';
        if (t.includes('scan')) return '#16a34a';
        if (t.includes('join')) return '#d97706';
        return '#64748b';
      })
      .attr("stroke-width", d => d.isBottleneck ? 4 : 3)
      .style("filter", "drop-shadow(0px 4px 8px rgba(0,0,0,0.15))");

    node.append("circle")
      .attr("r", 8)
      .attr("fill", d => {
        if (d.isBottleneck) return '#ef4444';
        const t = d.type.toLowerCase();
        if (t.includes('shuffle')) return '#6366f1';
        if (t.includes('scan')) return '#16a34a';
        if (t.includes('join')) return '#d97706';
        return '#64748b';
      });

    node.filter(d => d.isBottleneck!)
      .append("text")
      .attr("x", 20)
      .attr("y", -20)
      .attr("text-anchor", "middle")
      .text("⚠")
      .attr("font-size", "16px")
      .style("pointer-events", "none");

    // Text rendering: We keep the fill dark (#0f172a) because the nodes are light-colored even in dark mode.
    // However, the stroke (halo) should match the background if we want true transparency, 
    // but here the node bubbles are always light, so white halo is correct.
    
    // 1. Halo (Stroke)
    node.append("text")
      .attr("x", 0)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .text(d => d.name.length > 20 ? d.name.substring(0, 18) + "..." : d.name)
      .attr("font-weight", "700")
      .attr("font-size", "13px")
      .attr("stroke", "#ffffff") // Always white halo as node backgrounds are light
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("fill", "none")
      .style("pointer-events", "none");

    // 2. Foreground (Fill)
    node.append("text")
      .attr("x", 0)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .text(d => d.name.length > 20 ? d.name.substring(0, 18) + "..." : d.name)
      .attr("font-weight", "700")
      .attr("font-size", "13px")
      .attr("fill", "#0f172a") // Always dark text as node backgrounds are light
      .style("pointer-events", "none");

    // Metric Label - Halo
    node.append("text")
      .attr("x", 0)
      .attr("y", 50)
      .attr("text-anchor", "middle")
      .text(d => {
        if (showMetrics && d.rowsProcessed) {
          return d.rowsProcessed > 1000000 
            ? `${(d.rowsProcessed / 1000000).toFixed(1)}M rows`
            : `${(d.rowsProcessed / 1000).toFixed(0)}K rows`;
        }
        return d.metric || "";
      })
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 3)
      .attr("stroke-linejoin", "round")
      .attr("fill", "none")
      .style("pointer-events", "none");

    // Metric Label - Fill
    node.append("text")
      .attr("x", 0)
      .attr("y", 50)
      .attr("text-anchor", "middle")
      .text(d => {
        if (showMetrics && d.rowsProcessed) {
          return d.rowsProcessed > 1000000 
            ? `${(d.rowsProcessed / 1000000).toFixed(1)}M rows`
            : `${(d.rowsProcessed / 1000).toFixed(0)}K rows`;
        }
        return d.metric || "";
      })
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", d => d.isBottleneck ? "#ef4444" : "#475569")
      .style("pointer-events", "none");

    node.filter(d => (d.estimatedCost || 0) > 40)
      .append("text")
      .attr("x", 0)
      .attr("y", 65)
      .attr("text-anchor", "middle")
      .text(d => `$${((d.estimatedCost || 0) / 10).toFixed(1)}`)
      .attr("font-size", "9px")
      .attr("font-weight", "700")
      .attr("fill", "#dc2626")
      .style("pointer-events", "none");

    function linkArc(d: any) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      if (Math.abs(dy) < 25) {
        return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      }
      const dr = Math.sqrt(dx * dx + dy * dy);
      return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
    }

    simulation.on("tick", () => {
      link.attr("d", linkArc);
      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      svg.style("cursor", "grabbing");
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
      svg.style("cursor", "grab");
    }

    return () => simulation.stop();
  }, [nodes, links, enhancedLayout, showMetrics, highlightMode]);

  const exportDAG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'execution-plan-dag.svg';
    a.click();
  };

  return (
    <div ref={containerRef} className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[700px] relative group ring-1 ring-slate-100 dark:ring-slate-800 transition-colors">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center flex-shrink-0">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg drop-shadow-sm">Intelligent Execution Flow</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {nodes.filter(n => enhancedLayout.nodeMap.get(n.id)?.isBottleneck).length} bottlenecks detected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-1">
            <button onClick={() => setHighlightMode('bottlenecks')} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${highlightMode === 'bottlenecks' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}><AlertCircle className="w-3 h-3 inline mr-1" />Issues</button>
            <button onClick={() => setHighlightMode('cost')} className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${highlightMode === 'cost' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400'}`}><Zap className="w-3 h-3 inline mr-1" />Cost</button>
          </div>
          <button onClick={() => setShowMetrics(!showMetrics)} className="p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">{showMetrics ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
          <button onClick={exportDAG} className="p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><Download className="w-4 h-4" /></button>
          <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <button onClick={() => {}} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => {}} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-l border-slate-200 dark:border-slate-700 transition-colors"><ZoomOut className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-white dark:bg-slate-950">
        <div className="absolute inset-0 opacity-15 dark:opacity-5" style={{ backgroundImage: 'radial-gradient(#64748b 1.5px, transparent 1.5px)', backgroundSize: '25px 25px' }}></div>
        <svg ref={svgRef} className="w-full h-full block relative z-10"></svg>
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 animate-fade-in z-20">
            <button onClick={() => setSelectedNode(null)} className="absolute top-2 right-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">×</button>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">{selectedNode.name}</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">Type:</span><span className="font-bold text-slate-900 dark:text-white">{selectedNode.type}</span></div>
              <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">Level:</span><span className="font-bold text-slate-900 dark:text-white">Stage {selectedNode.level}</span></div>
              {selectedNode.rowsProcessed && <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-400">Rows:</span><span className="font-bold text-slate-900 dark:text-white">{(selectedNode.rowsProcessed / 1000000).toFixed(2)}M</span></div>}
              {selectedNode.isBottleneck && <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"><div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs mb-2"><AlertCircle className="w-4 h-4" />PERFORMANCE BOTTLENECK</div><p className="text-xs text-red-600 dark:text-red-300">This operation is slowing down your pipeline. Check optimizations tab.</p></div>}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } } @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};