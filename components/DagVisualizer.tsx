import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { DagNode, DagLink } from '../types';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface DagVisualizerProps {
  nodes: DagNode[];
  links: DagLink[];
}

export const DagVisualizer: React.FC<DagVisualizerProps> = ({ nodes, links }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Helper to organize nodes into levels for Left-to-Right flow
  const computeLevels = (nodes: DagNode[], links: DagLink[]) => {
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

    const levels = new Map<string, number>();
    const queue: string[] = [];

    // Find sources (nodes with in-degree 0)
    nodes.forEach(n => {
      if ((inDegree.get(n.id) || 0) === 0) {
        levels.set(n.id, 0);
        queue.push(n.id);
      }
    });

    // BFS to assign levels
    while (queue.length > 0) {
      const u = queue.shift()!;
      const currentLevel = levels.get(u)!;
      
      const neighbors = adjacency.get(u) || [];
      for (const v of neighbors) {
        // Simple longest path layering for DAGs
        const existingLevel = levels.get(v) || -1;
        if (currentLevel + 1 > existingLevel) {
           levels.set(v, currentLevel + 1);
           queue.push(v);
        }
      }
    }

    // Handle disconnected cycles or fallback
    nodes.forEach(n => {
        if (!levels.has(n.id)) levels.set(n.id, 0);
    });

    return levels;
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = 550;

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("cursor", "grab");

    // Define arrow markers
    const defs = svg.append("defs");
    
    // Normal arrow
    defs.append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 32) // Offset
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#64748b");

    // Zoom container
    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(50, height / 2).scale(0.8));

    // Data preparation
    const levels = computeLevels(nodes, links);
    
    const simNodes = nodes.map(n => ({
      ...n,
      x: (levels.get(n.id) || 0) * 180, 
      y: height / 2 + (Math.random() - 0.5) * 100 
    }));

    const simLinks = links.map(l => ({ ...l }));

    // Simulation
    const simulation = d3.forceSimulation(simNodes as any)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-1000)) 
      .force("collide", d3.forceCollide().radius(70)) 
      .force("x", d3.forceX((d: any) => (levels.get(d.id) || 0) * 200).strength(1.2)) 
      .force("y", d3.forceY(height / 2).strength(0.1)); 

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.4)
      .selectAll("path")
      .data(simLinks)
      .join("path")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrowhead)");

    // Draw Nodes
    const node = g.append("g")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .call(d3.drag<SVGGElement, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Circle - Enhanced Glassy Look
    node.append("circle")
      .attr("r", 24)
      .attr("fill", (d: any) => {
         const t = d.type.toLowerCase();
         if (t.includes('shuffle') || t.includes('exchange')) return 'rgba(248, 113, 113, 0.3)'; // Red
         if (t.includes('scan') || t.includes('read')) return 'rgba(74, 222, 128, 0.3)'; // Green
         if (t.includes('join')) return 'rgba(251, 191, 36, 0.3)'; // Amber
         if (t.includes('filter') || t.includes('project')) return 'rgba(96, 165, 250, 0.3)'; // Blue
         return 'rgba(148, 163, 184, 0.3)';
      })
      .attr("stroke-width", 2)
      .attr("stroke", (d: any) => {
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#f87171'; 
        if (t.includes('scan') || t.includes('read')) return '#4ade80'; 
        if (t.includes('join')) return '#fbbf24'; 
        if (t.includes('filter') || t.includes('project')) return '#60a5fa'; 
        return '#94a3b8';
      });

    // Inner Icon/Dot
    node.append("circle")
      .attr("r", 8)
      .attr("fill", (d: any) => {
        const t = d.type.toLowerCase();
        if (t.includes('shuffle') || t.includes('exchange')) return '#ef4444';
        if (t.includes('scan') || t.includes('read')) return '#22c55e';
        if (t.includes('join')) return '#f59e0b';
        if (t.includes('filter') || t.includes('project')) return '#3b82f6';
        return '#cbd5e1';
      });

    // Node Label (Name)
    node.append("text")
      .attr("x", 0)
      .attr("y", -35)
      .attr("text-anchor", "middle")
      .text((d: any) => d.name)
      .attr("font-weight", "bold")
      .attr("font-size", "12px")
      .attr("fill", "#ffffff") 
      .style("pointer-events", "none")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,0.8)") 
      .call(getWrapText);

    // Node Metric Label
    node.append("text")
      .attr("x", 0)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .text((d: any) => d.metric || "")
      .attr("font-size", "10px")
      .attr("fill", "#e2e8f0")
      .style("pointer-events", "none");

    function linkArc(d: any) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      
      if (Math.abs(dy) < 20) {
         return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
      }
      return `M${d.source.x},${d.source.y}C${d.source.x + dx/2},${d.source.y} ${d.source.x + dx/2},${d.target.y} ${d.target.x},${d.target.y}`;
    }

    function getWrapText(selection: any) {
       selection.each(function(this: any, d: any) {
          if (d.name.length > 20) {
             d3.select(this).text(d.name.substring(0, 18) + "...");
          }
       });
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

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  const handleZoom = (factor: number) => {
     if (!svgRef.current) return;
     const svg = d3.select(svgRef.current);
     const zoom: any = d3.zoom().on("zoom", (event) => {
        d3.select(svgRef.current).select("g").attr("transform", event.transform);
        setZoomLevel(event.transform.k);
     });
     svg.transition().duration(500).call(zoom.scaleBy, factor);
  };

  return (
    <div ref={containerRef} className="w-full bg-slate-900/30 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/10 overflow-hidden flex flex-col h-[600px] group hover:shadow-[0_0_40px_rgba(0,0,0,0.3)] transition-shadow relative">
      {/* Gloss Shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      <div className="p-5 border-b border-white/10 bg-white/5 flex justify-between items-center flex-shrink-0">
        <h3 className="font-bold text-white drop-shadow-sm">Execution Plan Flow</h3>
        <div className="flex items-center gap-3">
           <div className="flex gap-2 mr-4 border-r border-white/10 pr-4 hidden sm:flex">
               <div className="flex items-center gap-1 text-[10px] text-slate-300">
                 <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span> Scan
               </div>
               <div className="flex items-center gap-1 text-[10px] text-slate-300">
                 <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span> Shuffle
               </div>
               <div className="flex items-center gap-1 text-[10px] text-slate-300">
                 <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></span> Transform
               </div>
           </div>
           <div className="flex bg-black/30 rounded-lg border border-white/10 shadow-sm backdrop-blur-md">
              <button onClick={() => handleZoom(1.2)} className="p-2 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"><ZoomIn className="w-4 h-4" /></button>
              <button onClick={() => handleZoom(0.8)} className="p-2 hover:bg-white/10 text-slate-300 hover:text-white border-l border-white/10 transition-colors"><ZoomOut className="w-4 h-4" /></button>
           </div>
        </div>
      </div>
      <div className="flex-1 relative overflow-hidden">
         {/* Subtle Grid */}
         <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
         <svg ref={svgRef} className="w-full h-full block relative z-10"></svg>
      </div>
    </div>
  );
};