
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3Base from 'd3';
import { DagNode, DagLink, OptimizationTip } from '../../shared/types';
import { 
  ZoomIn, ZoomOut, Download, AlertCircle, Zap, Eye, EyeOff, 
  Layers, Maximize2, RotateCcw, Filter, DollarSign, AlertTriangle,
  ChevronRight, X, Info, Target, Activity
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
  
  const { theme } = useTheme();

  // Layout constants
  const STAGE_WIDTH = 260;
  const STAGE_GAP = 80;
  const NODE_VERTICAL_SPACING = 140;
  const NODE_RADIUS = 32;

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

  // Helper: Check if node is a bottleneck
  const isBottleneckNode = useCallback((node: DagNode): OptimizationTip | null => {
    const nodeTypeLower = node.type.toLowerCase();
    const nodeNameLower = node.name.toLowerCase();
    
    for (const opt of optimizations) {
      const titleLower = opt.title.toLowerCase();
      const descLower = opt.description.toLowerCase();
      
      // Check for type matches
      if (nodeTypeLower.includes('nestedloop') && (titleLower.includes('cartesian') || titleLower.includes('join'))) {
        return opt;
      }
      if (nodeTypeLower.includes('exchange') && (titleLower.includes('shuffle') || titleLower.includes('partition'))) {
        return opt;
      }
      if (nodeTypeLower.includes('broadcast') && titleLower.includes('broadcast')) {
        return opt;
      }
      
      // Check affected stages
      if (opt.affected_stages?.some(stage => 
        node.id.toLowerCase().includes(stage.toLowerCase()) || 
        nodeNameLower.includes(stage.toLowerCase())
      )) {
        return opt;
      }
      
      // Check if description mentions this node type
      if (descLower.includes(nodeTypeLower) || titleLower.includes(nodeTypeLower)) {
        return opt;
      }
    }
    return null;
  }, [optimizations]);

  // Helper: Get bottleneck severity
  const getBottleneckSeverity = useCallback((opt: OptimizationTip | null): 'critical' | 'high' | 'medium' | 'low' => {
    if (!opt) return 'low';
    if (opt.severity === 'High') return 'critical';
    if (opt.severity === 'Medium') return 'high';
    return 'medium';
  }, []);

  // Helper: Estimate node cost (0-100)
  const estimateNodeCost = useCallback((node: DagNode, relatedOpt: OptimizationTip | null): number => {
    const type = node.type.toLowerCase();
    let baseCost = 10;
    
    if (type.includes('cartesian') || type.includes('nestedloop')) baseCost = 95;
    else if (type.includes('exchange') || type.includes('shuffle')) baseCost = 60;
    else if (type.includes('broadcast')) baseCost = 40;
    else if (type.includes('aggregate') || type.includes('sort')) baseCost = 35;
    else if (type.includes('join')) baseCost = 50;
    else if (type.includes('scan')) baseCost = 20;
    else if (type.includes('filter') || type.includes('project')) baseCost = 15;
    
    // Boost cost if there's a related high-severity optimization
    if (relatedOpt) {
      if (relatedOpt.severity === 'High') baseCost = Math.min(100, baseCost + 30);
      else if (relatedOpt.severity === 'Medium') baseCost = Math.min(100, baseCost + 15);
    }
    
    return baseCost;
  }, []);

  // Helper: Extract row count from metric
  const extractRowCount = useCallback((node: DagNode): number => {
    if (!node.metric) return 0;
    const match = node.metric.match(/([\d.]+)\s*([KMBkmb])?/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const multiplier = match[2]?.toUpperCase();
    const multipliers: Record<string, number> = { K: 1000, M: 1000000, B: 1000000000 };
    
    return value * (multipliers[multiplier || ''] || 1);
  }, []);

  // Build enhanced layout with topological sorting
  const enhancedLayout = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const nodeMap = new Map<string, EnhancedNode>();
    
    // Initialize
    nodes.forEach(n => {
      adjacency.set(n.id, []);
      inDegree.set(n.id, 0);
      
      const relatedOpt = isBottleneckNode(n);
      const enhanced: EnhancedNode = {
        ...n,
        isBottleneck: relatedOpt !== null,
        bottleneckSeverity: getBottleneckSeverity(relatedOpt),
        estimatedCost: estimateNodeCost(n, relatedOpt),
        rowsProcessed: extractRowCount(n),
        relatedOptimization: relatedOpt || undefined,
      };
      nodeMap.set(n.id, enhanced);
    });

    // Build adjacency
    links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const targetId = typeof l.target === 'object' ? (l.target as any).id : l.target;
      adjacency.get(sourceId)?.push(targetId);
      inDegree.set(targetId, (inDegree.get(targetId) || 0) + 1);
    });

    // BFS for levels
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
        const newLevel = currentLevel + 1;
        if (!levels.has(v) || levels.get(v)! < newLevel) {
          levels.set(v, newLevel);
          queue.push(v);
        }
      });
    }

    // Handle orphans
    nodes.forEach(n => {
      if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    // Assign positions
    const nodesPerLevel = new Map<number, number>();
    nodes.forEach(n => {
      const level = levels.get(n.id)!;
      const node = nodeMap.get(n.id)!;
      node.level = level;
      node.indexInLevel = nodesPerLevel.get(level) || 0;
      nodesPerLevel.set(level, (nodesPerLevel.get(level) || 0) + 1);
    });

    const maxLevel = Math.max(...Array.from(levels.values()), 0);
    
    // Create stage groups
    const stages: StageGroup[] = [];
    for (let i = 0; i <= maxLevel; i++) {
      stages.push({
        id: i,
        x: i * (STAGE_WIDTH + STAGE_GAP),
        nodeCount: nodesPerLevel.get(i) || 0,
        label: `Stage ${i}`,
      });
    }

    // Calculate bottleneck and cost statistics
    const bottleneckCount = Array.from(nodeMap.values()).filter(n => n.isBottleneck).length;
    const avgCost = Array.from(nodeMap.values()).reduce((sum, n) => sum + (n.estimatedCost || 0), 0) / nodes.length;
    const highCostCount = Array.from(nodeMap.values()).filter(n => (n.estimatedCost || 0) > 50).length;

    return { levels, nodeMap, maxLevel, stages, bottleneckCount, avgCost, highCostCount };
  }, [nodes, links, optimizations, isBottleneckNode, getBottleneckSeverity, estimateNodeCost, extractRowCount]);

  // Get node fill color based on type and state
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

  // Get node stroke color
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

  // Determine if node should be highlighted based on mode
  const shouldHighlightNode = useCallback((node: EnhancedNode): boolean => {
    switch (highlightMode) {
      case 'issues':
        return node.isBottleneck || false;
      case 'cost':
        return (node.estimatedCost || 0) > 40;
      case 'all':
      default:
        return true;
    }
  }, [highlightMode]);

  // Main D3 effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = 700;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("cursor", "grab");

    // Definitions
    const defs = svg.append("defs");

    // Gradients for cost visualization
    const costGradient = defs.append("linearGradient")
      .attr("id", "costGradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");
    costGradient.append("stop").attr("offset", "0%").attr("stop-color", colors.costLow);
    costGradient.append("stop").attr("offset", "50%").attr("stop-color", colors.costMed);
    costGradient.append("stop").attr("offset", "100%").attr("stop-color", colors.costHigh);

    // Arrow markers
    const createMarker = (id: string, color: string) => {
      defs.append("marker")
        .attr("id", id)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", NODE_RADIUS + 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    };

    createMarker("arrow-default", colors.linkDefault);
    createMarker("arrow-highlight", colors.linkHighlight);
    createMarker("arrow-critical", colors.linkCritical);

    // Drop shadow filter
    const shadow = defs.append("filter")
      .attr("id", "dropShadow")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");
    shadow.append("feDropShadow")
      .attr("dx", 0).attr("dy", 4)
      .attr("stdDeviation", 8)
      .attr("flood-color", theme === 'dark' ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)");

    // Glow filter for highlighted nodes
    const glow = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-100%").attr("y", "-100%")
      .attr("width", "300%").attr("height", "300%");
    glow.append("feGaussianBlur")
      .attr("stdDeviation", 4)
      .attr("result", "coloredBlur");
    const glowMerge = glow.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "coloredBlur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");
    gRef.current = g;

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Initial transform
    const totalWidth = (enhancedLayout.maxLevel + 1) * (STAGE_WIDTH + STAGE_GAP);
    const initialScale = Math.min(0.75, (width - 100) / totalWidth);
    svg.call(zoom.transform, d3.zoomIdentity.translate(60, 80).scale(initialScale));

    // Draw stage backgrounds
    const stageGroup = g.append("g").attr("class", "stages");
    
    enhancedLayout.stages.forEach(stage => {
      const stageHeight = Math.max(400, stage.nodeCount * NODE_VERTICAL_SPACING + 120);
      
      // Stage background
      stageGroup.append("rect")
        .attr("x", stage.x - 20)
        .attr("y", -40)
        .attr("width", STAGE_WIDTH + 40)
        .attr("height", stageHeight)
        .attr("rx", 16)
        .attr("fill", colors.stageBg)
        .attr("stroke", colors.stageBorder)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "6,4");

      // Stage label
      stageGroup.append("text")
        .attr("x", stage.x + STAGE_WIDTH / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .attr("font-family", "'JetBrains Mono', monospace")
        .attr("font-size", "12px")
        .attr("font-weight", "600")
        .attr("fill", colors.stageText)
        .attr("letter-spacing", "0.05em")
        .text(stage.label.toUpperCase());
    });

    // Prepare simulation data
    const simNodes: EnhancedNode[] = Array.from(enhancedLayout.nodeMap.values()).map((n: EnhancedNode) => ({
      ...n,
      x: n.level! * (STAGE_WIDTH + STAGE_GAP) + STAGE_WIDTH / 2,
      y: n.indexInLevel! * NODE_VERTICAL_SPACING + 80,
    }));

    const simLinks = links.map(l => ({
      source: typeof l.source === 'object' ? (l.source as any).id : l.source,
      target: typeof l.target === 'object' ? (l.target as any).id : l.target,
    }));

    // Force simulation
    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(120).strength(0.1))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("collide", d3.forceCollide().radius(NODE_RADIUS + 20).strength(0.8))
      .force("x", d3.forceX((d: any) => d.level * (STAGE_WIDTH + STAGE_GAP) + STAGE_WIDTH / 2).strength(0.9))
      .force("y", d3.forceY((d: any) => d.indexInLevel * NODE_VERTICAL_SPACING + 80).strength(0.5));

    // Draw links
    const linkGroup = g.append("g").attr("class", "links");
    
    const link = linkGroup.selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("fill", "none")
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round")
      .each(function(d: any) {
        const targetNode = simNodes.find(n => n.id === d.target);
        const isHighlighted = targetNode ? shouldHighlightNode(targetNode) : true;
        const isCritical = targetNode?.bottleneckSeverity === 'critical';
        
        d3.select(this)
          .attr("stroke", isHighlighted ? (isCritical ? colors.linkCritical : colors.linkHighlight) : colors.linkDefault)
          .attr("stroke-opacity", isHighlighted ? 0.8 : 0.3)
          .attr("marker-end", `url(#arrow-${isHighlighted ? (isCritical ? 'critical' : 'highlight') : 'default'})`);
          
        if (isCritical && isHighlighted) {
          d3.select(this).attr("stroke-dasharray", "8,4");
        }
      });

    // Draw nodes
    const nodeGroup = g.append("g").attr("class", "nodes");

    const node = nodeGroup.selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .on("click", function(event: any, d: any) {
        event.stopPropagation();
        setSelectedNode(d);
      })
      .on("mouseenter", function(event: any, d: any) {
        setHoveredNode(d.id);
        d3.select(this).select(".node-main").attr("filter", "url(#glow)");
      })
      .on("mouseleave", function() {
        setHoveredNode(null);
        d3.select(this).select(".node-main").attr("filter", "url(#dropShadow)");
      })
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node visuals
    node.each(function(d: any) {
      const g = d3.select(this);
      const isHighlighted = shouldHighlightNode(d);
      const isFaded = highlightMode !== 'all' && !isHighlighted;

      // Outer ring for bottlenecks
      if (d.isBottleneck && isHighlighted) {
        g.append("circle")
          .attr("class", "node-ring")
          .attr("r", NODE_RADIUS + 8)
          .attr("fill", "none")
          .attr("stroke", getNodeStroke(d, true, false))
          .attr("stroke-width", 3)
          .attr("stroke-dasharray", "6,3")
          .attr("opacity", 0.7);
      }

      // Cost ring (when in cost mode)
      if (highlightMode === 'cost' && (d.estimatedCost || 0) > 30) {
        const costRatio = (d.estimatedCost || 0) / 100;
        g.append("circle")
          .attr("class", "cost-ring")
          .attr("r", NODE_RADIUS + 6)
          .attr("fill", "none")
          .attr("stroke", d.estimatedCost > 70 ? colors.costHigh : d.estimatedCost > 40 ? colors.costMed : colors.costLow)
          .attr("stroke-width", 4)
          .attr("stroke-dasharray", `${costRatio * 220} ${(1 - costRatio) * 220}`)
          .attr("transform", "rotate(-90)")
          .attr("opacity", isHighlighted ? 0.9 : 0.3);
      }

      // Main circle
      g.append("circle")
        .attr("class", "node-main")
        .attr("r", NODE_RADIUS)
        .attr("fill", getNodeFill(d, isHighlighted, isFaded))
        .attr("stroke", getNodeStroke(d, isHighlighted, isFaded))
        .attr("stroke-width", isHighlighted && d.isBottleneck ? 4 : 3)
        .attr("filter", "url(#dropShadow)")
        .attr("opacity", isFaded ? 0.4 : 1);

      // Inner icon dot
      const dotColor = getNodeStroke(d, isHighlighted, isFaded);
      g.append("circle")
        .attr("class", "node-dot")
        .attr("r", 8)
        .attr("fill", isFaded ? (theme === 'dark' ? '#475569' : '#94a3b8') : dotColor)
        .attr("opacity", isFaded ? 0.4 : 1);

      // Warning badge for critical bottlenecks
      if (d.isBottleneck && d.bottleneckSeverity === 'critical' && isHighlighted) {
        g.append("circle")
          .attr("cx", NODE_RADIUS - 4)
          .attr("cy", -NODE_RADIUS + 4)
          .attr("r", 12)
          .attr("fill", colors.criticalStroke)
          .attr("stroke", colors.nodeStroke)
          .attr("stroke-width", 2);
        
        g.append("text")
          .attr("x", NODE_RADIUS - 4)
          .attr("y", -NODE_RADIUS + 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "12px")
          .attr("fill", "#ffffff")
          .text("!");
      }

      // Cost badge (when in cost mode)
      if (highlightMode === 'cost' && (d.estimatedCost || 0) > 50 && isHighlighted) {
        g.append("circle")
          .attr("cx", NODE_RADIUS - 4)
          .attr("cy", -NODE_RADIUS + 4)
          .attr("r", 14)
          .attr("fill", d.estimatedCost > 70 ? colors.costHigh : colors.costMed)
          .attr("stroke", colors.nodeStroke)
          .attr("stroke-width", 2);
        
        g.append("text")
          .attr("x", NODE_RADIUS - 4)
          .attr("y", -NODE_RADIUS + 8)
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "700")
          .attr("fill", "#ffffff")
          .text("$");
      }

      // Node label (name) - with halo effect
      const label = d.name.length > 22 ? d.name.substring(0, 20) + "..." : d.name;
      
      // Halo
      g.append("text")
        .attr("class", "node-label-halo")
        .attr("y", -NODE_RADIUS - 14)
        .attr("text-anchor", "middle")
        .attr("font-family", "'JetBrains Mono', 'SF Mono', monospace")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("stroke", colors.nodeTextShadow)
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round")
        .attr("fill", "none")
        .attr("opacity", isFaded ? 0.3 : 1)
        .text(label);

      // Text
      g.append("text")
        .attr("class", "node-label")
        .attr("y", -NODE_RADIUS - 14)
        .attr("text-anchor", "middle")
        .attr("font-family", "'JetBrains Mono', 'SF Mono', monospace")
        .attr("font-size", "11px")
        .attr("font-weight", "600")
        .attr("fill", isFaded ? colors.stageText : colors.nodeText)
        .text(label);

      // Metric label
      if (showMetrics) {
        let metricText = '';
        if (d.rowsProcessed && d.rowsProcessed > 0) {
          metricText = d.rowsProcessed >= 1000000 
            ? `${(d.rowsProcessed / 1000000).toFixed(1)}M rows`
            : d.rowsProcessed >= 1000 
            ? `${(d.rowsProcessed / 1000).toFixed(0)}K rows`
            : `${d.rowsProcessed} rows`;
        } else if (d.metric) {
          metricText = d.metric;
        }

        if (metricText) {
          g.append("text")
            .attr("class", "node-metric")
            .attr("y", NODE_RADIUS + 24)
            .attr("text-anchor", "middle")
            .attr("font-family", "'JetBrains Mono', monospace")
            .attr("font-size", "10px")
            .attr("font-weight", "500")
            .attr("fill", d.isBottleneck && isHighlighted ? colors.criticalStroke : colors.metricText)
            .attr("opacity", isFaded ? 0.3 : 0.8)
            .text(metricText);
        }
      }
    });

    // Link path generator
    function linkPath(d: any) {
      const source = simNodes.find(n => n.id === d.source || n.id === d.source.id);
      const target = simNodes.find(n => n.id === d.target || n.id === d.target.id);
      
      if (!source || !target) return '';
      
      const sx = source.x!;
      const sy = source.y!;
      const tx = target.x!;
      const ty = target.y!;
      
      const dx = tx - sx;
      const dy = ty - sy;
      
      // Bezier curve for smooth flow
      const cx1 = sx + dx * 0.4;
      const cx2 = sx + dx * 0.6;
      
      return `M${sx},${sy} C${cx1},${sy} ${cx2},${ty} ${tx},${ty}`;
    }

    // Simulation tick
    simulation.on("tick", () => {
      link.attr("d", linkPath);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
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

    // Click outside to deselect
    svg.on("click", () => setSelectedNode(null));

    return () => simulation.stop();
  }, [nodes, links, enhancedLayout, highlightMode, showMetrics, colors, theme, shouldHighlightNode, getNodeFill, getNodeStroke]);

  // Zoom controls
  const handleZoom = useCallback((factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  }, []);

  const handleResetView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const totalWidth = (enhancedLayout.maxLevel + 1) * (STAGE_WIDTH + STAGE_GAP);
    const initialScale = Math.min(0.75, (width - 100) / totalWidth);
    svg.transition().duration(500).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(60, 80).scale(initialScale)
    );
  }, [enhancedLayout.maxLevel]);

  // Export SVG
  const exportDAG = useCallback(() => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dag-visualization.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Format row count
  const formatRowCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return String(count);
  };

  return (
    <div 
      ref={containerRef} 
      className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[750px] relative transition-colors duration-200"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">
              Execution Plan Visualizer
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
          {/* Highlight Mode Buttons - FIXED */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-0.5">
            <button 
              onClick={() => setHighlightMode('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                highlightMode === 'all' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Show all nodes"
            >
              <Target className="w-3.5 h-3.5" />
              All
            </button>
            <button 
              onClick={() => setHighlightMode('issues')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                highlightMode === 'issues' 
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400'
              }`}
              title="Highlight bottlenecks and issues"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Issues
              {enhancedLayout.bottleneckCount > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  highlightMode === 'issues' 
                    ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' 
                    : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                }`}>
                  {enhancedLayout.bottleneckCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setHighlightMode('cost')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                highlightMode === 'cost' 
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
              title="Highlight high-cost operations"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Cost
              {enhancedLayout.highCostCount > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  highlightMode === 'cost' 
                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' 
                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                }`}>
                  {enhancedLayout.highCostCount}
                </span>
              )}
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Toggle Metrics */}
          <button 
            onClick={() => setShowMetrics(!showMetrics)}
            className={`p-2 rounded-lg transition-colors ${
              showMetrics 
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' 
                : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={showMetrics ? "Hide metrics" : "Show metrics"}
          >
            {showMetrics ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Reset View */}
          <button 
            onClick={handleResetView}
            className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Export */}
          <button 
            onClick={exportDAG}
            className="p-2 rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Export SVG"
          >
            <Download className="w-4 h-4" />
          </button>
          
          {/* Zoom controls */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
            <button 
              onClick={() => handleZoom(1.25)} 
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px bg-slate-200 dark:bg-slate-700" />
            <button 
              onClick={() => handleZoom(0.8)} 
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: colors.canvasBg }}>
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none" 
          style={{ 
            backgroundImage: `radial-gradient(${theme === 'dark' ? '#475569' : '#94a3b8'} 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }} 
        />
        
        <svg ref={svgRef} className="w-full h-full" />
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700 p-3 shadow-lg">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Legend</div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.scanStroke }} />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Scan</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.shuffleStroke }} />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Shuffle</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.joinStroke }} />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Join</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.filterStroke }} />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Transform</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-dashed" style={{ borderColor: colors.criticalStroke }} />
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Bottleneck</span>
            </div>
          </div>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 shadow-lg">
          <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {/* Selected Node Panel */}
        {selectedNode && (
          <div className="absolute top-4 right-4 w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-200">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-slate-900 dark:text-white text-sm">Node Details</span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Name</div>
                <div className="font-mono text-sm text-slate-900 dark:text-white break-words">{selectedNode.name}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Type</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">{selectedNode.type}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Stage</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">Stage {selectedNode.level}</div>
                </div>
              </div>

              {selectedNode.rowsProcessed && selectedNode.rowsProcessed > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rows Processed</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 font-mono font-medium">
                    {formatRowCount(selectedNode.rowsProcessed)}
                  </div>
                </div>
              )}

              {selectedNode.estimatedCost !== undefined && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Cost Score</div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${selectedNode.estimatedCost}%`,
                          backgroundColor: selectedNode.estimatedCost > 70 ? colors.costHigh : selectedNode.estimatedCost > 40 ? colors.costMed : colors.costLow
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-600 dark:text-slate-400">
                      {selectedNode.estimatedCost}/100
                    </span>
                  </div>
                </div>
              )}

              {selectedNode.isBottleneck && selectedNode.relatedOptimization && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">
                        {selectedNode.bottleneckSeverity === 'critical' ? 'Critical Issue' : 'Performance Issue'}
                      </div>
                      <div className="text-xs text-red-600 dark:text-red-300">
                        {selectedNode.relatedOptimization.title}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 0.4; }
          100% { transform: scale(1); opacity: 0.8; }
        }
        .node-ring {
          animation: pulse-ring 2s ease-in-out infinite;
        }
        @keyframes slide-in-from-right-4 {
          from { transform: translateX(1rem); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-in {
          animation: slide-in-from-right-4 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};
