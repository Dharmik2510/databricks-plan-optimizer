import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3Base from 'd3';
import { DagNode, DagLink } from '../types';
import { ZoomIn, ZoomOut } from 'lucide-react';

const d3: any = d3Base;

interface DagVisualizerProps {
  nodes: DagNode[];
  links: DagLink[];
}

// Extend D3 Simulation Node
interface SimulationNode extends DagNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  vx?: number;
  vy?: number;
  index?: number;
}

export const DagVisualizer: React.FC<DagVisualizerProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Memoize the level computation to avoid recalculating on every render
  const levels = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    nodes.forEach(n => {
      adjacency.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    links.forEach(l => {
      adjacency.get(l.source)?.push(l.target);
      inDegree.set(l.target, (inDegree.get(l.target) || 0) + 1);
    });

    const lvlMap = new Map<string, number>();
    const queue: string[] = [];

    // Find sources
    nodes.forEach(n => {
      if ((inDegree.get(n.id) || 0) === 0) {
        lvlMap.set(n.id, 0);
        queue.push(n.id);
      }
    });

    // BFS for topological layering
    while (queue.length > 0) {
      const u = queue.shift()!;
      const currentLevel = lvlMap.get(u)!;
      
      const neighbors = adjacency.get(u) || [];
      for (const v of neighbors) {
        const existingLevel = lvlMap.get(v) || -1;
        if (currentLevel + 1 > existingLevel) {
           lvlMap.set(v, currentLevel + 1);
           queue.push(v);
        }
      }
    }
    
    nodes.forEach(n => {
        if (!lvlMap.has(n.id)) lvlMap.set(n.id, 0);
    });

    return lvlMap;
  }, [nodes, links]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = 600;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("cursor", "grab");

    // Define Arrowhead Marker - Dark Slate for Contrast
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 32)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#475569"); 

    const g = svg.append("g");

    // Initialize Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event: any) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(50, height / 2).scale(0.8));

    // Prepare Simulation Data
    const simNodes: SimulationNode[] = nodes.map(n => ({
      ...n,
      x: (levels.get(n.id) || 0) * 200, 
      y: height / 2 + (Math.random() - 0.5) * 100 
    }));

    const simLinks = links.map(l => ({ ...l }));

    // Configure Simulation
    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-1500)) 
      .force("collide", d3.forceCollide().radius(80)) 
      .force("x", d3.forceX((d: any) => (levels.get(d.id) || 0) * 220).strength(1.5)) 
      .force("y", d3.forceY(height / 2).strength(0.15)); 

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#94a3b8") 
      .attr("stroke-opacity", 0.8)
      .selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrowhead)");

    // Draw Nodes Group
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Background Circle
    node.append("circle")
      .attr("r", 28)
      .attr("fill", (d: any) => {
         const t = d.type.toLowerCase();
         if (t.includes('shuffle') || t.includes('exchange')) return '#fee2e2'; 
         if (t.includes('scan') || t.includes('read')) return '#dcfce7'; 
         if (t.includes('join')) return '#fef3c7'; 
         if (t.includes('filter') || t.includes('project')) return '#cffafe'; 
         return '#ffffff'; 
      })
      .attr("stroke-width", 3)
      .attr("stroke", (d: any) => {
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#ef4444'; 
        if (t.includes('scan') || t.includes('read')) return '#16a34a'; 
        if (t.includes('join')) return '#d97706'; 
        if (t.includes('filter') || t.includes('project')) return '#0891b2'; 
        return '#64748b';
      })
      .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.1))");

    // Inner Node Dot
    node.append("circle")
      .attr("r", 6)
      .attr("fill", (d: any) => {
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#ef4444';
        if (t.includes('scan') || t.includes('read')) return '#16a34a';
        if (t.includes('join')) return '#d97706';
        if (t.includes('filter') || t.includes('project')) return '#0891b2';
        return '#64748b';
      });

    // --- TEXT RENDERING FIX START ---
    // 1. Halo Text (Stroke background)
    node.append("text")
      .attr("x", 0)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text((d: any) => d.name)
      .attr("font-weight", "700")
      .attr("font-size", "12px")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("fill", "none")
      .style("pointer-events", "none")
      .call(getWrapText);

    // 2. Main Text (Fill foreground)
    node.append("text")
      .attr("x", 0)
      .attr("y", -40)
      .attr("text-anchor", "middle")
      .text((d: any) => d.name)
      .attr("font-weight", "700")
      .attr("font-size", "12px")
      .attr("fill", "#0f172a") // Deep Slate
      .style("pointer-events", "none")
      .call(getWrapText);
    // --- TEXT RENDERING FIX END ---

    // Metric Label - Halo
    node.append("text")
      .attr("x", 0)
      .attr("y", 45)
      .attr("text-anchor", "middle")
      .text((d: any) => d.metric || "")
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
      .attr("y", 45)
      .attr("text-anchor", "middle")
      .text((d: any) => d.metric || "")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "#475569")
      .style("pointer-events", "none");

    // Curved Links
    function linkArc(d: any) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      if (Math.abs(dy) < 20) {
         return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      }
      return `M${d.source.x},${d.source.y}C${d.source.x + dx/2},${d.source.y} ${d.source.x + dx/2},${d.target.y} ${d.target.x},${d.target.y}`;
    }

    // Text Wrapping Helper
    function getWrapText(selection: any) {
       selection.each(function(this: any, d: any) {
          if (d.name.length > 18) {
             d3.select(this).text(d.name.substring(0, 16) + "...");
          }
       });
    }

    // Tick Function
    simulation.on("tick", () => {
      link.attr("d", linkArc);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag Handlers
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

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, links, levels]);

  const handleZoom = (factor: number) => {
     if (!svgRef.current) return;
     const svg = d3.select(svgRef.current);
     const zoom: any = d3.zoom().on("zoom", (event: any) => {
        d3.select(svgRef.current).select("g").attr("transform", event.transform);
        setZoomLevel(event.transform.k);
     });
     svg.transition().duration(500).call(zoom.scaleBy, factor);
  };

  return (
    <div ref={containerRef} className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px] relative group">
      
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center flex-shrink-0">
        <h3 className="font-bold text-slate-900 text-lg drop-shadow-sm">Execution Plan Flow</h3>
        <div className="flex items-center gap-3">
           <div className="flex gap-3 mr-4 border-r border-slate-300 pr-4 hidden sm:flex">
               <div className="flex items-center gap-1.5 text-[10px] text-slate-700 font-bold">
                 <span className="w-2 h-2 rounded-full bg-green-500 shadow-sm"></span> Scan
               </div>
               <div className="flex items-center gap-1.5 text-[10px] text-slate-700 font-bold">
                 <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm"></span> Shuffle
               </div>
               <div className="flex items-center gap-1.5 text-[10px] text-slate-700 font-bold">
                 <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-sm"></span> Transform
               </div>
           </div>
           <div className="flex bg-white rounded-lg border border-slate-200 shadow-sm">
              <button onClick={() => handleZoom(1.2)} className="p-2 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => handleZoom(0.8)} className="p-2 hover:bg-slate-50 text-slate-600 hover:text-slate-900 border-l border-slate-200 transition-colors"><ZoomOut className="w-4 h-4" /></button>
           </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden bg-white">
         {/* Grid Background */}
         <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#64748b 1.5px, transparent 1.5px)', backgroundSize: '20px 20px' }}></div>
         <svg ref={svgRef} className="w-full h-full block relative z-10"></svg>
      </div>
    </div>
  );
};