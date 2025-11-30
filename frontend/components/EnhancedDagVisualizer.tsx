
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3Base from 'd3';
import { DagNode, DagLink, OptimizationTip } from '../../shared/types';
import { ZoomIn, ZoomOut, Download, AlertCircle, Zap, Eye, EyeOff, Maximize, Layers } from 'lucide-react';
import { useTheme } from '../ThemeContext';

const d3: any = d3Base;

interface Props {
  nodes: DagNode[];
  links: DagLink[];
  optimizations: OptimizationTip[];
}

interface EnhancedNode extends DagNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
  level?: number;
  indexInLevel?: number;
  isBottleneck?: boolean;
  bottleneckSeverity?: 'critical' | 'high' | 'medium' | 'low';
  estimatedCost?: number;
  rowsProcessed?: number;
}

interface StageGroup {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export const EnhancedDagVisualizer: React.FC<Props> = ({ nodes, links, optimizations }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<EnhancedNode | null>(null);
  const [highlightMode, setHighlightMode] = useState<'bottlenecks' | 'cost' | 'none'>('bottlenecks');
  const [showMetrics, setShowMetrics] = useState(true);
  const { theme } = useTheme();

  // Constants for Grid Layout
  const STAGE_WIDTH = 280;
  const STAGE_GAP = 60;
  const NODE_HEIGHT = 120;
  const STAGE_PADDING = 60;

  // Colors based on theme
  const colors = useMemo(() => ({
    stageBorder: theme === 'dark' ? '#334155' : '#e2e8f0', // slate-700 : slate-200
    stageText: theme === 'dark' ? '#94a3b8' : '#64748b',   // slate-400 : slate-500
    linkStroke: theme === 'dark' ? '#475569' : '#cbd5e1',  // slate-600 : slate-300
    nodeHalo: theme === 'dark' ? '#0f172a' : '#ffffff',    // slate-900 : white
    nodeText: theme === 'dark' ? '#f8fafc' : '#0f172a',    // slate-50 : slate-900
    metricFill: theme === 'dark' ? '#94a3b8' : '#475569',  // slate-400 : slate-600
  }), [theme]);

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

  // Enhanced topological sorting + Stage Grouping
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

    // BFS for Leveling (Stage Assignment)
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

    // Assign final levels and calculate grid positions
    const nodesPerLevel = new Map<number, number>();
    
    nodes.forEach(n => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
      const level = levels.get(n.id)!;
      const node = nodeMap.get(n.id)!;
      
      node.level = level;
      node.indexInLevel = nodesPerLevel.get(level) || 0;
      nodesPerLevel.set(level, (nodesPerLevel.get(level) || 0) + 1);
    });

    const maxLevel = Math.max(...levels.values());
    const stages: StageGroup[] = [];

    // Create Stage Groups metadata
    for (let i = 0; i <= maxLevel; i++) {
        const count = nodesPerLevel.get(i) || 0;
        stages.push({
            id: i,
            x: i * (STAGE_WIDTH + STAGE_GAP),
            y: 0,
            width: STAGE_WIDTH,
            height: Math.max(400, count * NODE_HEIGHT + STAGE_PADDING * 2), // Min height
            label: `Stage ${i + 10}` // Simulation of Spark Stage IDs (starting at 10 for realism)
        });
    }

    return { levels, nodeMap, maxLevel, stages };
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
    
    // Critical Gradient
    const criticalGradient = defs.append("linearGradient")
      .attr("id", "criticalGradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");
    criticalGradient.append("stop").attr("offset", "0%").attr("stop-color", "#ef4444").attr("stop-opacity", 0.8);
    criticalGradient.append("stop").attr("offset", "100%").attr("stop-color", "#dc2626").attr("stop-opacity", 1);

    // Markers
    const addMarker = (id: string, color: string) => {
        defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 32) // Adjusted for new node size
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    };
    addMarker("arrowhead", colors.linkStroke);
    addMarker("criticalArrow", "#ef4444");

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    // Initial transform to center the graph somewhat
    svg.call(zoom.transform, d3.zoomIdentity.translate(50, 50).scale(0.65));

    // --- DRAW STAGE BOXES (BACKGROUND) ---
    const stageGroup = g.append("g").attr("class", "stages");
    
    stageGroup.selectAll("rect")
        .data(enhancedLayout.stages)
        .join("rect")
        .attr("x", (d: any) => d.x)
        .attr("y", -50) // Start a bit higher for label
        .attr("width", (d: any) => d.width)
        .attr("height", (d: any) => d.height + 100)
        .attr("rx", 16)
        .attr("fill", "transparent")
        .attr("stroke", colors.stageBorder) // Dynamic
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "8,8"); 

    // Stage Labels
    stageGroup.selectAll("text")
        .data(enhancedLayout.stages)
        .join("text")
        .attr("x", (d: any) => d.x + 20)
        .attr("y", -20)
        .text((d: any) => d.label)
        .attr("font-family", "Inter, sans-serif")
        .attr("font-weight", "bold")
        .attr("font-size", "14px")
        .attr("fill", colors.stageText); // Dynamic

    // --- SIMULATION SETUP ---
    const simNodes: EnhancedNode[] = Array.from(enhancedLayout.nodeMap.values()).map((n: EnhancedNode) => ({
      ...n,
      // Initial Position based on grid
      x: n.level! * (STAGE_WIDTH + STAGE_GAP) + STAGE_WIDTH/2,
      y: n.indexInLevel! * NODE_HEIGHT + 100
    }));

    const simLinks = links.map(l => ({ ...l }));

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(100).strength(0.1)) // Weak link force to allow grid to dominate
      .force("charge", d3.forceManyBody().strength(-500))
      .force("collide", d3.forceCollide().radius(60).strength(1))
      // Strong Grid Forces to keep layout structure
      .force("x", d3.forceX((d: any) => d.level * (STAGE_WIDTH + STAGE_GAP) + STAGE_WIDTH/2).strength(0.8))
      .force("y", d3.forceY((d: any) => d.indexInLevel * NODE_HEIGHT + 100).strength(0.8));

    // --- DRAW LINKS ---
    const link = g.append("g")
      .selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("stroke", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.isBottleneck ? "#ef4444" : colors.linkStroke; // Dynamic
      })
      .attr("stroke-width", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.isBottleneck ? 3 : 2;
      })
      .attr("stroke-opacity", 0.8)
      .attr("fill", "none")
      .attr("marker-end", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.isBottleneck ? "url(#criticalArrow)" : "url(#arrowhead)";
      })
      .style("stroke-dasharray", (d: any) => {
        const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
        return targetNode?.bottleneckSeverity === 'critical' ? "5,5" : "none";
      });

    // Animate critical paths
    link.filter((d: any) => {
      const targetNode = simNodes.find(n => n.id === d.target.id || n.id === d.target);
      return targetNode?.bottleneckSeverity === 'critical';
    })
    .style("animation", "pulse 2s infinite");

    // --- DRAW NODES ---
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", function(event: any, d: any) {
        event.stopPropagation();
        setSelectedNode(d);
      })
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node outer ring (bottleneck indicator)
    node.filter((d: any) => d.isBottleneck!)
      .append("circle")
      .attr("r", 32)
      .attr("fill", "none")
      .attr("stroke", (d: any) => {
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

    // Node background circle
    node.append("circle")
      .attr("r", 26)
      .attr("fill", (d: any) => {
        if (d.isBottleneck) {
          switch (d.bottleneckSeverity) {
            case 'critical': return '#fee2e2';
            case 'high': return '#fed7aa';
            case 'medium': return '#fef3c7';
            default: return '#d1fae5';
          }
        }
        
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#e0e7ff'; // Indigo
        if (t.includes('scan')) return '#dcfce7'; // Green
        if (t.includes('join')) return '#fef3c7'; // Amber
        return '#ffffff';
      })
      .attr("stroke", (d: any) => {
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
        return '#64748b'; // Slate
      })
      .attr("stroke-width", (d: any) => d.isBottleneck ? 4 : 3)
      .style("filter", "drop-shadow(0px 4px 8px rgba(0,0,0,0.1))");

    // Inner icon dot
    node.append("circle")
      .attr("r", 6)
      .attr("fill", (d: any) => {
        if (d.isBottleneck) return '#ef4444';
        const t = d.type.toLowerCase();
        if (t.includes('shuffle')) return '#6366f1';
        if (t.includes('scan')) return '#16a34a';
        if (t.includes('join')) return '#d97706';
        return '#64748b';
      });

    // Warning Icon for Bottlenecks
    node.filter((d: any) => d.isBottleneck!)
      .append("text")
      .attr("x", 18)
      .attr("y", -18)
      .attr("text-anchor", "middle")
      .text("⚠️")
      .attr("font-size", "14px")
      .style("pointer-events", "none");

    // --- TEXT RENDERING ---
    // 1. Halo
    node.append("text")
      .attr("x", 0)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text((d: any) => d.name.length > 20 ? d.name.substring(0, 18) + "..." : d.name)
      .attr("font-weight", "700")
      .attr("font-size", "12px")
      .attr("stroke", colors.nodeHalo) // Dynamic
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round")
      .attr("fill", "none")
      .style("pointer-events", "none");

    // 2. Foreground
    node.append("text")
      .attr("x", 0)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text((d: any) => d.name.length > 20 ? d.name.substring(0, 18) + "..." : d.name)
      .attr("font-weight", "700")
      .attr("font-size", "12px")
      .attr("fill", colors.nodeText) // Dynamic
      .style("pointer-events", "none");

    // Metric Label
    node.append("text")
      .attr("x", 0)
      .attr("y", 45)
      .attr("text-anchor", "middle")
      .text((d: any) => {
        if (showMetrics && d.rowsProcessed) {
          return d.rowsProcessed > 1000000 
            ? `${(d.rowsProcessed / 1000000).toFixed(1)}M rows`
            : `${(d.rowsProcessed / 1000).toFixed(0)}K rows`;
        }
        return d.metric || "";
      })
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", (d: any) => d.isBottleneck ? "#ef4444" : colors.metricFill) // Dynamic
      .style("pointer-events", "none")
      .style("text-shadow", theme === 'dark' ? "0 1px 2px rgba(0,0,0,0.8)" : "0 1px 2px rgba(255,255,255,0.8)");

    // Cost Badge
    node.filter((d: any) => (d.estimatedCost || 0) > 40)
      .append("text")
      .attr("x", 0)
      .attr("y", 58)
      .attr("text-anchor", "middle")
      .text((d: any) => `$${((d.estimatedCost || 0) / 10).toFixed(1)}`)
      .attr("font-size", "9px")
      .attr("font-weight", "700")
      .attr("fill", "#dc2626")
      .style("pointer-events", "none");

    // Bezier Curve Link Function
    function linkArc(d: any) {
      const sourceX = d.source.x;
      const sourceY = d.source.y;
      const targetX = d.target.x;
      const targetY = d.target.y;

      // Cubic Bezier for smooth flow between columns
      const curvature = 0.5;
      const xi = d3.interpolateNumber(sourceX, targetX);
      const x2 = xi(curvature);
      const x3 = xi(1 - curvature);

      return `M${sourceX},${sourceY} C${x2},${sourceY} ${x3},${targetY} ${targetX},${targetY}`;
    }

    simulation.on("tick", () => {
      link.attr("d", linkArc);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
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
  }, [nodes, links, enhancedLayout, showMetrics, highlightMode, colors]); // Add colors to dependency array

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
    <div ref={containerRef} className="w-full bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[750px] relative group ring-1 ring-slate-100 dark:ring-slate-800 transition-colors">
      
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center flex-shrink-0">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-lg drop-shadow-sm flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Intelligent Execution Flow
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-7">
            {nodes.filter(n => enhancedLayout.nodeMap.get(n.id)?.isBottleneck).length} bottlenecks detected • {enhancedLayout.stages.length} stages identified
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Highlight mode selector */}
          <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-1">
            <button 
              onClick={() => setHighlightMode('bottlenecks')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${highlightMode === 'bottlenecks' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}
            >
              <AlertCircle className="w-3 h-3 inline mr-1" />
              Issues
            </button>
            <button 
              onClick={() => setHighlightMode('cost')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${highlightMode === 'cost' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'text-slate-600 dark:text-slate-400'}`}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              Cost
            </button>
          </div>

          <button 
            onClick={() => setShowMetrics(!showMetrics)}
            className="p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Toggle Metrics"
          >
            {showMetrics ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          <button 
            onClick={exportDAG}
            className="p-2 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Export SVG"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <button 
              onClick={() => {/* zoom in via d3 handles this */}} 
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {/* zoom out via d3 handles this */}} 
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-l border-slate-200 dark:border-slate-700 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-slate-50/50 dark:bg-slate-950">
        <div className="absolute inset-0 opacity-10 dark:opacity-5" style={{ 
          backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)', 
          backgroundSize: '20px 20px' 
        }}></div>
        <svg ref={svgRef} className="w-full h-full block relative z-10"></svg>
        
        {/* Node detail panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 animate-fade-in z-20">
            <button 
              onClick={() => setSelectedNode(null)}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              ×
            </button>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4 pr-6 break-words">{selectedNode.name}</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Type:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedNode.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Stage:</span>
                <span className="font-bold text-slate-900 dark:text-white">Stage {selectedNode.level! + 10}</span>
              </div>
              {selectedNode.rowsProcessed && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Rows:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {(selectedNode.rowsProcessed / 1000000).toFixed(2)}M
                  </span>
                </div>
              )}
              {selectedNode.isBottleneck && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs mb-2">
                    <AlertCircle className="w-4 h-4" />
                    PERFORMANCE BOTTLENECK
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-300">
                    This operation is slowing down your pipeline. Check optimizations tab.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
