
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3Base from 'd3';
import { DagNode, DagLink, OptimizationTip } from '../../shared/types';
import { 
  ZoomIn, ZoomOut, AlertCircle, Zap, 
  Layers, DollarSign, AlertTriangle,
  X, Activity, Target, Maximize2, Minimize2
} from 'lucide-react';
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
  relatedOptimization?: OptimizationTip;
}

interface StageGroup {
  id: number;
  x: number;
  nodeCount: number;
  label: string;
}

type HighlightMode = 'all' | 'issues' | 'cost';

export const EnhancedDagVisualizer: React.FC<Props> = ({ nodes, links, optimizations }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<any>(null);
  const zoomRef = useRef<any>(null);
  
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNode, setSelectedNode] = useState<EnhancedNode | null>(null);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('all');
  const [showMetrics, setShowMetrics] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const { theme } = useTheme();

  // Layout constants
  const STAGE_WIDTH = 300; // Increased for better spacing
  const STAGE_GAP = 100;
  const NODE_VERTICAL_SPACING = 140;
  const NODE_RADIUS = 36;

  // Theme-aware colors
  const colors = useMemo(() => ({
    // Background & Structure
    canvasBg: theme === 'dark' ? '#0c0f1a' : '#f8fafc',
    stageBg: theme === 'dark' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.6)',
    stageBorder: theme === 'dark' ? '#334155' : '#e2e8f0',
    stageText: theme === 'dark' ? '#64748b' : '#94a3b8',
    
    // Links
    linkDefault: theme === 'dark' ? '#475569' : '#cbd5e1',
    linkHighlight: theme === 'dark' ? '#f97316' : '#ea580c',
    linkCritical: '#ef4444',
    
    // Node colors
    nodeStroke: theme === 'dark' ? '#1e293b' : '#ffffff',
    nodeText: theme === 'dark' ? '#f1f5f9' : '#0f172a',
    nodeTextShadow: theme === 'dark' ? '#000000' : '#ffffff',
    metricText: theme === 'dark' ? '#94a3b8' : '#64748b',
    
    // Node type fills
    scanFill: theme === 'dark' ? '#065f46' : '#d1fae5',
    scanStroke: '#10b981',
    shuffleFill: theme === 'dark' ? '#312e81' : '#e0e7ff',
    shuffleStroke: '#6366f1',
    joinFill: theme === 'dark' ? '#78350f' : '#fef3c7',
    joinStroke: '#f59e0b',
    filterFill: theme === 'dark' ? '#164e63' : '#cffafe',
    filterStroke: '#06b6d4',
    defaultFill: theme === 'dark' ? '#1e293b' : '#f1f5f9',
    defaultStroke: theme === 'dark' ? '#475569' : '#94a3b8',
    
    // Severity colors
    criticalFill: theme === 'dark' ? '#450a0a' : '#fee2e2',
    criticalStroke: '#ef4444',
    highFill: theme === 'dark' ? '#431407' : '#ffedd5',
    highStroke: '#f97316',
    mediumFill: theme === 'dark' ? '#422006' : '#fef3c7',
    mediumStroke: '#eab308',
    
    // Cost gradient
    costLow: '#10b981',
    costMed: '#f59e0b',
    costHigh: '#ef4444',
  }), [theme]);

  // Helper methods
  const isBottleneckNode = useCallback((node: DagNode): OptimizationTip | null => {
    const nodeTypeLower = node.type.toLowerCase();
    const nodeNameLower = node.name.toLowerCase();
    
    for (const opt of optimizations) {
      const titleLower = opt.title.toLowerCase();
      const descLower = opt.description.toLowerCase();
      
      if (nodeTypeLower.includes('nestedloop') && (titleLower.includes('cartesian') || titleLower.includes('join'))) return opt;
      if (nodeTypeLower.includes('exchange') && (titleLower.includes('shuffle') || titleLower.includes('partition'))) return opt;
      if (nodeTypeLower.includes('broadcast') && titleLower.includes('broadcast')) return opt;
      
      if (opt.affected_stages?.some(stage => node.id.toLowerCase().includes(stage.toLowerCase()) || nodeNameLower.includes(stage.toLowerCase()))) return opt;
      if (descLower.includes(nodeTypeLower) || titleLower.includes(nodeTypeLower)) return opt;
    }
    return null;
  }, [optimizations]);

  const getBottleneckSeverity = useCallback((opt: OptimizationTip | null): 'critical' | 'high' | 'medium' | 'low' => {
    if (!opt) return 'low';
    if (opt.severity === 'High') return 'critical';
    if (opt.severity === 'Medium') return 'high';
    return 'medium';
  }, []);

  const estimateNodeCost = useCallback((node: DagNode, relatedOpt: OptimizationTip | null): number => {
    const type = node.type.toLowerCase();
    let baseCost = 10;
    if (type.includes('cartesian') || type.includes('nestedloop')) baseCost = 95;
    else if (type.includes('exchange') || type.includes('shuffle')) baseCost = 60;
    else if (type.includes('broadcast')) baseCost = 40;
    else if (type.includes('aggregate') || type.includes('sort')) baseCost = 35;
    else if (type.includes('join')) baseCost = 50;
    else if (type.includes('scan')) baseCost = 20;
    
    if (relatedOpt) {
      if (relatedOpt.severity === 'High') baseCost = Math.min(100, baseCost + 30);
      else if (relatedOpt.severity === 'Medium') baseCost = Math.min(100, baseCost + 15);
    }
    return baseCost;
  }, []);

  const extractRowCount = useCallback((node: DagNode): number => {
    if (!node.metric) return 0;
    const match = node.metric.match(/([\d.]+)\s*([KMBkmb])?/);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const multiplier = match[2]?.toUpperCase();
    const multipliers: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };
    return value * (multipliers[multiplier || ''] || 1);
  }, []);

  // Enhanced topological sorting with Barycentric Heuristic
  const enhancedLayout = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, EnhancedNode>();
    const parentsMap = new Map<string, string[]>(); 
    
    // Normalize IDs to handle potential whitespace issues
    const normalizeId = (id: string) => id.trim();

    // Initialize
    nodes.forEach(n => {
      const id = normalizeId(n.id);
      adjacency.set(id, []);
      inDegree.set(id, 0);
      parentsMap.set(id, []);
      
      const relatedOpt = isBottleneckNode(n);
      const enhanced: EnhancedNode = {
        ...n,
        id: id,
        isBottleneck: relatedOpt !== null,
        bottleneckSeverity: getBottleneckSeverity(relatedOpt),
        estimatedCost: estimateNodeCost(n, relatedOpt),
        rowsProcessed: extractRowCount(n),
        relatedOptimization: relatedOpt || undefined,
      };
      nodeMap.set(id, enhanced);
    });

    // Build adjacency and parents map
    links.forEach(l => {
      const sourceId = normalizeId(typeof l.source === 'object' ? (l.source as any).id : l.source);
      const targetId = normalizeId(typeof l.target === 'object' ? (l.target as any).id : l.target);
      
      // Only process if both nodes exist in our map
      if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        adjacency.get(sourceId)?.push(targetId);
        inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
        
        if (!parentsMap.has(targetId)) parentsMap.set(targetId, []);
        parentsMap.get(targetId)!.push(sourceId);
      }
    });

    // BFS for levels
    const levels = new Map<string, number>();
    const queue: string[] = [];
    
    nodes.forEach(n => {
      const id = normalizeId(n.id);
      if ((inDegree.get(id) || 0) === 0) {
        levels.set(id, 0);
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      const currentLevel = levels.get(u)!;
      
      adjacency.get(u)?.forEach(v => {
        const newLevel = currentLevel + 1;
        if (!levels.has(v) || levels.get(v)! < newLevel) {
          levels.set(v, newLevel);
          queue.push(v);
        }
      });
    }

    // Assign level 0 to any disconnected/orphan nodes so they appear at start
    nodes.forEach(n => {
      const id = normalizeId(n.id);
      if (!levels.has(id)) levels.set(id, 0);
    });

    const maxLevel = Math.max(...Array.from(levels.values()), 0);

    // Group nodes by level
    const nodesByLevel = new Map<number, EnhancedNode[]>();
    nodes.forEach(n => {
        const id = normalizeId(n.id);
        const level = levels.get(id)!;
        const node = nodeMap.get(id)!;
        node.level = level;
        
        if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
        nodesByLevel.get(level)!.push(node);
    });

    // BARYCENTRIC SORT: Reorder nodes within levels to minimize crossing
    nodesByLevel.get(0)?.sort((a, b) => a.id.localeCompare(b.id));

    for (let l = 1; l <= maxLevel; l++) {
        const stageNodes = nodesByLevel.get(l) || [];
        
        // Sort based on average parent index
        stageNodes.sort((a, b) => {
            const getAvgParentY = (nodeId: string) => {
                const parents = parentsMap.get(nodeId) || [];
                if (parents.length === 0) return 0;
                
                const parentIndices = parents.map(pId => {
                    const pNode = nodeMap.get(pId);
                    return pNode?.indexInLevel || 0;
                });
                return parentIndices.reduce((sum, val) => sum + val, 0) / parents.length;
            };
            
            const avgA = getAvgParentY(a.id);
            const avgB = getAvgParentY(b.id);
            
            if (Math.abs(avgA - avgB) < 0.01) return a.id.localeCompare(b.id);
            return avgA - avgB;
        });

        stageNodes.forEach((node, idx) => {
            node.indexInLevel = idx;
        });
    }

    // Determine Layout Dimensions
    const nodesPerLevelCount = new Map<number, number>();
    Array.from(nodesByLevel.entries()).forEach(([lvl, nds]) => {
        nodesPerLevelCount.set(lvl, nds.length);
    });
    
    const maxNodesInStage = Math.max(...Array.from(nodesPerLevelCount.values()));
    const dynamicHeight = Math.max(700, maxNodesInStage * NODE_VERTICAL_SPACING + 200);

    // Create stage groups
    const stages: StageGroup[] = [];
    for (let i = 0; i <= maxLevel; i++) {
      stages.push({
        id: i,
        x: i * (STAGE_WIDTH + STAGE_GAP),
        nodeCount: nodesPerLevelCount.get(i) || 0,
        label: `Stage ${i}`,
      });
    }

    const bottleneckCount = Array.from(nodeMap.values()).filter(n => n.isBottleneck).length;
    const highCostCount = Array.from(nodeMap.values()).filter(n => (n.estimatedCost || 0) > 50).length;

    return { levels, nodeMap, maxLevel, stages, bottleneckCount, highCostCount, dynamicHeight };
  }, [nodes, links, optimizations, isBottleneckNode, getBottleneckSeverity, estimateNodeCost, extractRowCount]);

  const getNodeFill = useCallback((node: EnhancedNode, isHighlighted: boolean, isFaded: boolean): string => {
    if (isFaded) return theme === 'dark' ? '#1e293b' : '#f1f5f9';
    if (isHighlighted && node.isBottleneck) {
      switch (node.bottleneckSeverity) {
        case 'critical': return colors.criticalFill;
        case 'high': return colors.highFill;
        case 'medium': return colors.mediumFill;
      }
    }
    const type = node.type.toLowerCase();
    if (type.includes('scan') || type.includes('filescan')) return colors.scanFill;
    if (type.includes('exchange') || type.includes('shuffle')) return colors.shuffleFill;
    if (type.includes('join')) return colors.joinFill;
    if (type.includes('filter') || type.includes('project')) return colors.filterFill;
    return colors.defaultFill;
  }, [colors, theme]);

  const getNodeStroke = useCallback((node: EnhancedNode, isHighlighted: boolean, isFaded: boolean): string => {
    if (isFaded) return theme === 'dark' ? '#334155' : '#cbd5e1';
    if (isHighlighted && node.isBottleneck) {
      switch (node.bottleneckSeverity) {
        case 'critical': return colors.criticalStroke;
        case 'high': return colors.highStroke;
        case 'medium': return colors.mediumStroke;
      }
    }
    const type = node.type.toLowerCase();
    if (type.includes('scan') || type.includes('filescan')) return colors.scanStroke;
    if (type.includes('exchange') || type.includes('shuffle')) return colors.shuffleStroke;
    if (type.includes('join')) return colors.joinStroke;
    if (type.includes('filter') || type.includes('project')) return colors.filterStroke;
    return colors.defaultStroke;
  }, [colors, theme]);

  const shouldHighlightNode = useCallback((node: EnhancedNode): boolean => {
    switch (highlightMode) {
      case 'issues': return node.isBottleneck || false;
      case 'cost': return (node.estimatedCost || 0) > 40;
      case 'all': default: return true;
    }
  }, [highlightMode]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = isFullscreen ? window.innerHeight - 100 : enhancedLayout.dynamicHeight;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("cursor", "grab");

    const defs = svg.append("defs");
    const createMarker = (id: string, color: string) => {
      defs.append("marker").attr("id", id).attr("viewBox", "0 -5 10 10").attr("refX", NODE_RADIUS + 8).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", color);
    };
    createMarker("arrow-default", colors.linkDefault);
    createMarker("arrow-highlight", colors.linkHighlight);
    createMarker("arrow-critical", colors.linkCritical);

    const shadow = defs.append("filter").attr("id", "dropShadow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    shadow.append("feDropShadow").attr("dx", 0).attr("dy", 4).attr("stdDeviation", 8).attr("flood-color", theme === 'dark' ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)");

    const glow = defs.append("filter").attr("id", "glow").attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%");
    glow.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "coloredBlur");
    const glowMerge = glow.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "coloredBlur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");
    gRef.current = g;

    const zoom = d3.zoom().scaleExtent([0.1, 4]).on("zoom", (event: any) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
    });
    svg.call(zoom);
    zoomRef.current = zoom;

    const totalWidth = (enhancedLayout.maxLevel + 1) * (STAGE_WIDTH + STAGE_GAP);
    const initialScale = Math.min(0.8, (width - 100) / totalWidth);
    svg.call(zoom.transform, d3.zoomIdentity.translate(60, 100).scale(initialScale));

    const stageGroup = g.append("g").attr("class", "stages");
    enhancedLayout.stages.forEach(stage => {
      const stageHeight = Math.max(height - 100, stage.nodeCount * NODE_VERTICAL_SPACING + 120);
      stageGroup.append("rect")
        .attr("x", stage.x - 40)
        .attr("y", -60)
        .attr("width", STAGE_WIDTH + 80)
        .attr("height", stageHeight)
        .attr("rx", 24)
        .attr("fill", colors.stageBg)
        .attr("stroke", colors.stageBorder)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "8,6");
      stageGroup.append("text")
        .attr("x", stage.x + STAGE_WIDTH / 2)
        .attr("y", -30)
        .attr("text-anchor", "middle")
        .attr("font-family", "'JetBrains Mono', monospace")
        .attr("font-size", "14px")
        .attr("font-weight", "700")
        .attr("fill", colors.stageText)
        .text(stage.label.toUpperCase());
    });

    const simNodes: EnhancedNode[] = Array.from(enhancedLayout.nodeMap.values()).map((n: EnhancedNode) => ({
      ...n,
      x: n.level! * (STAGE_WIDTH + STAGE_GAP) + STAGE_WIDTH / 2,
      y: n.indexInLevel! * NODE_VERTICAL_SPACING + 100,
    }));

    const simLinks = links.map(l => ({
      source: typeof l.source === 'object' ? (l.source as any).id : l.source,
      target: typeof l.target === 'object' ? (l.target as any).id : l.target,
    }));

    // Strong forces for Grid Layout
    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(200).strength(0.1))
      .force("charge", d3.forceManyBody().strength(-1200))
      .force("collide", d3.forceCollide().radius(NODE_RADIUS + 50).strength(1))
      .force("x", d3.forceX((d: any) => d.level * (STAGE_WIDTH + STAGE_GAP) + STAGE_WIDTH / 2).strength(1.5))
      .force("y", d3.forceY((d: any) => d.indexInLevel * NODE_VERTICAL_SPACING + 100).strength(1.5));

    const linkGroup = g.append("g").attr("class", "links");
    const link = linkGroup.selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("fill", "none")
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round");

    const nodeGroup = g.append("g").attr("class", "nodes");
    const node = nodeGroup.selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", (e: any, d: any) => { e.stopPropagation(); setSelectedNode(d); })
      .on("mouseenter", function(e: any, d: any) { setHoveredNode(d.id); d3.select(this).select(".node-main").attr("filter", "url(#glow)"); })
      .on("mouseleave", function() { setHoveredNode(null); d3.select(this).select(".node-main").attr("filter", "url(#dropShadow)"); })
      .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

    node.each(function(d: any) {
      const g = d3.select(this);
      const isHighlighted = shouldHighlightNode(d);
      const isFaded = highlightMode !== 'all' && !isHighlighted;

      if (d.isBottleneck && isHighlighted) {
        g.append("circle").attr("r", NODE_RADIUS + 8).attr("fill", "none").attr("stroke", getNodeStroke(d, true, false)).attr("stroke-width", 3).attr("stroke-dasharray", "6,3").attr("opacity", 0.7).attr("class", "node-ring");
      }

      g.append("circle").attr("class", "node-main").attr("r", NODE_RADIUS).attr("fill", getNodeFill(d, isHighlighted, isFaded)).attr("stroke", getNodeStroke(d, isHighlighted, isFaded)).attr("stroke-width", isHighlighted && d.isBottleneck ? 4 : 3).attr("filter", "url(#dropShadow)").attr("opacity", isFaded ? 0.4 : 1);
      g.append("circle").attr("class", "node-dot").attr("r", 8).attr("fill", isFaded ? (theme === 'dark' ? '#475569' : '#94a3b8') : getNodeStroke(d, isHighlighted, isFaded)).attr("opacity", isFaded ? 0.4 : 1);

      if (d.isBottleneck && d.bottleneckSeverity === 'critical' && isHighlighted) {
        g.append("circle").attr("cx", NODE_RADIUS - 4).attr("cy", -NODE_RADIUS + 4).attr("r", 12).attr("fill", colors.criticalStroke).attr("stroke", colors.nodeStroke).attr("stroke-width", 2);
        g.append("text").attr("x", NODE_RADIUS - 4).attr("y", -NODE_RADIUS + 8).attr("text-anchor", "middle").attr("font-size", "12px").attr("fill", "#ffffff").text("!");
      }

      const label = d.name.length > 22 ? d.name.substring(0, 20) + "..." : d.name;
      g.append("text").attr("y", -NODE_RADIUS - 14).attr("text-anchor", "middle").text(label).attr("font-size", "11px").attr("font-weight", "700").attr("stroke", colors.nodeTextShadow).attr("stroke-width", 4).attr("fill", "none").style("pointer-events", "none");
      g.append("text").attr("y", -NODE_RADIUS - 14).attr("text-anchor", "middle").text(label).attr("font-size", "11px").attr("font-weight", "700").attr("fill", isFaded ? colors.stageText : colors.nodeText).style("pointer-events", "none");

      if (showMetrics) {
        let metricText = d.rowsProcessed ? (d.rowsProcessed >= 1000000 ? `${(d.rowsProcessed/1e6).toFixed(1)}M rows` : `${(d.rowsProcessed/1e3).toFixed(0)}K rows`) : d.metric;
        if (metricText) {
            g.append("text").attr("y", NODE_RADIUS + 24).attr("text-anchor", "middle").text(metricText).attr("font-size", "10px").attr("font-weight", "600").attr("fill", d.isBottleneck && isHighlighted ? colors.criticalStroke : colors.metricText).attr("opacity", isFaded ? 0.3 : 0.9);
        }
      }
    });

    // IMPORTANT: Robust Path Generator using direct node object coordinates from D3
    function linkPath(d: any) {
      // D3 mutates the link object to replace ID strings with Node objects. 
      // We must check if they are defined before accessing .x and .y
      if (!d.source || !d.target) return "";
      
      const sx = d.source.x;
      const sy = d.source.y;
      const tx = d.target.x;
      const ty = d.target.y;
      
      // If coordinates are missing (simulation starting), return empty path
      if (sx === undefined || sy === undefined || tx === undefined || ty === undefined) return "";

      const dx = tx - sx;
      const dy = ty - sy;
      
      // Bezier curve control points for smooth horizontal flow
      const cx1 = sx + dx * 0.4;
      const cx2 = sx + dx * 0.6;
      
      return `M${sx},${sy} C${cx1},${sy} ${cx2},${ty} ${tx},${ty}`;
    }

    simulation.on("tick", () => {
      // Update link paths using robust function
      link.attr("d", linkPath);
      
      // Update link styles based on dynamic highlighting
      link.each(function(d: any) {
        const targetNode = d.target; // Direct access since D3 populated it
        const isHighlighted = targetNode ? shouldHighlightNode(targetNode) : true;
        const isCritical = targetNode?.bottleneckSeverity === 'critical';
        d3.select(this)
          .attr("stroke", isHighlighted ? (isCritical ? colors.linkCritical : colors.linkHighlight) : colors.linkDefault)
          .attr("stroke-opacity", isHighlighted ? 0.8 : 0.2)
          .attr("marker-end", `url(#arrow-${isHighlighted ? (isCritical ? 'critical' : 'highlight') : 'default'})`);
        if (isCritical && isHighlighted) d3.select(this).attr("stroke-dasharray", "8,4");
      });

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) { if (!event.active) simulation.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; svg.style("cursor", "grabbing"); }
    function dragged(event: any) { event.subject.fx = event.x; event.subject.fy = event.y; }
    function dragended(event: any) { if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; svg.style("cursor", "grab"); }

    return () => { simulation.stop(); };
  }, [nodes, links, enhancedLayout, highlightMode, showMetrics, colors, theme, shouldHighlightNode, isFullscreen]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  const exportDAG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dag.svg'; a.click(); URL.revokeObjectURL(url);
  };

  const containerClasses = isFullscreen 
    ? "fixed inset-4 z-[100] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 ring-4 ring-indigo-500/20"
    : "w-full bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col relative group transition-all duration-300 hover:border-indigo-300 dark:hover:border-indigo-700";

  return (
    <>
      {isFullscreen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90] animate-in fade-in duration-300" onClick={() => setIsFullscreen(false)} />}
      
      <div 
        ref={containerRef} 
        className={containerClasses}
        style={{ height: isFullscreen ? 'auto' : enhancedLayout.dynamicHeight }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex justify-between items-center flex-shrink-0">
          <div 
            className="flex items-center gap-3 cursor-pointer group/title"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={!isFullscreen ? "Click to expand" : ""}
          >
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20 group-hover/title:scale-105 transition-transform">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight flex items-center gap-2 group-hover/title:text-indigo-600 dark:group-hover/title:text-indigo-400 transition-colors">
                Execution Plan Visualizer
                {!isFullscreen && <Maximize2 className="w-4 h-4 text-slate-400 opacity-0 group-hover/title:opacity-100 transition-opacity" />}
              </h3>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {nodes.length} nodes • {enhancedLayout.stages.length} stages
                </span>
                {enhancedLayout.bottleneckCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    {enhancedLayout.bottleneckCount} issues
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-0.5">
              <button onClick={() => setHighlightMode('all')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${highlightMode === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}><Target className="w-3.5 h-3.5" /> All</button>
              <button onClick={() => setHighlightMode('issues')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${highlightMode === 'issues' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}><AlertTriangle className="w-3.5 h-3.5" /> Issues</button>
              <button onClick={() => setHighlightMode('cost')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${highlightMode === 'cost' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}><DollarSign className="w-3.5 h-3.5" /> Cost</button>
            </div>
            
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              className={`p-2 rounded-lg transition-all ${isFullscreen ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/50'}`}
              title={isFullscreen ? "Exit Focus Mode" : "Focus Mode"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: colors.canvasBg }}>
          <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none" style={{ backgroundImage: `radial-gradient(${theme === 'dark' ? '#475569' : '#94a3b8'} 1px, transparent 1px)`, backgroundSize: '24px 24px' }} />
          <svg ref={svgRef} className="w-full h-full" />
          
          <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-lg pointer-events-none">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Legend</div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.scanStroke }} /><span className="text-xs text-slate-600 dark:text-slate-400">Scan</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.shuffleStroke }} /><span className="text-xs text-slate-600 dark:text-slate-400">Shuffle</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: colors.criticalStroke }} /><span className="text-xs text-slate-600 dark:text-slate-400">Bottleneck</span></div>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 shadow-lg pointer-events-none">
            <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">{Math.round(zoomLevel * 100)}%</span>
          </div>

          {selectedNode && (
            <div className="absolute top-4 right-4 w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-200 z-30">
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-500" /><span className="font-semibold text-slate-900 dark:text-white text-sm">Node Details</span></div>
                <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div><div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Name</div><div className="font-mono text-sm text-slate-900 dark:text-white break-words">{selectedNode.name}</div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Type</div><div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{selectedNode.type}</div></div>
                  <div><div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Stage</div><div className="text-sm text-slate-700 dark:text-slate-300 font-medium">Stage {selectedNode.level}</div></div>
                </div>
                {selectedNode.isBottleneck && selectedNode.relatedOptimization && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div><div className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">{selectedNode.bottleneckSeverity} Priority</div><div className="text-xs text-red-600 dark:text-red-300">{selectedNode.relatedOptimization.title}</div></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 0.4; } 100% { transform: scale(1); opacity: 0.8; } }
        .node-ring { animation: pulse-ring 2s ease-in-out infinite; }
      `}</style>
    </>
  );
};
